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
        .map(row => ({
          id: row.get('id'),
          title: row.get('title'),
          description: row.get('description'),
          type: row.get('type'),
          datetime: row.get('datetime'),
          pattern: row.get('pattern'),
          location: row.get('location'),
          language: row.get('language'),
          status: row.get('status'),
          created_at: row.get('created_at'),
          next_trigger: row.get('next_trigger'),
          rowIndex: row.rowIndex // 保存行索引以便後續操作
        }))
        .sort((a, b) => new Date(a.next_trigger) - new Date(b.next_trigger)); // 按觸發時間排序

      return activeReminders;

    } catch (error) {
      console.error('獲取活躍提醒錯誤:', error);
      return [];
    }
  }

  // 獲取待觸發的提醒（用於排程檢查）
  async getPendingReminders(checkTime = new Date()) {
    try {
      const sheet = await this.getReminderSheet();
      const rows = await sheet.getRows();
      
      const pendingReminders = rows
        .filter(row => {
          const status = row.get('status');
          const nextTrigger = new Date(row.get('next_trigger'));
          return status === 'active' && nextTrigger <= checkTime;
        })
        .map(row => ({
          id: row.get('id'),
          title: row.get('title'),
          description: row.get('description'),
          type: row.get('type'),
          datetime: row.get('datetime'),
          pattern: row.get('pattern'),
          location: row.get('location'),
          language: row.get('language'),
          next_trigger: row.get('next_trigger'),
          user_id: row.get('user_id'),
          row: row // 保存完整的行對象以便更新
        }));

      console.log(`發現 ${pendingReminders.length} 個待觸發提醒`);
      return pendingReminders;

    } catch (error) {
      console.error('獲取待觸發提醒錯誤:', error);
      return [];
    }
  }

  // 完成提醒
  async completeReminder(reminderId, userId = 'default') {
    try {
      const sheet = await this.getReminderSheet();
      const rows = await sheet.getRows();
      
      const reminderRow = rows.find(row => 
        row.get('id') === reminderId && row.get('user_id') === userId
      );
      
      if (!reminderRow) {
        return {
          success: false,
          error: '找不到指定的提醒'
        };
      }

      const reminderType = reminderRow.get('type');
      
      if (reminderType === 'once') {
        // 一次性提醒：標記為已完成
        reminderRow.set('status', 'completed');
        await reminderRow.save();
      } else {
        // 重複提醒：計算下次觸發時間
        const currentDateTime = new Date(reminderRow.get('datetime'));
        const pattern = reminderRow.get('pattern');
        const nextTrigger = this.calculateNextTrigger(currentDateTime, reminderType, pattern);
        
        reminderRow.set('next_trigger', nextTrigger.toISOString());
        await reminderRow.save();
      }

      console.log('✅ 提醒完成處理成功:', reminderId);
      return {
        success: true,
        message: '提醒已完成'
      };

    } catch (error) {
      console.error('完成提醒錯誤:', error);
      return {
        success: false,
        error: '完成提醒處理失敗'
      };
    }
  }

  // 刪除提醒
  async deleteReminder(reminderId, userId = 'default') {
    try {
      const sheet = await this.getReminderSheet();
      const rows = await sheet.getRows();
      
      const reminderRow = rows.find(row => 
        row.get('id') === reminderId && row.get('user_id') === userId
      );
      
      if (!reminderRow) {
        return {
          success: false,
          error: '找不到指定的提醒'
        };
      }

      // 標記為已刪除而不是實際刪除行
      reminderRow.set('status', 'deleted');
      await reminderRow.save();

      console.log('✅ 提醒刪除成功:', reminderId);
      return {
        success: true,
        message: '提醒已刪除'
      };

    } catch (error) {
      console.error('刪除提醒錯誤:', error);
      return {
        success: false,
        error: '刪除提醒失敗'
      };
    }
  }

  // 更新提醒的下次觸發時間（用於排程處理後）
  async updateNextTrigger(reminder) {
    try {
      if (reminder.type === 'once') {
        // 一次性提醒完成後設為 completed
        reminder.row.set('status', 'completed');
      } else {
        // 重複提醒計算下次觸發時間
        const currentDateTime = new Date(reminder.datetime);
        const nextTrigger = this.calculateNextTrigger(currentDateTime, reminder.type, reminder.pattern);
        reminder.row.set('next_trigger', nextTrigger.toISOString());
      }
      
      await reminder.row.save();
      console.log('✅ 提醒觸發時間更新成功:', reminder.id);
      
    } catch (error) {
      console.error('更新提醒觸發時間錯誤:', error);
    }
  }

  // 獲取提醒統計資訊
  async getReminderStats(userId = 'default') {
    try {
      const sheet = await this.getReminderSheet();
      const rows = await sheet.getRows();
      
      const userRows = rows.filter(row => row.get('user_id') === userId);
      
      const stats = {
        total: userRows.length,
        active: userRows.filter(row => row.get('status') === 'active').length,
        completed: userRows.filter(row => row.get('status') === 'completed').length,
        deleted: userRows.filter(row => row.get('status') === 'deleted').length,
        byType: {
          once: userRows.filter(row => row.get('type') === 'once').length,
          daily: userRows.filter(row => row.get('type') === 'daily').length,
          weekly: userRows.filter(row => row.get('type') === 'weekly').length,
          monthly: userRows.filter(row => row.get('type') === 'monthly').length,
          custom: userRows.filter(row => row.get('type') === 'custom').length
        }
      };

      return stats;

    } catch (error) {
      console.error('獲取提醒統計錯誤:', error);
      return null;
    }
  }

  // 清理已完成的舊提醒（可選的維護功能）
  async cleanupOldReminders(daysOld = 30) {
    try {
      const sheet = await this.getReminderSheet();
      const rows = await sheet.getRows();
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      let deletedCount = 0;
      
      for (const row of rows) {
        const status = row.get('status');
        const createdAt = new Date(row.get('created_at'));
        
        if ((status === 'completed' || status === 'deleted') && createdAt < cutoffDate) {
          await row.delete();
          deletedCount++;
        }
      }

      console.log(`✅ 清理了 ${deletedCount} 個舊提醒`);
      return {
        success: true,
        deletedCount: deletedCount
      };

    } catch (error) {
      console.error('清理舊提醒錯誤:', error);
      return {
        success: false,
        error: '清理舊提醒失敗'
      };
    }
  }

  // 搜索提醒
  async searchReminders(query, userId = 'default') {
    try {
      const activeReminders = await this.getActiveReminders(userId);
      
      const results = activeReminders.filter(reminder => {
        const title = reminder.title.toLowerCase();
        const description = reminder.description.toLowerCase();
        const searchQuery = query.toLowerCase();
        
        return title.includes(searchQuery) || description.includes(searchQuery);
      });

      return results;

    } catch (error) {
      console.error('搜索提醒錯誤:', error);
      return [];
    }
  }

  // 獲取即將到來的提醒（未來24小時內）
  async getUpcomingReminders(userId = 'default', hoursAhead = 24) {
    try {
      const now = new Date();
      const futureTime = new Date(now.getTime() + (hoursAhead * 60 * 60 * 1000));
      
      const activeReminders = await this.getActiveReminders(userId);
      
      const upcomingReminders = activeReminders.filter(reminder => {
        const triggerTime = new Date(reminder.next_trigger);
        return triggerTime >= now && triggerTime <= futureTime;
      });

      return upcomingReminders;

    } catch (error) {
      console.error('獲取即將到來的提醒錯誤:', error);
      return [];
    }
  }

  // 驗證提醒資料
  validateReminderData(data) {
    const errors = [];

    if (!data.title || data.title.trim().length === 0) {
      errors.push('標題不能為空');
    }

    if (data.title && data.title.length > 100) {
      errors.push('標題長度不能超過100字符');
    }

    if (data.description && data.description.length > 500) {
      errors.push('描述長度不能超過500字符');
    }

    const validTypes = ['once', 'daily', 'weekly', 'monthly', 'custom'];
    if (data.type && !validTypes.includes(data.type)) {
      errors.push('無效的提醒類型');
    }

    if (data.datetime) {
      const datetime = new Date(data.datetime);
      if (isNaN(datetime.getTime())) {
        errors.push('無效的日期時間格式');
      } else if (datetime < new Date()) {
        errors.push('提醒時間不能早於當前時間');
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  // 格式化提醒資料供顯示用
  formatReminderForDisplay(reminder, language = 'zh') {
    const datetime = new Date(reminder.datetime);
    const formattedTime = datetime.toLocaleString(
      language === 'ja' ? 'ja-JP' : 'zh-TW',
      { 
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }
    );

    const typeLabels = {
      once: language === 'ja' ? '一回限り' : '一次性',
      daily: language === 'ja' ? '毎日' : '每日',
      weekly: language === 'ja' ? '毎週' : '每週',
      monthly: language === 'ja' ? '毎月' : '每月',
      custom: language === 'ja' ? 'カスタム' : '自定義'
    };

    return {
      ...reminder,
      formattedTime: formattedTime,
      typeLabel: typeLabels[reminder.type] || reminder.type
    };
  }
}

module.exports = ReminderService;
