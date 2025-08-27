require('dotenv').config();
// 必要的模組導入
const express = require('express');
const line = require('@line/bot-sdk');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const cron = require('node-cron');

// 設定預設時區為日本時間
moment.tz.setDefault('Asia/Tokyo');

// 環境變數驗證
function validateEnvironment() {
  const required = [
    'CHANNEL_ACCESS_TOKEN',
    'CHANNEL_SECRET',
    'GOOGLE_SPREADSHEET_ID',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_PRIVATE_KEY'
  ];
  
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`❌ 缺少環境變數: ${key}`);
      process.exit(1);
    }
  }
  console.log('✅ 環境變數驗證通過');
}

// 增強版命令解析器
class EnhancedCommandParser {
  constructor() {
    // 金額相關的關鍵詞
    this.amountKeywords = ['元', '円', '圓', '塊', '錢', '用了', '花了', '花費', '支出', '費用'];
    
    // 日期相關的關鍵詞
    this.dateKeywords = {
      '今天': 0,
      '昨天': -1,
      '前天': -2,
      '大前天': -3,
      '今日': 0,
      '昨日': -1,
      '一昨日': -2
    };
  }
  
  parseCommand(text, language = 'zh') {
    const lowerText = text.toLowerCase();
    
    // 檢查特殊指令
    const commandType = COMMAND_MAPPING[text.trim()];
    if (commandType) {
      return { type: commandType };
    }
    
    // 檢查預算設定
    if (this.isBudgetSetting(text)) {
      const budgetMatch = text.match(/(\d+)/);
      if (budgetMatch) {
        return {
          type: 'set_budget',
          amount: parseInt(budgetMatch[1])
        };
      }
    }
    
    // 記帳相關命令
    if (lowerText.includes('支出') || lowerText.includes('查看') || lowerText.includes('統計') || lowerText.includes('集計') || lowerText.includes('まとめ')) {
      return { type: 'query_expenses' };
    }
    
    // 提醒相關命令 - 增強解析
    if (this.isReminderCommand(text)) {
      if (lowerText.includes('查看') || lowerText.includes('列表') || lowerText.includes('一覧') || lowerText.includes('リスト')) {
        return { type: 'query_reminders' };
      }
      if (lowerText.includes('刪除') || lowerText.includes('削除') || lowerText.includes('delete')) {
        const match = text.match(/(\d+)/);
        return { 
          type: 'delete_reminder',
          index: match ? match[1] : '1'
        };
      }
      return { 
        type: 'reminder',
        reminder: text
      };
    }
    
    // 解析記帳資料
    const expenseData = this.parseExpenseData(text, language);
    if (expenseData.success) {
      return {
        type: 'expense',
        amount: expenseData.amount,
        category: expenseData.item,
        description: expenseData.note,
        dateOffset: expenseData.dateOffset || 0
      };
    }
    
    return { type: 'unknown' };
  }

  isReminderCommand(text) {
    const reminderKeywords = [
      '提醒', 'リマインダー', 'remind', 'reminder',
      '明天', '明日', '後で', '今天', '今日', 
      '每天', '毎日', '每週', '毎週', '每月', '毎月',
      '時', '點', '分', 'daily', 'weekly', 'monthly'
    ];
    
    const timePatterns = [
      /\d+[:：時点]\d*/,  // 時間格式
      /\d+\s*(分鐘?|小時|時間|hours?|minutes?)\s*後/,  // 相對時間
      /(今天|明天|今日|明日)\s*\d+/,  // 絕對時間
      /(每天|每週|每月|毎日|毎週|毎月|daily|weekly|monthly)/  // 重複設定
    ];
    
    return reminderKeywords.some(keyword => text.includes(keyword)) ||
           timePatterns.some(pattern => pattern.test(text));
  }

  isBudgetSetting(text) {
    const patterns = [
      /^設定預算[\s　]+(\d+)/,
      /^預算設定[\s　]+(\d+)/,
      /^予算設定[\s　]+(\d+)/,
      /^予算[\s　]+(\d+)/,
      /^預算[\s　]+(\d+)/
    ];
    
    return patterns.some(pattern => pattern.test(text.trim()));
  }

  parseExpenseData(message, language) {
    try {
      // 首先嘗試傳統格式解析
      const traditionalResult = this.parseTraditionalFormat(message);
      if (traditionalResult.success) {
        return traditionalResult;
      }
      
      // 自然語言解析
      const nlResult = this.parseNaturalText(message, language);
      return nlResult;
      
    } catch (error) {
      console.error('解析錯誤:', error);
      return {
        success: false,
        error: '無法識別輸入格式'
      };
    }
  }

  parseTraditionalFormat(message) {
    // 同時支援全形空格（　）和半形空格（ ）
    const parts = message.split(/[\s　]+/).filter(part => part.length > 0);
    
    if (parts.length >= 2) {
      const firstPart = parts[0];
      const secondPart = parts[1];
      
      // 檢查第二部分是否為純數字
      const amount = this.extractAmount(secondPart);
      if (amount !== null) {
        return {
          success: true,
          item: firstPart,
          amount: amount,
          note: parts.slice(2).join(' ') || '',
          dateOffset: 0
        };
      }
      
      // 檢查第一部分是否為純數字
      const amountFirst = this.extractAmount(firstPart);
      if (amountFirst !== null) {
        return {
          success: true,
          item: secondPart,
          amount: amountFirst,
          note: parts.slice(2).join(' ') || '',
          dateOffset: 0
        };
      }
    }
    
    return { success: false };
  }

  parseNaturalText(message, language) {
    let item = null;
    let amount = null;
    let dateOffset = 0;
    let note = '';
    
    // 提取金額
    amount = this.extractAmountFromText(message);
    if (amount === null) {
      return {
        success: false,
        error: '找不到金額'
      };
    }
    
    // 提取日期偏移
    dateOffset = this.extractDateOffset(message);
    
    // 提取項目
    item = this.extractItemFromText(message, language);
    if (!item) {
      return {
        success: false,
        error: '找不到消費項目'
      };
    }
    
    // 提取備註
    note = this.extractNote(message, item, amount, dateOffset);
    
    return {
      success: true,
      item: item,
      amount: amount,
      note: note,
      dateOffset: dateOffset
    };
  }

  extractAmountFromText(text) {
    const patterns = [
      /(\d+(?:\.\d+)?)\s*[元円圓塊錢]/g,
      /[元円圓塊錢]\s*(\d+(?:\.\d+)?)/g,
      /(?:花了?|用了?|費用|支出|花費)\s*(\d+(?:\.\d+)?)/g,
      /(\d+(?:\.\d+)?)\s*(?:花了?|用了?)/g,
      /(?:^|\s)(\d+(?:\.\d+)?)(?=\s|[^.\d]|$)/g
    ];
    
    for (let pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        const amount = parseFloat(matches[0][1]);
        if (!isNaN(amount) && amount > 0) {
          return amount;
        }
      }
    }
    
    return null;
  }

  extractAmount(str) {
    const cleaned = str.replace(/[元円圓塊錢]/g, '');
    const amount = parseFloat(cleaned);
    return (!isNaN(amount) && amount > 0) ? amount : null;
  }

  extractDateOffset(text) {
    for (let [keyword, offset] of Object.entries(this.dateKeywords)) {
      if (text.includes(keyword)) {
        return offset;
      }
    }
    return 0;
  }

  extractItemFromText(message, language) {
    // 先檢查是否有明確的類別關鍵詞
    for (let [key, value] of Object.entries(CATEGORY_MAPPING)) {
      if (message.includes(key)) {
        return value;
      }
    }
    
    // 如果都找不到，嘗試提取第一個可能的名詞
    const words = message.replace(/[\d\s元円圓塊錢花了用了昨天今天前天]/g, '').trim();
    if (words.length > 0) {
      return words.substring(0, Math.min(words.length, 4));
    }
    
    return '其他';
  }

  extractNote(originalText, item, amount, dateOffset) {
    let note = originalText;
    
    // 移除已識別的部分
    note = note.replace(new RegExp(item, 'g'), '');
    note = note.replace(/\d+(?:\.\d+)?[元円圓塊錢]?/g, '');
    note = note.replace(/[元円圓塊錢]/g, '');
    note = note.replace(/(?:花了?|用了?|費用|支出|花費)/g, '');
    note = note.replace(/(?:今天|昨天|前天|大前天|今日|昨日|一昨日)/g, '');
    note = note.replace(/(?:吃|買|喝|花|用|搭|坐|看|玩)/g, '');
    
    // 清理空格和標點
    note = note.replace(/[\s　，,。.！!？?]+/g, ' ').trim();
    
    return note || '';
  }
}

class BasicLanguageDetector {
  detect(text) {
    const japaneseChars = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    return japaneseChars.test(text) ? 'ja' : 'zh';
  }
}

class LineBotApp {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    
    // 驗證環境變數
    validateEnvironment();
    
    // LINE Bot 配置
    this.config = {
      channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
      channelSecret: process.env.CHANNEL_SECRET,
    };
    
    this.client = new line.Client(this.config);
    
    // 初始化控制器
    this.initializeControllers();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.startScheduler();
  }
}  // 👈 這一個大括號很重要！收掉 class

// 環境變數驗證
function validateEnvironment() {
  const required = [
    'CHANNEL_ACCESS_TOKEN',
    'CHANNEL_SECRET',
    'GOOGLE_SPREADSHEET_ID',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_PRIVATE_KEY'
  ];
  
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`❌ 缺少環境變數: ${key}`);
      process.exit(1);
    }
  }
  console.log('✅ 環境變數驗證通過');
}

// Google Sheets 設定
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// === 雙語指令支援 ===
const COMMAND_MAPPING = {
  // 中文指令
  '總結': 'summary',
  '本月總結': 'summary',
  '說明': 'help',
  '幫助': 'help',
  '設定預算': 'set_budget',
  '預算': 'budget',
  '查看預算': 'budget',
  '剩餘': 'remaining',
  '提醒': 'reminder',
  '查看提醒': 'query_reminders',
  '提醒列表': 'query_reminders',
  '刪除提醒': 'delete_reminder',
  
  // 日文指令
  '集計': 'summary',
  '合計': 'summary', 
  'まとめ': 'summary',
  '今月集計': 'summary',
  '説明': 'help',
  'ヘルプ': 'help',
  '助け': 'help',
  '予算設定': 'set_budget',
  '予算': 'budget',
  '残り': 'remaining',
  '残額': 'remaining',
  'リマインダー': 'reminder',
  'リマインダー一覧': 'query_reminders',
  'リマインダー削除': 'delete_reminder'
};

const CATEGORY_MAPPING = {
  // 中文項目保持原樣
  '午餐': '午餐',
  '晚餐': '晚餐',
  '早餐': '早餐',
  '咖啡': '咖啡',
  '交通': '交通',
  '購物': '購物',
  '娛樂': '娛樂',
  '醫療': '醫療',
  
  // 日文項目對應到中文（保持Google Sheets一致）
  '昼食': '午餐',
  'ランチ': '午餐',
  '夕食': '晚餐',
  '夜食': '晚餐',
  '朝食': '早餐',
  'コーヒー': '咖啡',
  '珈琲': '咖啡',
  '交通費': '交通',
  '電車': '交通',
  'バス': '交通',
  'タクシー': '交通',
  '買い物': '購物',
  'ショッピング': '購物',
  '娯楽': '娛樂',
  '映画': '娛樂',
  'ゲーム': '娛樂',
  '医療': '醫療',
  '病院': '醫療',
  '薬': '醫療'
};

// ===== 在這裡加上缺少的類別定義 =====

// 基本語言檢測器
class BasicLanguageDetector {
  detect(text) {
    const japaneseChars = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    return japaneseChars.test(text) ? 'ja' : 'zh';
  }
}

// 增強版命令解析器
class EnhancedCommandParser {
  constructor() {
    // 金額相關的關鍵詞
    this.amountKeywords = ['元', '円', '圓', '塊', '錢', '用了', '花了', '花費', '支出', '費用'];
    
    // 日期相關的關鍵詞
    this.dateKeywords = {
      '今天': 0,
      '昨天': -1,
      '前天': -2,
      '大前天': -3,
      '今日': 0,
      '昨日': -1,
      '一昨日': -2
    };
  }
  
  parseCommand(text, language = 'zh') {
    const lowerText = text.toLowerCase();
    
    // 檢查特殊指令
    const commandType = COMMAND_MAPPING[text.trim()];
    if (commandType) {
      return { type: commandType };
    }
    
    // 這裡需要加上其他解析邏輯...
    return { type: 'default' };
  }
}

// Google Sheets 整合的 ExpenseController
class GoogleSheetsExpenseController {
  constructor() {
    this.doc = null;
  }
  
  async getGoogleSheet() {
    if (!this.doc) {
      this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID, serviceAccountAuth);
      await this.doc.loadInfo();
    }
    return this.doc;
  }
  
  // 這裡需要加上其他方法...
}

// Google Sheets 整合的 ReminderController
class GoogleSheetsReminderController {
  constructor(client) {
    this.client = client;
    this.doc = null;
  }
  
  async getGoogleSheet() {
    if (!this.doc) {
      this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID, serviceAccountAuth);
      await this.doc.loadInfo();
    }
    return this.doc;
  }
  
  async checkAndSendReminders() {
    // 實作提醒檢查邏輯
  }
  
  // 這裡需要加上其他方法...
}

// 主要的 LineBotApp 類別
class LineBotApp {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    
    // 驗證環境變數
    validateEnvironment();
    
    // LINE Bot 配置
    this.config = {
      channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
      channelSecret: process.env.CHANNEL_SECRET,
    };
    
    this.client = new line.Client(this.config);
    
    // 初始化控制器
    this.initializeControllers();
    
    // 設定中介軟體和路由
    this.setupMiddleware();
    this.setupRoutes();
    
    // 啟動排程器
    this.startScheduler();
  }

  initializeControllers() {
    // 使用 Google Sheets 整合的控制器
    this.expenseController = new GoogleSheetsExpenseController();
    this.todoController = new GoogleSheetsReminderController(this.client);
    this.commandParser = new EnhancedCommandParser();
    this.languageDetector = new BasicLanguageDetector();
    
    console.log('✅ 控制器初始化完成 (包含 Google Sheets 整合)');
  }

  // ... 其他方法保持不變 ...
}

// 全域錯誤處理
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕獲的例外:', error);
  console.error('應用程式將繼續運行...');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未處理的 Promise 拒絕:', reason);
  console.error('位置:', promise);
});

// 優雅關閉
process.on('SIGTERM', () => {
  console.log('🔄 收到 SIGTERM 信號，準備優雅關閉...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🔄 收到 SIGINT 信號，準備優雅關閉...');
  process.exit(0);
});

// 啟動應用程式
const app = new LineBotApp();
app.start();

module.exports = LineBotApp;
 

// === Google Sheets 整合的 ExpenseController ===
class GoogleSheetsExpenseController {
  constructor() {
    this.doc = null;
  }
  
  async getGoogleSheet() {
    if (!this.doc) {
      this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID, serviceAccountAuth);
      await this.doc.loadInfo();
    }
    return this.doc;
  }
  async handleExpense(event, command) {
    try {
      let { amount, category, description, dateOffset } = command;
      
      // 項目名稱統一處理（日文轉中文）
      category = CATEGORY_MAPPING[category] || category || '其他';
      
      const doc = await this.getGoogleSheet();
      
      // 計算實際日期
      const targetDate = new Date();
      if (dateOffset) {
        targetDate.setDate(targetDate.getDate() + dateOffset);
      }
      
      const sheetName = this.formatDate(targetDate, 'YYYY-MM');
      
      // 取得或建立當月工作表
      let sheet = doc.sheetsByTitle[sheetName];
      if (!sheet) {
        sheet = await this.createNewMonthSheet(doc, sheetName);
      }

      // 加入記帳資料
      const dateStr = this.formatDate(targetDate, 'MM/DD');
      await sheet.addRow({
        '日期': dateStr,
        '項目': category,
        '金額': amount,
        '備註': description
      });

      // 獲取預算資訊並計算剩餘
      const budgetInfo = await this.calculateBudgetRemaining();
      
      const dateLabel = dateOffset === 0 ? '今天' :
        (dateOffset === -1 ? '昨天' : `${Math.abs(dateOffset)}天前`);
      
      let response = `✅ 記帳成功！\n日期：${dateStr}（${dateLabel}）\n項目：${category}\n金額：${amount.toLocaleString('zh-TW')}円\n備註：${description}`;

      // 添加預算資訊
      if (budgetInfo.hasBudget) {
        response += '\n\n' + budgetInfo.message;
      }

      return {
        type: 'text',
        text: response
      };
    } catch (error) {
      console.error('記帳處理錯誤:', error);
      return {
        type: 'text',
        text: '記帳處理時發生錯誤，請稍後再試。'
      };
    }
  }

  async handleExpenseQuery(event, command, language) {
    try {
      const doc = await this.getGoogleSheet();
      const now = new Date();
      const sheetName = this.formatDate(now, 'YYYY-MM');

      const sheet = doc.sheetsByTitle[sheetName];
      if (!sheet) {
        return {
          type: 'text',
          text: `本月（${sheetName}）尚未有任何記帳記錄`
        };
      }

      const rows = await sheet.getRows();
      if (rows.length === 0) {
        return {
          type: 'text',
          text: `本月（${sheetName}）尚未有任何記帳記錄`
        };
      }

      // 計算總支出（排除預算記錄）
      let totalExpense = 0;
      let recordCount = 0;

      rows.forEach(row => {
        if (row.get('項目') !== '月度預算') {
          const amount = parseFloat(row.get('金額'));
          if (!isNaN(amount)) {
            totalExpense += amount;
            recordCount++;
          }
        }
      });

      const currentDay = now.getDate();
      const avgDaily = recordCount > 0 ? Math.round(totalExpense / currentDay) : 0;

      let summary = `📊 ${sheetName} 支出總結\n` +
                   `💰 總支出：${totalExpense.toLocaleString('zh-TW')}円\n` +
                   `📝 記錄筆數：${recordCount} 筆\n` +
                   `📅 平均每日：${avgDaily.toLocaleString('zh-TW')}円`;

      // 添加預算資訊
      const budgetInfo = await this.calculateBudgetRemaining();
      if (budgetInfo.hasBudget) {
        summary += '\n\n' + budgetInfo.message;
      }

      return {
        type: 'text',
        text: summary
      };
    } catch (error) {
      console.error('查詢支出錯誤:', error);
      return {
        type: 'text',
        text: '查詢支出時發生錯誤。'
      };
    }
  }

  async setBudget(amount) {
    try {
      const doc = await this.getGoogleSheet();
      const now = new Date();
      const sheetName = this.formatDate(now, 'YYYY-MM');

      // 取得或建立當月工作表
      let sheet = doc.sheetsByTitle[sheetName];
      if (!sheet) {
        sheet = await this.createNewMonthSheet(doc, sheetName);
      }

      // 尋找是否已有預算設定
      const rows = await sheet.getRows();
      const budgetRow = rows.find(row => row.get('項目') === '月度預算');

      if (budgetRow) {
        // 更新現有預算
        budgetRow.set('金額', amount);
        await budgetRow.save();
      } else {
        // 新增預算記錄（放在第一行）
        await sheet.addRow({
          '日期': '預算',
          '項目': '月度預算',
          '金額': amount,
          '備註': `${sheetName}月度預算設定`
        });
      }

      // 計算當前剩餘預算
      const remaining = await this.calculateBudgetRemaining();

      return `💰 本月預算已設定為 ${amount.toLocaleString('zh-TW')} 円！\n\n${remaining.message}`;
    } catch (error) {
      console.error('設定預算錯誤:', error);
      return '預算設定失敗，請稍後再試';
    }
  }

  async calculateBudgetRemaining() {
    try {
      const doc = await this.getGoogleSheet();
      const now = new Date();
      const sheetName = this.formatDate(now, 'YYYY-MM');

      const sheet = doc.sheetsByTitle[sheetName];
      if (!sheet) {
        return {
          hasBudget: false,
          message: '尚未設定預算，請使用「設定預算 金額」來設定'
        };
      }

      const rows = await sheet.getRows();
      
      // 尋找預算設定
      const budgetRow = rows.find(row => row.get('項目') === '月度預算');
      if (!budgetRow) {
        return {
          hasBudget: false,
          message: '尚未設定預算，請使用「設定預算 金額」來設定'
        };
      }

      const budget = parseFloat(budgetRow.get('金額')) || 0;
      
      // 計算總支出（排除預算記錄）
      let totalExpense = 0;
      let expenseCount = 0;
      
      rows.forEach(row => {
        if (row.get('項目') !== '月度預算') {
          const amount = parseFloat(row.get('金額'));
          if (!isNaN(amount)) {
            totalExpense += amount;
            expenseCount++;
          }
        }
      });

      const remaining = budget - totalExpense;
      const usagePercentage = budget > 0 ? ((totalExpense / budget) * 100).toFixed(1) : 0;
      
      // 計算每日剩餘可用金額
      const today = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const remainingDays = daysInMonth - today + 1;
      const dailyAllowance = remaining > 0 && remainingDays > 0 ? Math.floor(remaining / remainingDays) : 0;

      // 預算狀態判斷
      let statusIcon = '💚';
      let warningMessage = '';
      
      if (usagePercentage >= 100) {
        statusIcon = '🚨';
        warningMessage = '\n⚠️ 已超出預算！';
      } else if (usagePercentage >= 80) {
        statusIcon = '🟡';
        warningMessage = '\n⚠️ 已使用80%預算';
      } else if (usagePercentage >= 60) {
        statusIcon = '🟠';
      }

      return {
        hasBudget: true,
        remaining: remaining,
        message: `${statusIcon} 本月預算狀況\n` +
                `💰 預算：${budget.toLocaleString('zh-TW')} 円\n` +
                `💸 支出：${totalExpense.toLocaleString('zh-TW')} 円 (${usagePercentage}%)\n` +
                `💵 剩餘：${remaining.toLocaleString('zh-TW')} 円\n` +
                `📅 每日可用：${dailyAllowance.toLocaleString('zh-TW')} 円\n` +
                `📊 記錄數：${expenseCount} 筆${warningMessage}`
      };
    } catch (error) {
      console.error('計算剩餘預算錯誤:', error);
      return {
        hasBudget: false,
        message: '預算計算時發生錯誤'
      };
    }
  }

  async createNewMonthSheet(doc, sheetName) {
    const sheet = await doc.addSheet({
      title: sheetName,
      headerValues: ['日期', '項目', '金額', '備註']
    });

    // 格式化工作表
    await sheet.loadCells('A1:D1');
    
    // 設定標題列格式
    for (let i = 0; i < 4; i++) {
      const cell = sheet.getCell(0, i);
      cell.textFormat = { bold: true };
      cell.backgroundColor = { red: 0.91, green: 0.94, blue: 0.996 };
      cell.horizontalAlignment = 'CENTER';
    }

    await sheet.saveUpdatedCells();
    await sheet.resize({ columnCount: 4 });
    
    return sheet;
  }

  formatDate(date, format) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    switch (format) {
      case 'YYYY-MM':
        return `${year}-${month}`;
      case 'MM/DD':
        return `${month}/${day}`;
      default:
        return date.toISOString();
    }
  }
}

// === 修正後的 Google Sheets 整合 ReminderController ===
class GoogleSheetsReminderController {
  constructor(lineClient) {
    this.lineClient = lineClient;
    this.doc = null;
    this.reminderSheetName = 'reminders'; // 確保與你的工作表名稱一致
  }

  async getGoogleSheet() {
    if (!this.doc) {
      this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID, serviceAccountAuth);
      await this.doc.loadInfo();
    }
    return this.doc;
  }

  async getReminderSheet() {
    try {
      const doc = await this.getGoogleSheet();
      let sheet = doc.sheetsByTitle[this.reminderSheetName];
      
      if (!sheet) {
        console.log(`⚠️ 找不到工作表 '${this.reminderSheetName}'`);
        console.log('可用的工作表:', Object.keys(doc.sheetsByTitle));
        
        // 嘗試創建提醒工作表
        console.log('正在創建提醒工作表...');
        sheet = await doc.addSheet({
          title: this.reminderSheetName,
          headerValues: ['id', 'title', 'description', 'type', 'datetime', 'pattern', 'location', 'language', 'status', 'created_at', 'next_trigger']
        });
        
        // 設定標題列格式
        await sheet.loadCells('A1:K1');
        for (let i = 0; i < 11; i++) {
          const cell = sheet.getCell(0, i);
          cell.textFormat = { bold: true };
          cell.backgroundColor = { red: 0.91, green: 0.94, blue: 0.996 };
          cell.horizontalAlignment = 'CENTER';
        }
        await sheet.saveUpdatedCells();
        
        console.log('✅ 提醒工作表創建成功');
      }
      
      return sheet;
    } catch (error) {
      console.error('獲取提醒工作表錯誤:', error);
      throw error;
    }
  }

  async handleTodo(event, command, language) {
    try {
      const sheet = await this.getReminderSheet();
      const now = moment().tz('Asia/Tokyo');
      
      console.log('開始處理提醒命令:', command);
      
      // 解析提醒時間和重複設定
      const reminderData = this.parseReminderCommand(command.text || command.reminder);
      console.log('解析後的提醒資料:', reminderData);
      
      const reminderId = `R${now.format('YYMMDDHHmmss')}${Math.random().toString(36).substr(2, 3)}`;
      
      // 計算下次執行時間
      const nextExecution = this.calculateNextExecution(reminderData.datetime, reminderData.recurring);
      console.log('計算的下次執行時間:', nextExecution.format('YYYY-MM-DD HH:mm:ss'));
      
      // 建立提醒資料
      const reminder = {
        'id': reminderId,
        'title': reminderData.content,
        'description': `用戶提醒: ${reminderData.content}`,
        'type': reminderData.recurring || 'once',
        'datetime': reminderData.datetime.format('YYYY-MM-DD HH:mm:ss'),
        'pattern': reminderData.recurring || '',
        'location': event.source.userId,
        'language': language,
        'status': 'active',
        'created_at': now.format('YYYY-MM-DD HH:mm:ss'),
        'next_trigger': nextExecution.format('YYYY-MM-DD HH:mm:ss')
      };
      
      console.log('準備加入提醒資料:', reminder);
      await sheet.addRow(reminder);
      console.log('✅ 提醒資料已成功加入 Google Sheets');
      
      const message = language === 'ja' ? 
        `⏰ リマインダーを設定しました\n内容: ${reminderData.content}\n時間: ${reminderData.datetime.format('YYYY-MM-DD HH:mm')}\n繰り返し: ${reminderData.recurring || '一回のみ'}` :
        `⏰ 已設定提醒\n內容: ${reminderData.content}\n時間: ${reminderData.datetime.format('YYYY-MM-DD HH:mm')}\n重複: ${reminderData.recurring || '單次'}`;
      
      return {
        type: 'text',
        text: message
      };
      
    } catch (error) {
      console.error('提醒處理錯誤:', error);
      return {
        type: 'text',
        text: language === 'ja' ? `リマインダー設定時にエラーが発生しました: ${error.message}` : `設定提醒時發生錯誤: ${error.message}`
      };
    }
  }

  async checkAndSendReminders() {
    try {
      const sheet = await this.getReminderSheet();
      const rows = await sheet.getRows();
      const now = moment().tz('Asia/Tokyo');
      
      console.log(`🔍 [${now.format('YYYY-MM-DD HH:mm:ss')}] 檢查 ${rows.length} 個提醒記錄...`);
      
      if (rows.length === 0) {
        console.log('📝 沒有找到任何提醒記錄');
        return;
      }
      
      const activeReminders = rows.filter(row => {
        const status = row.get('status');
        console.log(`檢查提醒狀態: ${row.get('title')} - 狀態: ${status}`);
        return status === 'active';
      });
      
      console.log(`📋 找到 ${activeReminders.length} 個啟用中的提醒`);
      
      let processedCount = 0;
      
      for (const reminder of activeReminders) {
        try {
          const nextTriggerStr = reminder.get('next_trigger');
          const title = reminder.get('title');
          
          console.log(`檢查提醒: ${title}, next_trigger: ${nextTriggerStr}`);
          
          if (!nextTriggerStr || nextTriggerStr === '') {
            console.log(`⚠️ 跳過沒有 next_trigger 的提醒: ${title}`);
            continue;
          }
          
          const nextTrigger = moment.tz(nextTriggerStr, 'YYYY-MM-DD HH:mm:ss', 'Asia/Tokyo');
          
          if (!nextTrigger.isValid()) {
            console.log(`⚠️ 無效的時間格式: ${nextTriggerStr} for ${title}`);
            continue;
          }
          
          console.log(`時間比對: 現在=${now.format('YYYY-MM-DD HH:mm:ss')}, 觸發=${nextTrigger.format('YYYY-MM-DD HH:mm:ss')}`);
          
          // 修正時間檢查邏輯 - 擴大時間窗口到3分鐘
          const timeDiff = now.diff(nextTrigger, 'minutes');
          console.log(`時間差: ${timeDiff} 分鐘`);
          
          if (timeDiff >= 0 && timeDiff <= 3) {
            console.log(`🔔 執行提醒: ${title}`);
            await this.sendReminder(reminder);
            await this.updateReminderAfterExecution(reminder, now);
            processedCount++;
          } else if (timeDiff > 3) {
            console.log(`⚠️ 提醒已過期超過3分鐘: ${title}, 差距: ${timeDiff} 分鐘`);
          } else {
            console.log(`⏳ 提醒尚未到時間: ${title}, 還需等待: ${Math.abs(timeDiff)} 分鐘`);
          }
          
        } catch (reminderError) {
          console.error(`處理單個提醒時錯誤:`, reminderError);
          continue;
        }
      }
      
      console.log(`✅ 提醒檢查完成，處理了 ${processedCount} 個提醒`);
      
    } catch (error) {
      console.error('檢查提醒錯誤:', error);
    }
  }

  async sendReminder(reminder) {
    try {
      const userId = reminder.get('location');
      const title = reminder.get('title');
      const type = reminder.get('type');
      const language = reminder.get('language') || 'zh';
      
      console.log(`發送提醒給用戶: ${userId}, 內容: ${title}`);
      
      const message = {
        type: 'text',
        text: language === 'ja' ? 
          `⏰ リマインダーの時間です！\n\n📝 ${title}\n\n${type !== 'once' ? `🔄 これは${type}リマインダーです` : ''}` :
          `⏰ 提醒時間到了！\n\n📝 ${title}\n\n${type !== 'once' ? `🔄 這是${type}提醒` : ''}`
      };
      
      await this.lineClient.pushMessage(userId, message);
      console.log(`✅ 已發送提醒給用戶 ${userId}: ${title}`);
      
    } catch (error) {
      console.error('發送提醒錯誤:', error);
      // 如果是 LINE API 錯誤，記錄詳細信息
      if (error.response) {
        console.error('LINE API 錯誤回應:', error.response.data);
      }
    }
  }

  async updateReminderAfterExecution(reminder, executionTime) {
    try {
      const type = reminder.get('type');
      const title = reminder.get('title');
      
      console.log(`更新提醒執行狀態: ${title}, 類型: ${type}`);
      
      if (type && type !== 'once') {
        // 重複提醒，計算下次執行時間
        const currentNext = moment.tz(reminder.get('next_trigger'), 'YYYY-MM-DD HH:mm:ss', 'Asia/Tokyo');
        const nextExecution = this.calculateNextExecution(currentNext, type);
        
        reminder.set('next_trigger', nextExecution.format('YYYY-MM-DD HH:mm:ss'));
        console.log(`🔄 更新重複提醒的下次執行時間: ${nextExecution.format('YYYY-MM-DD HH:mm:ss')}`);
      } else {
        // 單次提醒，執行後停用
        reminder.set('status', 'completed');
        console.log('✅ 單次提醒已完成，狀態設為 completed');
      }
      
      await reminder.save();
      console.log(`✅ 提醒狀態更新完成: ${title}`);
      
    } catch (error) {
      console.error('更新提醒執行狀態錯誤:', error);
    }
  }

  parseReminderCommand(text) {
    const now = moment().tz('Asia/Tokyo');
    let content = text;
    let datetime = now.clone().add(1, 'hour'); // 預設1小時後
    let recurring = null;

    console.log('解析提醒命令:', text);

    // 解析時間表達式
    const timePatterns = [
      // 絕對時間 - 今天/明天 + 時間
      {
        pattern: /(今天|今日)\s*(\d{1,2})[:：時点](\d{0,2})?/,
        handler: (match) => {
          const hour = parseInt(match[2]);
          const minute = parseInt(match[3] || '0');
          datetime = now.clone().hour(hour).minute(minute).second(0);
          if (datetime.isBefore(now)) datetime.add(1, 'day');
          content = text.replace(match[0], '').trim();
          console.log(`解析今天時間: ${hour}:${minute}`);
        }
      },
      {
        pattern: /(明天|明日)\s*(\d{1,2})[:：時点](\d{0,2})?/,
        handler: (match) => {
          const hour = parseInt(match[2]);
          const minute = parseInt(match[3] || '0');
          datetime = now.clone().add(1, 'day').hour(hour).minute(minute).second(0);
          content = text.replace(match[0], '').trim();
          console.log(`解析明天時間: ${hour}:${minute}`);
        }
      },
      // 相對時間
      {
        pattern: /(\d+)\s*(分鐘?|分|minutes?)\s*後/,
        handler: (match) => {
          const minutes = parseInt(match[1]);
          datetime = now.clone().add(minutes, 'minutes');
          content = text.replace(match[0], '').trim();
          console.log(`解析相對時間: ${minutes} 分鐘後`);
        }
      },
      {
        pattern: /(\d+)\s*(小時?|時間|hours?)\s*後/,
        handler: (match) => {
          const hours = parseInt(match[1]);
          datetime = now.clone().add(hours, 'hours');
          content = text.replace(match[0], '').trim();
          console.log(`解析相對時間: ${hours} 小時後`);
        }
      }
    ];

    // 解析重複設定
    const recurringPatterns = [
      { pattern: /每天|毎日|daily/i, value: 'daily' },
      { pattern: /每週|毎週|weekly/i, value: 'weekly' },
      { pattern: /每月|毎月|monthly/i, value: 'monthly' },
      { pattern: /每年|毎年|yearly/i, value: 'yearly' }
    ];

    // 應用時間解析
    for (const { pattern, handler } of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        handler(match);
        break;
      }
    }

    // 應用重複設定解析
    for (const { pattern, value } of recurringPatterns) {
      if (pattern.test(text)) {
        recurring = value;
        content = content.replace(pattern, '').trim();
        console.log(`解析重複設定: ${value}`);
        break;
      }
    }

    // 清理內容
    content = content.replace(/^\s*(提醒|リマインダー|remind)\s*/i, '').trim();
    if (!content) content = '提醒';

    console.log('解析結果:', { content, datetime: datetime.format('YYYY-MM-DD HH:mm:ss'), recurring });

    return {
      content,
      datetime,
      recurring
    };
  }

  calculateNextExecution(datetime, recurring) {
    if (!recurring || recurring === 'once') {
      return datetime;
    }

    const now = moment().tz('Asia/Tokyo');
    let next = datetime.clone();

    console.log(`計算下次執行時間: 當前=${now.format('YYYY-MM-DD HH:mm:ss')}, 原始=${datetime.format('YYYY-MM-DD HH:mm:ss')}, 重複=${recurring}`);

    // 如果時間已經過了，計算下一次執行時間
    while (next.isBefore(now)) {
      switch (recurring) {
        case 'daily':
        case '每天':
          next.add(1, 'day');
          break;
        case 'weekly':
        case '每週':
          next.add(1, 'week');
          break;
        case 'monthly':
        case '每月':
          next.add(1, 'month');
          break;
        case 'yearly':
        case '每年':
          next.add(1, 'year');
          break;
        default:
          break;
      }
    }

    console.log(`計算完成的下次執行時間: ${next.format('YYYY-MM-DD HH:mm:ss')}`);
    return next;
  }

  // 新增：手動觸發提醒的測試方法
  async testReminder(userId, message) {
    try {
      const testMessage = {
        type: 'text',
        text: `🧪 測試提醒: ${message}`
      };
      
      await this.lineClient.pushMessage(userId, testMessage);
      console.log(`✅ 測試提醒已發送給用戶 ${userId}`);
      return true;
    } catch (error) {
      console.error('發送測試提醒失敗:', error);
      return false;
    }
  }

  // 查詢提醒功能保持不變
  async handleQueryReminders(event, language) {
    try {
      const sheet = await this.getReminderSheet();
      const rows = await sheet.getRows();
      
      const userReminders = rows.filter(row => 
        row.get('location') === event.source.userId && 
        row.get('status') === 'active'
      );
      
      if (userReminders.length === 0) {
        return {
          type: 'text',
          text: language === 'ja' ? 'アクティブなリマインダーはありません。' : '目前沒有啟用的提醒事項。'
        };
      }
      
      const reminderList = userReminders.map((reminder, index) => {
        const title = reminder.get('title') || '提醒';
        const nextTrigger = reminder.get('next_trigger') || '未設定';
        const type = reminder.get('type') || 'once';
        const typeDisplay = type === 'once' ? (language === 'ja' ? '一回のみ' : '單次') : type;
        return `${index + 1}. ${title}\n   ⏰ ${nextTrigger}\n   🔄 ${typeDisplay}`;
      }).join('\n\n');
      
      const title = language === 'ja' ? '📋 リマインダー一覧:' : '📋 提醒列表:';
      
      return {
        type: 'text',
        text: `${title}\n\n${reminderList}`
      };
      
    } catch (error) {
      console.error('查詢提醒錯誤:', error);
      return {
        type: 'text',
        text: language === 'ja' ? `リマインダー取得時にエラーが発生しました: ${error.message}` : `查詢提醒時發生錯誤: ${error.message}`
      };
    }
  }

  // 刪除提醒功能
  async handleDeleteReminder(event, command, language = 'ja') {
    try {
      const sheet = await this.getReminderSheet();
      const rows = await sheet.getRows();
      
      const userReminders = rows.filter(row => 
        row.get('location') === event.source.userId && 
        row.get('status') === 'active'
      );
      
      const index = parseInt(command.index) - 1;
      
      if (index >= 0 && index < userReminders.length) {
        const reminderToDelete = userReminders[index];
        reminderToDelete.set('status', 'deleted');
        await reminderToDelete.save();
        
        return {
          type: 'text',
          text: language === 'ja' ? 'リマインダーを削除しました。' : '已刪除提醒。'
        };
      } else {
        return {
          type: 'text',
          text: language === 'ja' ? '指定されたリマインダーが見つかりません。' : '找不到指定的提醒。'
        };
      }
    } catch (error) {
      console.error('刪除提醒錯誤:', error);
      return {
        type: 'text',
        text: language === 'ja'
          ? `リマインダー削除時にエラーが発生しました: ${error.message}`
          : `刪除提醒時發生錯誤: ${error.message}`
          };
 }
  }
}   // ✅ 關掉 class

// 啟動應用
const app = new LineBotApp();
