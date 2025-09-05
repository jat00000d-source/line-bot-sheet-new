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
    constructor() {
        this.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    }

    async authenticate() {
        // ... 原有的 authenticate 方法
    }

    async initialize() {
        // ... 原有的 initialize 方法
    }

    // 其他原有的方法...

    async checkAndSendReminders() {
        try {
            const auth = await this.authenticate();
            const sheets = google.sheets({ version: 'v4', auth });
            
            // 讀取提醒資料
            const range = 'Reminders!A:H';
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: range,
            });
            
            const rows = response.data.values;
            if (!rows || rows.length <= 1) return; // 沒有資料或只有標題
            
            const now = moment().tz('Asia/Tokyo');
            console.log(`🕐 目前時間: ${now.format('YYYY-MM-DD HH:mm:ss')}`);
            
            // 跳過標題行，從第二行開始處理
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length < 6) continue; // 確保有足夠的欄位
                
                const [userId, title, datetime, isCompleted, repeatType, lastSent, createdAt, description] = row;
                
                // 跳過已完成的提醒
                if (isCompleted === 'TRUE' || isCompleted === true) continue;
                
                // 修正日期格式解析
                let reminderTime;
                try {
                    // 嘗試多種日期格式
                    if (datetime.includes('T')) {
                        // ISO 格式: 2025-10-05T09:00:00
                        reminderTime = moment.tz(datetime, 'Asia/Tokyo');
                    } else if (datetime.includes(' ')) {
                        // 空格分隔格式: 2025-10-05 9:00:00 或 2025-10-05 09:00:00
                        const formats = [
                            'YYYY-MM-DD H:mm:ss',
                            'YYYY-MM-DD HH:mm:ss',
                            'YYYY-MM-DD H:mm',
                            'YYYY-MM-DD HH:mm'
                        ];
                        
                        let parsed = false;
                        for (const format of formats) {
                            reminderTime = moment.tz(datetime, format, 'Asia/Tokyo');
                            if (reminderTime.isValid()) {
                                parsed = true;
                                break;
                            }
                        }
                        
                        if (!parsed) {
                            console.error(`❌ 無法解析日期格式: ${datetime}`);
                            continue;
                        }
                    } else {
                        // 其他格式
                        reminderTime = moment.tz(datetime, 'Asia/Tokyo');
                    }
                    
                    if (!reminderTime.isValid()) {
                        console.error(`❌ 日期無效: ${datetime}`);
                        continue;
                    }
                } catch (error) {
                    console.error(`❌ 日期解析錯誤 (${datetime}):`, error.message);
                    continue;
                }
                
                // 檢查是否需要發送提醒
                const shouldSend = this.shouldSendReminder(now, reminderTime, lastSent, repeatType);
                
                if (shouldSend) {
                    console.log(`📢 準備發送提醒: ${title} (${datetime})`);
                    
                    try {
                        // 發送提醒訊息
                        await this.sendReminderMessage(userId, title, description || '', reminderTime);
                        
                        // 更新最後發送時間
                        await this.updateLastSentTime(i + 1, now); // +1 因為 Google Sheets 是從 1 開始計數
                        
                        console.log(`✅ 提醒已發送: ${title}`);
                    } catch (error) {
                        console.error(`❌ 發送提醒失敗 (${title}):`, error.message);
                    }
                }
            }
            
        } catch (error) {
            console.error('❌ 檢查提醒時發生錯誤:', error);
        }
    } // ← 確保這個方法有正確的結尾

    shouldSendReminder(now, reminderTime, lastSent, repeatType) {
        // 如果還沒到提醒時間，不發送
        if (now.isBefore(reminderTime)) {
            return false;
        }
        
        // 如果是一次性提醒
        if (!repeatType || repeatType === 'none' || repeatType === '') {
            // 檢查是否已經發送過
            if (lastSent) {
                return false; // 已經發送過了
            }
            return true; // 時間到了且沒發送過
        }
        
        // 重複提醒邏輯
        if (!lastSent) {
            return true; // 第一次發送
        }
        
        try {
            const lastSentTime = moment.tz(lastSent, 'Asia/Tokyo');
            if (!lastSentTime.isValid()) {
                return true; // 無法解析上次發送時間，直接發送
            }
            
            switch (repeatType.toLowerCase()) {
                case 'daily':
                case '每天':
                    return now.diff(lastSentTime, 'days') >= 1;
                    
                case 'weekly':
                case '每週':
                    return now.diff(lastSentTime, 'weeks') >= 1;
                    
                case 'monthly':
                case '每月':
                    return now.diff(lastSentTime, 'months') >= 1;
                    
                case 'yearly':
                case '每年':
                    return now.diff(lastSentTime, 'years') >= 1;
                    
                default:
                    return false;
            }
        } catch (error) {
            console.error('❌ 檢查重複提醒時發生錯誤:', error.message);
            return true; // 發生錯誤時，默認發送提醒
        }
    }

    async sendReminderMessage(userId, title, description, reminderTime) {
        const timeStr = reminderTime.format('MM月DD日 HH:mm');
        
        let message = `⏰ 提醒時間到！\n\n`;
        message += `📝 ${title}\n`;
        message += `🕐 ${timeStr}\n`;
        
        if (description && description.trim()) {
            message += `📄 ${description}\n`;
        }
        
        message += `\n如要標記為完成，請回覆「完成 ${title}」`;
        
        // 使用 LINE API 發送訊息
        const linebot = require('@line/bot-sdk');
        const client = new linebot.Client({
            channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
        });
        
        await client.pushMessage(userId, {
            type: 'text',
            text: message
        });
    }

    async updateLastSentTime(rowIndex, currentTime) {
        try {
            const auth = await this.authenticate();
            const sheets = google.sheets({ version: 'v4', auth });
            
            // 更新 F 欄（最後發送時間）
            const range = `Reminders!F${rowIndex}`;
            await sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: range,
                valueInputOption: 'RAW',
                resource: {
                    values: [[currentTime.format('YYYY-MM-DD HH:mm:ss')]]
                }
            });
        } catch (error) {
            console.error('❌ 更新最後發送時間失敗:', error.message);
        }
    }

  // 修正後的 handleTodo 方法
  async handleTodo(event, command, language) {
    try {
      const sheet = await this.getReminderSheet();
      const now = moment().tz('Asia/Tokyo');
      
      console.log('處理提醒指令:', command);
      
      // 解析提醒內容
      const reminderData = this.parseReminderCommand(command.text || command.reminder);
      
      // 生成唯一ID
      const reminderId = `R${now.format('YYMMDDHHmmss')}${Math.random().toString(36).substr(2, 3)}`;
      
      // 計算下次執行時間
      const nextExecution = this.calculateNextExecution(reminderData.datetime, reminderData.recurring);
      
      const reminder = {
        'ID': reminderId,
        'UserID': event.source.userId,
        '提醒內容': reminderData.content,
        '提醒時間': reminderData.datetime.format('YYYY-MM-DD HH:mm'),
        '重複類型': reminderData.recurring,
        '狀態': '啟用',
        '建立時間': now.format('YYYY-MM-DD HH:mm:ss'),
        '最後執行時間': '',
        '下次執行時間': nextExecution.format('YYYY-MM-DD HH:mm:ss')
      };
      
      await sheet.addRow(reminder);
      
      const message = language === 'ja' ? 
        `⏰ リマインダーを設定しました\n内容: ${reminderData.content}\n時間: ${reminderData.datetime.format('MM/DD HH:mm')}\n繰り返し: ${reminderData.recurring}\n次回実行: ${nextExecution.format('MM/DD HH:mm')}` :
        `⏰ 已設定提醒\n內容: ${reminderData.content}\n時間: ${reminderData.datetime.format('MM/DD HH:mm')}\n重複: ${reminderData.recurring}\n下次執行: ${nextExecution.format('MM/DD HH:mm')}`;
      
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

  // 新增：查詢提醒方法
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
          text: language === 'ja' ? 'リマインダーが設定されていません。' : '沒有設定任何提醒。'
        };
      }
      
      let message = language === 'ja' ? '📋 リマインダー一覧：\n' : '📋 提醒列表：\n';
      
      userReminders.forEach((reminder, index) => {
        const content = reminder.get('提醒內容');
        const time = reminder.get('下次執行時間');
        const recurring = reminder.get('重複類型');
        
        message += `${index + 1}. ${content}\n`;
        message += `   時間：${moment(time).format('MM/DD HH:mm')}\n`;
        message += `   重複：${recurring}\n\n`;
      });
      
      return {
        type: 'text',
        text: message
      };
      
    } catch (error) {
      console.error('查詢提醒錯誤:', error);
      return {
        type: 'text',
        text: language === 'ja' ? 'リマインダー確認時にエラーが発生しました。' : '查詢提醒時發生錯誤。'
      };
    }
  }

  // 新增：檢查和發送提醒方法
  async checkAndSendReminders() {
    try {
        const auth = await this.authenticate();
        const sheets = google.sheets({ version: 'v4', auth });
        
        // 讀取提醒資料
        const range = 'Reminders!A:H';
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: range,
        });
        
        const rows = response.data.values;
        if (!rows || rows.length <= 1) return; // 沒有資料或只有標題
        
        const now = moment().tz('Asia/Tokyo');
        console.log(`🕐 目前時間: ${now.format('YYYY-MM-DD HH:mm:ss')}`);
        
        // 跳過標題行，從第二行開始處理
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 6) continue; // 確保有足夠的欄位
            
            const [userId, title, datetime, isCompleted, repeatType, lastSent, createdAt, description] = row;
            
            // 跳過已完成的提醒
            if (isCompleted === 'TRUE' || isCompleted === true) continue;
            
            // 修正日期格式解析
            let reminderTime;
            try {
                // 嘗試多種日期格式
                if (datetime.includes('T')) {
                    // ISO 格式: 2025-10-05T09:00:00
                    reminderTime = moment.tz(datetime, 'Asia/Tokyo');
                } else if (datetime.includes(' ')) {
                    // 空格分隔格式: 2025-10-05 9:00:00 或 2025-10-05 09:00:00
                    const formats = [
                        'YYYY-MM-DD H:mm:ss',
                        'YYYY-MM-DD HH:mm:ss',
                        'YYYY-MM-DD H:mm',
                        'YYYY-MM-DD HH:mm'
                    ];
                    
                    let parsed = false;
                    for (const format of formats) {
                        reminderTime = moment.tz(datetime, format, 'Asia/Tokyo');
                        if (reminderTime.isValid()) {
                            parsed = true;
                            break;
                        }
                    }
                    
                    if (!parsed) {
                        console.error(`❌ 無法解析日期格式: ${datetime}`);
                        continue;
                    }
                } else {
                    // 其他格式
                    reminderTime = moment.tz(datetime, 'Asia/Tokyo');
                }
                
                if (!reminderTime.isValid()) {
                    console.error(`❌ 日期無效: ${datetime}`);
                    continue;
                }
            } catch (error) {
                console.error(`❌ 日期解析錯誤 (${datetime}):`, error.message);
                continue;
            }
            
            // 檢查是否需要發送提醒
            const shouldSend = this.shouldSendReminder(now, reminderTime, lastSent, repeatType);
            
            if (shouldSend) {
                console.log(`📢 準備發送提醒: ${title} (${datetime})`);
                
                try {
                    // 發送提醒訊息
                    await this.sendReminderMessage(userId, title, description || '', reminderTime);
                    
                    // 更新最後發送時間
                    await this.updateLastSentTime(i + 1, now); // +1 因為 Google Sheets 是從 1 開始計數
                    
                    console.log(`✅ 提醒已發送: ${title}`);
                } catch (error) {
                    console.error(`❌ 發送提醒失敗 (${title}):`, error.message);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ 檢查提醒時發生錯誤:', error);
    }
}
  // 新增：計算下次執行時間方法
  calculateNextExecution(datetime, recurring, from = null) {
    const base = from || moment().tz('Asia/Tokyo');
    
    switch (recurring) {
      case '每天':
        return datetime.clone().add(1, 'day');
      case '每週':
        return datetime.clone().add(1, 'week');
      case '每月':
        return datetime.clone().add(1, 'month');
      case '每年':
        return datetime.clone().add(1, 'year');
      default:
        return datetime.clone();
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

  // 修正後的 parseReminderCommand 方法
  parseReminderCommand(text) {
    const now = moment().tz('Asia/Tokyo');
    let content = text.trim();
    let datetime = null;
    let recurring = '單次';

    console.log('開始解析提醒:', content);

    try {
      // 第一步：解析重複設定
      const recurringPatterns = [
        { pattern: /每天|毎日|daily/gi, value: '每天' },
        { pattern: /每週|毎週|每周|weekly/gi, value: '每週' },
        { pattern: /每月|毎月|monthly/gi, value: '每月' },
        { pattern: /每年|毎年|yearly/gi, value: '每年' }
      ];

      for (const { pattern, value } of recurringPatterns) {
        if (pattern.test(content)) {
          recurring = value;
          content = content.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
          console.log('找到重複設定:', value, '剩餘內容:', content);
          break;
        }
      }

      // 第二步：解析時間
      const timePatterns = [
        // 特定日期 + 時間組合
        {
          pattern: /(今天|今日)\s*(\d{1,2})[:：時点](\d{2})/,
          handler: (match) => {
            const hour = parseInt(match[2]);
            const minute = parseInt(match[3]);
            datetime = now.clone().hour(hour).minute(minute).second(0).millisecond(0);
            if (datetime.isBefore(now)) datetime.add(1, 'day');
            content = content.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
          }
        },
        {
          pattern: /(\d{1,2})\s*時\s*(\d{1,2})\s*分/,
          handler: (match) => {
            const hour = parseInt(match[1]);
            const minute = parseInt(match[2]);
            datetime = now.clone().hour(hour).minute(minute).second(0).millisecond(0);
            if (datetime.isBefore(now)) datetime.add(1, 'day');
            content = content.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
          }
        },
        {
          pattern: /(\d{1,2})[點时]/,
          handler: (match) => {
            const hour = parseInt(match[1]);
            datetime = now.clone().hour(hour).minute(0).second(0).millisecond(0);
            if (datetime.isBefore(now)) datetime.add(1, 'day');
            content = content.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
          }
        },
        // 相對時間
        {
          pattern: /(\d+)\s*分[鐘钟]?\s*[后後]/,
          handler: (match) => {
            const minutes = parseInt(match[1]);
            datetime = now.clone().add(minutes, 'minutes').second(0).millisecond(0);
            content = content.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
          }
        },
        {
          pattern: /(\d+)\s*[小時时]\s*[后後]/,
          handler: (match) => {
            const hours = parseInt(match[1]);
            datetime = now.clone().add(hours, 'hours').second(0).millisecond(0);
            content = content.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
          }
        },
        // 月份日期設定
        {
          pattern: /每月(\d{1,2})[號号日]/,
          handler: (match) => {
            const day = parseInt(match[1]);
            const targetMonth = now.clone().date(day).hour(9).minute(0).second(0).millisecond(0);
            
            if (targetMonth.isBefore(now)) {
              targetMonth.add(1, 'month');
            }
            
            datetime = targetMonth;
            recurring = '每月';
            content = content.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
          }
        }
      ];

      // 應用時間解析
      for (const timePattern of timePatterns) {
        const match = content.match(timePattern.pattern);
        if (match) {
          timePattern.handler(match);
          break;
        }
      }

      // 如果沒有解析出時間，設定預設時間
      if (!datetime) {
        if (recurring !== '單次') {
          datetime = now.clone().add(1, 'day').hour(9).minute(0).second(0).millisecond(0);
        } else {
          datetime = now.clone().add(1, 'hour').second(0).millisecond(0);
        }
      }

    } catch (error) {
      console.error('解析提醒時間錯誤:', error);
      datetime = now.clone().add(1, 'hour').second(0).millisecond(0);
    }

    return {
      datetime,
      recurring,
      content: content || '提醒事項'
    };
  }
}

// 增強版命令解析器
class EnhancedCommandParser {
  constructor() {
    this.amountKeywords = ['元', '円', '圓', '塊', '錢', '用了', '花了', '花費', '支出', '費用'];
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
    
    // 提醒相關命令
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
      /\d+[:：時点]\d*/,
      /\d+\s*(分鐘?|小時|時間|hours?|minutes?)\s*後/,
      /(今天|明天|今日|明日)\s*\d+/,
      /(每天|每週|每月|毎日|毎週|毎月|daily|weekly|monthly)/
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
      const traditionalResult = this.parseTraditionalFormat(message);
      if (traditionalResult.success) {
        return traditionalResult;
      }
      
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
    const parts = message.split(/[\s　]+/).filter(part => part.length > 0);
    
    if (parts.length >= 2) {
      const firstPart = parts[0];
      const secondPart = parts[1];
      
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
    
    amount = this.extractAmountFromText(message);
    if (amount === null) {
      return {
        success: false,
        error: '找不到金額'
      };
    }
    
    dateOffset = this.extractDateOffset(message);
    item = this.extractItemFromText(message, language);
    if (!item) {
      return {
        success: false,
        error: '找不到消費項目'
      };
    }
    
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
    for (let [key, value] of Object.entries(CATEGORY_MAPPING)) {
      if (message.includes(key)) {
        return value;
      }
    }
    
    const words = message.replace(/[\d\s元円圓塊錢花了用了昨天今天前天]/g, '').trim();
    if (words.length > 0) {
      return words.substring(0, Math.min(words.length, 4));
    }
    
    return '其他';
  }

  extractNote(originalText, item, amount, dateOffset) {
    let note = originalText;
    
    note = note.replace(new RegExp(item, 'g'), '');
    note = note.replace(/\d+(?:\.\d+)?[元円圓塊錢]?/g, '');
    note = note.replace(/[元円圓塊錢]/g, '');
    note = note.replace(/(?:花了?|用了?|費用|支出|花費)/g, '');
    note = note.replace(/(?:今天|昨天|前天|大前天|今日|昨日|一昨日)/g, '');
    note = note.replace(/(?:吃|買|喝|花|用|搭|坐|看|玩)/g, '');
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
    
    validateEnvironment();
    
    this.config = {
      channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
      channelSecret: process.env.CHANNEL_SECRET,
    };
    
    this.client = new line.Client(this.config);
    this.initializeControllers();
    this.setupMiddleware();
    this.setupRoutes();
    this.startScheduler();
  }

  initializeControllers() {
    this.expenseController = new GoogleSheetsExpenseController();
    this.todoController = new GoogleSheetsReminderController(this.client);
    this.commandParser = new EnhancedCommandParser();
    this.languageDetector = new BasicLanguageDetector();
    
    console.log('✅ 控制器初始化完成 (包含 Google Sheets 整合)');
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    this.app.use((req, res, next) => {
      const now = moment().tz('Asia/Tokyo');
      console.log(`📝 [${now.format('YYYY-MM-DD HH:mm:ss JST')}] ${req.method} ${req.path}`);
      next();
    });
    
    this.app.get('/health', (req, res) => {
      const now = moment().tz('Asia/Tokyo');
      
      res.status(200).json({ 
        status: 'OK', 
        timestamp: now.toISOString(),
        localTime: now.format('YYYY-MM-DD HH:mm:ss JST'),
        timezone: 'Asia/Tokyo',
        services: {
          'expense-tracking': '✅ 運行中 (Google Sheets)',
          'reminders': '✅ 運行中 (Google Sheets)',
          'scheduler': '✅ 運行中'
        }
      });
    });

    this.app.get('/', (req, res) => {
      res.status(200).json({
        message: 'LINE Bot 記帳提醒系統 - 修正版',
        status: 'Running',
        features: [
          'Google Sheets 記帳功能', 
          'Google Sheets 提醒功能', 
          '自動提醒發送', 
          '多語言支援',
          '預算管理'
        ]
      });
    });
  }

  setupRoutes() {
    this.app.post('/webhook', async (req, res) => {
      try {
        res.status(200).json({ message: 'OK' });
        
        if (!req.body || !req.body.events) {
          return;
        }

        setImmediate(async () => {
          try {
            const results = await Promise.allSettled(
              req.body.events.map(event => this.handleEvent(event))
            );
            
            const failed = results.filter(r => r.status === 'rejected');
            if (failed.length > 0) {
              console.error('❌ 部分事件處理失敗:', failed.map(f => f.reason));
            }
          } catch (asyncErr) {
            console.error('❌ 異步事件處理錯誤:', asyncErr);
          }
        });
        
      } catch (err) {
        console.error('❌ Webhook 錯誤:', err);
        if (!res.headersSent) {
          res.status(200).json({ message: 'Error handled' });
        }
      }
    });

    this.app.post('/test-reminders', async (req, res) => {
      try {
        await this.todoController.checkAndSendReminders();
        res.status(200).json({
          success: true,
          message: '提醒檢查已執行'
        });
      } catch (error) {
        console.error('❌ 測試提醒檢查錯誤:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
  }

  async handleEvent(event) {
    try {
      if (event.type !== 'message' || event.message.type !== 'text') {
        return null;
      }

      const userId = event.source.userId;
      const messageText = event.message.text.trim();
      const language = this.languageDetector.detect(messageText);
      const command = this.commandParser.parseCommand(messageText, language);
      
      let response;
      
      switch (command.type) {
        case 'expense':
          response = await this.expenseController.handleExpense(event, command);
          break;
        case 'query_expenses':
          response = await this.expenseController.handleExpenseQuery(event, command, language);
          break;
        case 'set_budget':
          const budgetResult = await this.expenseController.setBudget(command.amount);
          response = { type: 'text', text: budgetResult };
          break;
        case 'budget':
        case 'remaining':
          const budgetInfo = await this.expenseController.calculateBudgetRemaining();
          response = { type: 'text', text: budgetInfo.message };
          break;
        case 'reminder':
          response = await this.todoController.handleTodo(event, command, language);
          break;
        case 'query_reminders':
          response = await this.todoController.handleQueryReminders(event, language);
          break;
        case 'delete_reminder':
          response = await this.todoController.handleDeleteReminder(event, command, language);
          break;
        case 'help':
          response = { type: 'text', text: this.getHelpMessage(language) };
          break;
        default:
          response = await this.handleDefault(event, language);
          break;
      }

      if (response && event.replyToken && event.replyToken !== 'test-reply-token') {
        try {
          await this.client.replyMessage(event.replyToken, response);
        } catch (replyError) {
          console.error('❌ 傳送回應失敗:', replyError);
        }
      }
      
      return response;
      
    } catch (error) {
      console.error('❌ 處理事件錯誤:', error);
      
      if (event.replyToken && event.replyToken !== 'test-reply-token') {
        try {
          const errorMessage = {
            type: 'text',
            text: '處理訊息時發生錯誤，請稍後再試。'
          };
          await this.client.replyMessage(event.replyToken, errorMessage);
        } catch (replyError) {
          console.error('❌ 傳送錯誤訊息失敗:', replyError);
        }
      }
      
      throw error;
    }
  }

  async handleDefault(event, language) {
    const helpMessage = language === 'ja' ? 
      'こんにちは！修正版の家計簿とリマインダー機能をご利用いただけます。\n\n💰 家計簿:\n「食費 500円」\n「支出確認」\n「予算設定 50000」\n\n⏰ リマインダー:\n「明日8時に薬を飲む」\n「毎日19時に運動」\n\n「説明」で詳細をご確認ください。' :
      '您好！我是修正版記帳和提醒助手。\n\n💰 記帳功能:\n「食物 50元」\n「查看支出」\n「設定預算 50000」\n\n⏰ 提醒功能:\n「明天8點吃藥」\n「每天晚上7點運動」\n\n請輸入「說明」查看詳細使用方法。';
    
    return { type: 'text', text: helpMessage };
  }

  getHelpMessage(language = 'zh') {
    if (language === 'ja') {
      return `📝 記帳ボット使用説明 - 修正版\n\n💡 記帳形式：\n項目 金額 [備考]\n昨日ランチ100円\n\n💰 予算管理：\n予算設定 50000\n予算 (状況確認)\n\n⏰ リマインダー：\n明日8時に薬を飲む\n毎日19時に運動\nリマインダー一覧\nリマインダー削除 2`;
    } else {
      return `📝 記帳機器人使用說明 - 修正版\n\n💡 記帳格式：\n項目 金額 [備註]\n昨天午餐100元\n\n💰 預算管理：\n設定預算 50000\n預算 (查看狀況)\n\n⏰ 提醒功能：\n明天8點吃藥\n每天晚上7點運動\n查看提醒\n刪除提醒 2`;
    }
  }

  startScheduler() {
    try {
      cron.schedule('* * * * *', async () => {
    const jstTime = moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss');
    console.log(`⏰ [${jstTime} J3T] 檢查提醒中...`);
    
    try {
        // 修正：使用正確的控制器變數名稱
        await reminderController.checkAndSendReminders();
    } catch (error) {
        console.error('❌ 排程器錯誤:', error);
    }
}, {
    timezone: 'Asia/Tokyo'
});

      console.log('⏰ 提醒排程器已啟動 (JST 時區)');
      
    } catch (error) {
      console.error('❌ 排程器啟動失敗:', error);
    }
  }

  start() {
    this.app.listen(this.port, () => {
      const startTime = moment().tz('Asia/Tokyo');
      console.log('\n🚀 LINE Bot 伺服器啟動成功 - 修正版');
      console.log(`📍 Port: ${this.port}`);
      console.log(`🕐 啟動時間: ${startTime.format('YYYY-MM-DD HH:mm:ss JST')}`);
      console.log(`💰 記帳功能: ✅ 已啟用`);
      console.log(`⏰ 提醒功能: ✅ 已啟用`);
      console.log(`🔄 排程系統: ✅ 已啟用`);
      console.log('\n✅ 伺服器準備就緒\n');
    });
  }
}

// 全域錯誤處理
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕獲的例外:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未處理的 Promise 拒絕:', reason);
});

// 啟動應用程式
const app = new LineBotApp();
app.start();

module.exports = LineBotApp;').trim();
          }
        },
        {
          pattern: /(今天|今日)\s*(\d{1,2})[點时]?$/,
          handler: (match) => {
            const hour = parseInt(match[2]);
            datetime = now.clone().hour(hour).minute(0).second(0).millisecond(0);
            if (datetime.isBefore(now)) datetime.add(1, 'day');
            content = content.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
          }
        },
        {
          pattern: /(明天|明日)\s*(\d{1,2})[:：時点](\d{2})/,
          handler: (match) => {
            const hour = parseInt(match[2]);
            const minute = parseInt(match[3]);
            datetime = now.clone().add(1, 'day').hour(hour).minute(minute).second(0).millisecond(0);
            content = content.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
          }
        },
        {
          pattern: /(明天|明日)\s*(\d{1,2})[點时]?$/,
          handler: (match) => {
            const hour = parseInt(match[2]);
            datetime = now.clone().add(1, 'day').hour(hour).minute(0).second(0).millisecond(0);
            content = content.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
          }
        },
        // 純時間格式
        {
          pattern: /(\d{1,2})[:：](\d{2})/,
          handler: (match) => {
            const hour = parseInt(match[1]);
            const minute = parseInt(match[2]);
            datetime = now.clone().hour(hour).minute(minute).second(0).millisecond(0);
            if (datetime.isBefore(now)) datetime.add(1, 'day');
            content = content.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
          }
        },
        {
          pattern: /(\d{1,2})[點时](\d{1,2})分/,
          handler: (match) => {
            const hour = parseInt(match[1]);
            const minute = parseInt(match[2]);
            datetime = now.clone().hour(hour).minute(minute).second(0).millisecond(0);
            if (datetime.isBefore(now)) datetime.add(1, 'day');
            content = content.replace(match[0], ' ').replace(/\s+/g, '
