require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const cron = require('node-cron');
const moment = require('moment-timezone');

// 設定預設時區為日本時間
moment.tz.setDefault('Asia/Tokyo');

// 檢查必要的環境變數
function validateEnvironment() {
  const required = ['CHANNEL_ACCESS_TOKEN', 'CHANNEL_SECRET', 'GOOGLE_SPREADSHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ 缺少必要的環境變數:', missing.join(', '));
    process.exit(1);
  }
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

// === Google Sheets 整合的 ReminderController ===
class GoogleSheetsReminderController {
  constructor(lineClient) {
    this.lineClient = lineClient;
    this.doc = null;
    this.reminderSheetName = 'Reminders';
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
        // 建立提醒工作表
        sheet = await doc.addSheet({
          title: this.reminderSheetName,
          headerValues: [
            'ID', 'UserID', '提醒內容', '提醒時間', '重複類型', 
            '狀態', '建立時間', '最後執行時間', '下次執行時間'
          ]
        });

        // 格式化標題列
        await sheet.loadCells('A1:I1');
        for (let i = 0; i < 9; i++) {
          const cell = sheet.getCell(0, i);
          cell.textFormat = { bold: true };
          cell.backgroundColor = { red: 0.85, green: 0.92, blue: 0.83 };
          cell.horizontalAlignment = 'CENTER';
        }
        await sheet.saveUpdatedCells();
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
      
      // 改進的提醒解析，修正重複詞語問題
      const reminderData = this.parseReminderCommand(command.text || command.reminder);
      
      const reminderId = `R${now.format('YYMMDDHHmmss')}${Math.random().toString(36).substr(2, 3)}`;
      
      // 使用準確的時間計算
      const nextExecution = this.calculateNextExecution(reminderData.datetime, reminderData.recurring);
      
      const reminder = {
        'ID': reminderId,
        'UserID': event.source.userId,
        '提醒內容': reminderData.content,
        '提醒時間': reminderData.datetime.format('YYYY-MM-DD HH:mm'),
        '重複類型': reminderData.recurring || '單次',
        '狀態': '啟用',
        '建立時間': now.format('YYYY-MM-DD HH:mm:ss'),
        '最後執行時間': '',
        '下次執行時間': nextExecution.format('YYYY-MM-DD HH:mm:ss')
      };
      
      await sheet.addRow(reminder);
      
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
        text: language === 'ja' ? 'リマインダー設定時にエラーが発生しました。' : '設定提醒時發生錯誤。'
      };
    }
  }

  async handleQueryReminders(event, language) {
    try {
      const sheet = await this.getReminderSheet();
      const rows = await sheet.getRows();
      
      const userReminders = rows.filter(row => 
        row.get('UserID') === event.source.userId && 
        row.get('狀態') === '啟用'
      );
      
      if (userReminders.length === 0) {
        return {
          type: 'text',
          text: language === 'ja' ? 'アクティブなリマインダーはありません。' : '目前沒有啟用的提醒事項。'
        };
      }
      
      const reminderList = userReminders.map((reminder, index) => {
        const content = reminder.get('提醒內容');
        const time = reminder.get('下次執行時間');
        const recurring = reminder.get('重複類型');
        return `${index + 1}. ${content}\n   ⏰ ${time}\n   🔄 ${recurring}`;
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
        text: language === 'ja' ? 'リマインダー取得時にエラーが発生しました。' : '查詢提醒時發生錯誤。'
      };
    }
  }

  async handleDeleteReminder(event, command, language) {
    try {
      const sheet = await this.getReminderSheet();
      const rows = await sheet.getRows();
      
      const userReminders = rows.filter(row => 
        row.get('UserID') === event.source.userId && 
        row.get('狀態') === '啟用'
      );
      
      const index = parseInt(command.index) - 1;
      
      if (index >= 0 && index < userReminders.length) {
        const reminderToDelete = userReminders[index];
        reminderToDelete.set('狀態', '已刪除');
        reminderToDelete.set('最後執行時間', moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss'));
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
        text: language === 'ja' ? 'リマインダー削除時にエラーが発生しました。' : '刪除提醒時發生錯誤。'
      };
    }
  }

  // 修正後的提醒解析方法
  parseReminderCommand(text) {
    const now = moment().tz('Asia/Tokyo');
    let content = text.trim();
    let datetime = null;
    let recurring = null;

    console.log('🔍 開始解析提醒指令:', text);

    // 第一步：解析重複設定，並從內容中移除
    const recurringPatterns = [
      { pattern: /每天|毎日|daily/gi, value: '每天' },
      { pattern: /每週|毎週|週次|weekly/gi, value: '每週' },
      { pattern: /每月|毎月|monthly/gi, value: '每月' },
      { pattern: /每年|毎年|yearly/gi, value: '每年' }
    ];

    for (const { pattern, value } of recurringPatterns) {
      if (pattern.test(content)) {
        recurring = value;
        content = content.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
        console.log('✅ 檢測到重複設定:', value);
        break;
      }
    }

    // 第二步：解析時間，優先級從高到低
    const timePatterns = [
      // 1. 完整的日期+時間格式（最高優先級）
      {
        name: '明天+完整時間',
        pattern: /(明天|明日)\s*(\d{1,2})[:：時点](\d{2})/,
        handler: (match) => {
          const hour = parseInt(match[2]);
          const minute = parseInt(match[3]);
          datetime = now.clone().add(1, 'day').hour(hour).minute(minute).second(0);
          content = content.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
          console.log('✅ 明天完整時間:', datetime.format('YYYY-MM-DD HH:mm'));
        }
      },
      {
        name: '今天+完整時間',
        pattern: /(今天|今日)\s*(\d{1,2})[:：時点](\d{2})/,
        handler: (match) => {
          const hour = parseInt(match[2]);
          const minute = parseInt(match[3]);
          datetime = now.clone().hour(hour).minute(minute).second(0);
          if (datetime.isBefore(now)) {
            datetime.add(1, 'day'); // 如果時間已過，設為明天
          }
          content = content.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
          console.log('✅ 今天完整時間:', datetime.format('YYYY-MM-DD HH:mm'));
        }
      },

      // 2. 完整時間格式（不指定日期）
      {
        name: '完整時間HH:MM',
        pattern: /(\d{1,2})[:：](\d{2})/,
        handler: (match) => {
          const hour = parseInt(match[1]);
          const minute = parseInt(match[2]);
          datetime = now.clone().hour(hour).minute(minute).second(0);
          if (datetime.isBefore(now)) {
            datetime.add(1, 'day'); // 如果時間已過，設為明天
          }
          content = content.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
          console.log('✅ 完整時間格式:', datetime.format('YYYY-MM-DD HH:mm'));
        }
      },
      {
        name: '中文時間格式',
        pattern: /(\d{1,2})\s*[點点时]\s*(\d{1,2})\s*分/,
        handler: (match) => {
          const hour = parseInt(match[1]);
          const minute = parseInt(match[2]);
          datetime = now.clone().hour(hour).minute(minute).second(0);
          if (datetime.isBefore(now)) {
            datetime.add(1, 'day');
          }
          content = content.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
          console.log('✅ 中文時間格式:', datetime.format('YYYY-MM-DD HH:mm'));
        }
      },
      {
        name: '日文時間格式',
        pattern: /(\d{1,2})\s*時\s*(\d{1,2})\s*分/,
        handler: (match) => {
          const hour = parseInt(match[1]);
          const minute = parseInt(match[2]);
          datetime = now.clone().hour(hour).minute(minute).second(0);
          if (datetime.isBefore(now)) {
            datetime.add(1, 'day');
          }
          content = content.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
          console.log('✅ 日文時間格式:', datetime.format('YYYY-MM-DD HH:mm'));
        }
      },

      // 3. 只有小時的格式
      {
        name: '明天+小時',
        pattern: /(明天|明日)\s*(\d{1,2})\s*[點时時]?(?!\d)/,
        handler: (match) => {
          const hour = parseInt(match[2]);
          datetime = now.clone().add(1, 'day').hour(hour).minute(0).second(0);
          content = content.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
          console.log('✅ 明天+小時:', datetime.format('YYYY-MM-DD HH:mm'));
        }
      },
      {
        name: '今天+小時',
        pattern: /(今天|今日)\s*(\d{1,2})\s*[點时時]?(?!\d)/,
        handler: (match) => {
          const hour = parseInt(match[2]);
          datetime = now.clone().hour(hour).minute(0).second(0);
          if (datetime.isBefore(now)) {
            datetime.add(1, 'day');
          }
          content = content.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
          console.log('✅ 今天+小時:', datetime.format('YYYY-MM-DD HH:mm'));
        }
      },
      {
        name: '單純小時',
        pattern: /(?<!\d)(\d{1,2})\s*[點时時](?!\d)/,
        handler: (match) => {
          const hour = parseInt(match[1]);
          datetime = now.clone().hour(hour).minute(0).second(0);
          if (datetime.isBefore(now)) {
            datetime.add(1, 'day');
          }
          content = content.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
          console.log('✅ 單純小時:', datetime.format('YYYY-MM-DD HH:mm'));
        }
      },

      // 4. 相對時間
      {
        name: '分
