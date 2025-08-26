// services/reminderService.js - 提醒服務
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

class ReminderService {
  constructor() {
    this.serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    this.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    this.doc = null;
    this.isConnected = false;
  }

  // 連接 Google Sheets
  async connect() {
    if (!this.isConnected) {
      try {
        this.doc = new GoogleSpreadsheet(this.spreadsheetId, this.serviceAccountAuth);
        await this.doc.loadInfo();
        this.isConnected = true;
        console.log('✅ Google Sheets 連接成功');
      } catch (error) {
        console.error('❌ Google Sheets 連接失敗:', error);
        throw error;
      }
    }
    return this.doc;
  }

  // 獲取或創建提醒工作表
  async getReminderSheet() {
    const doc = await this.connect();
    
    let sheet = doc.sheetsByTitle['Reminders'];
    if (!sheet) {
      console.log('創建 Reminders 工作表...');
      sheet = await doc.addSheet({
        title: 'Reminders',
        headerValues: [
          'id', 'title', 'description', 'type', 'datetime', 
          'pattern', 'location', 'language', 'status', 
          'created_at', 'next_trigger', 'user_id'
        ]
      });
      
      // 設定標題列格式
      await this.formatReminderSheet(sheet);
    }
    
    return sheet;
  }

  // 格式化提醒工作表
  async formatReminderSheet(sheet) {
    await sheet.loadCells('A1:L1');
    
    for (let i = 0; i < 12; i++) {
      const cell = sheet.getCell(0, i);
      cell.textFormat = { bold: true };
      cell.backgroundColor = { red: 0.2, green: 0.6, blue: 0.86 };
      cell.horizontalAlignment = 'CENTER';
    }
    
    await sheet.saveUpdatedCells();
  }

  // 生成唯一 ID
  generateId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `R_${timestamp}_${random}`;
  }

  // 創建提醒
  async createReminder(reminderData) {
    try {
      const sheet = await this.getReminderSheet();
      
      // 驗證必要欄位
      if (!reminderData.title) {
        return {
          success: false,
          error: reminderData.language === 'ja' ? 
            'リマインダーのタイトルが必要です' : 
            '提醒標題為必填欄位'
        };
      }

      // 處理日期時間
      const datetime = new Date(reminderData.datetime);
      if (isNaN(datetime.getTime())) {
        return {
          success: false,
          error: reminderData.language === 'ja' ? 
            '無効な日時形式です' : 
            '日期時間格式無效'
        };
      }

      // 計算下次觸發時間
      const nextTrigger = this.calculateNextTrigger(datetime, reminderData.type, reminderData.pattern);

      const reminder = {
        id: this.generateId(),
        title: reminderData.title,
        description: reminderData.description || '',
        type: reminderData.type || 'once',
        datetime: datetime.toISOString(),
        pattern: reminderData.pattern || '',
        location: reminderData.location || '',
        language: reminderData.language || 'zh',
        status: 'active',
        created_at: new Date().toISOString(),
        next_trigger: nextTrigger.toISOString(),
        user_id: reminderData.userId || 'default'
      };

      // 添加到工作表
      await sheet.addRow(reminder);

      console.log('✅ 提醒創建成功:', reminder.id);
      return {
        success: true,
        reminder: reminder
      };

    } catch (error) {
      console.error('創建提醒錯誤:', error);
      return {
        success: false,
        error: reminderData.language === 'ja' ? 
          'リマインダーの作成に失敗しました' : 
          '創建提醒失敗'
      };
    }
  }

  // 計算下次觸發時間
  calculateNextTrigger(datetime, type, pattern) {
    const now = new Date();
    const triggerTime = new Date(datetime);

    switch (type) {
      case 'once':
        return triggerTime;
        
      case 'daily':
        // 如果時間已過，設定為明天
        if (triggerTime <= now) {
          triggerTime.setDate(triggerTime.getDate() + 1);
        }
        return triggerTime;
        
      case 'weekly':
        // 設定為下一個指定的星期
        const daysOfWeek = this.parseWeeklyPattern(pattern);
        return this.getNextWeeklyTrigger(triggerTime, daysOfWeek);
        
      case 'monthly':
        // 設定為下一個指定的日期
        const daysOfMonth = this.parseMonthlyPattern(pattern);
        return this.getNextMonthlyTrigger(triggerTime, daysOfMonth);
        
      case 'custom':
        // 自定義間隔（以天為單位）
        const intervalDays = parseInt(pattern) || 1;
        if (triggerTime <= now) {
          triggerTime.setDate(triggerTime.getDate() + intervalDays);
        }
        return triggerTime;
        
      default:
        return triggerTime;
    }
  }

  // 解析週間模式 (如: "1,3,5" 表示週一、三、五)
  parseWeeklyPattern(pattern) {
    if (!pattern) return [1]; // 預設週一
    
    return pattern.split(',')
      .map(day => parseInt(day.trim()))
      .filter(day => day >= 0 && day <= 6); // 0=週日, 1=週一, ...
  }

  // 解析月間模式 (如: "1,15" 表示每月1號和15號)
  parseMonthlyPattern(pattern) {
    if (!pattern) return [1]; // 預設每月1號
    
    return pattern.split(',')
      .map(day => parseInt(day.trim()))
      .filter(day => day >= 1 && day <= 31);
  }

  // 獲取下一個週間觸發時間
  getNextWeeklyTrigger(baseTime, daysOfWeek) {
    const now = new Date();
    const currentDay = now.getDay();
    const triggerTime = new Date(baseTime);
    
    // 尋找下一個指定的星期幾
    let nextDay = daysOfWeek.find(day => day > currentDay);
    
    if (!nextDay) {
      // 如果本週沒有符合的日子，找下週的第一個
      nextDay = Math.min(...daysOfWeek) + 7;
    }
    
    const daysToAdd = nextDay - currentDay;
    triggerTime.setDate(now.getDate() + daysToAdd);
    
    return triggerTime;
  }

  // 獲取下一個月間觸發時間
  getNextMonthlyTrigger(baseTime, daysOfMonth) {
    const now = new Date();
    const currentDate = now.getDate();
    const triggerTime = new Date(baseTime);
    
    // 尋找本月剩餘的符合日期
    let nextDate = daysOfMonth.find(date => date > currentDate);
    
    if (nextDate) {
      triggerTime.setDate(nextDate);
    } else {
      // 如果本月沒有符合的日期，設定為下個月的第一個指定日期
      triggerTime.setMonth(triggerTime.getMonth() + 1);
      triggerTime.setDate(Math.min(...daysOfMonth));
    }
    
    return triggerTime;
  }

  // 獲取活躍提醒列表
  async getActiveReminders(userId = 'default') {
    try {
      const sheet = await this.getReminderSheet();
      const rows = await sheet.getRows();
      
      const activeReminders = rows
        .filter(row => {
          const status = row.get('status');
          const userIdMatch = row.get('user_id') === userId;
          return status === 'active' && userIdMatch;
        })
        .
