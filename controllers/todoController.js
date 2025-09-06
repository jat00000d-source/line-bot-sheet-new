const { GoogleSpreadsheet } = require('google-spreadsheet');
const moment = require('moment-timezone');
const { createServiceAccountAuth } = require('../utils/envValidator');
const ReminderParser = require('../parsers/reminderParser');

class GoogleSheetsReminderController {
  constructor(lineClient) {
    this.lineClient = lineClient;
    this.doc = null;
    this.reminderSheetName = 'Reminders';
    this.reminderParser = new ReminderParser();
  }

  async getGoogleSheet() {
    if (!this.doc) {
      const serviceAccountAuth = createServiceAccountAuth();
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
            '重複資料', '狀態', '建立時間', '最後執行時間', '下次執行時間'
          ]
        });

        // 格式化標題列
        await sheet.loadCells('A1:J1');
        for (let i = 0; i < 10; i++) {
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
      
      // 解析提醒內容 - 使用更新的解析器
      const reminderText = command.text || command.reminder;
      console.log('🔍 原始提醒文字:', reminderText);
      
      const reminderData = this.reminderParser.parseReminderCommand(reminderText);
      console.log('📋 解析結果:', {
        content: reminderData.content,
        datetime: reminderData.datetime.format('YYYY-MM-DD HH:mm:ss'),
        recurring: reminderData.recurring,
        recurringData: reminderData.recurringData
      });
      
      const reminderId = `R${now.format('YYMMDDHHmmss')}${Math.random().toString(36).substr(2, 3)}`;
      
      // 計算下次執行時間
      const nextExecution = this.reminderParser.calculateNextExecution(
        reminderData.datetime, 
        reminderData.recurring, 
        reminderData.recurringData
      );
      
      const reminder = {
        'ID': reminderId,
        'UserID': event.source.userId,
        '提醒內容': reminderData.content || '提醒事項',
        '提醒時間': reminderData.datetime.format('YYYY-MM-DD HH:mm'),
        '重複類型': reminderData.recurring || '單次',
        '重複資料': reminderData.recurringData ? JSON.stringify(reminderData.recurringData) : '',
        '狀態': '啟用',
        '建立時間': now.format('YYYY-MM-DD HH:mm:ss'),
        '最後執行時間': '',
        '下次執行時間': nextExecution.format('YYYY-MM-DD HH:mm:ss')
      };
      
      await sheet.addRow(reminder);
      
      const message = language === 'ja' ? 
        `⏰ リマインダーを設定しました\n内容: ${reminderData.content || '提醒事項'}\n時間: ${reminderData.datetime.format('YYYY-MM-DD HH:mm')}\n繰り返し: ${reminderData.recurring || '一回のみ'}` :
        `⏰ 已設定提醒\n內容: ${reminderData.content || '提醒事項'}\n時間: ${reminderData.datetime.format('YYYY-MM-DD HH:mm')}\n重複: ${reminderData.recurring || '單次'}`;
      
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

  async checkAndSendReminders() {
    try {
      const sheet = await this.getReminderSheet();
      const rows = await sheet.getRows();
      const now = moment().tz('Asia/Tokyo');
      
      const activeReminders = rows.filter(row => row.get('狀態') === '啟用');
      
      for (const reminder of activeReminders) {
        const nextExecution = moment(reminder.get('下次執行時間'));
        
        // 更精確的時間比較，避免重複發送
        if (now.isSame(nextExecution, 'minute') && now.isAfter(nextExecution.subtract(30, 'seconds'))) {
          await this.sendReminder(reminder);
          await this.updateReminderAfterExecution(reminder, now);
        }
      }
      
    } catch (error) {
      console.error('檢查提醒錯誤:', error);
    }
  }

  async sendReminder(reminder) {
    try {
      const userId = reminder.get('UserID');
      const content = reminder.get('提醒內容');
      const recurring = reminder.get('重複類型');
      
      const message = {
        type: 'text',
        text: `⏰ 提醒時間到了！\n\n📝 ${content}\n\n${recurring !== '單次' ? `🔄 這是${recurring}提醒` : ''}`
      };
      
      await this.lineClient.pushMessage(userId, message);
      console.log(`✅ 已發送提醒給用戶 ${userId}: ${content}`);
      
    } catch (error) {
      console.error('發送提醒錯誤:', error);
    }
  }

  async updateReminderAfterExecution(reminder, executionTime) {
    try {
      const recurring = reminder.get('重複類型');
      const recurringDataStr = reminder.get('重複資料');
      
      let recurringData = null;
      if (recurringDataStr) {
        try {
          recurringData = JSON.parse(recurringDataStr);
        } catch (parseError) {
          console.warn('無法解析重複資料:', recurringDataStr);
        }
      }
      
      reminder.set('最後執行時間', executionTime.format('YYYY-MM-DD HH:mm:ss'));
      
      if (recurring && recurring !== '單次') {
        // 計算下次執行時間
        const currentNext = moment(reminder.get('下次執行時間'));
        const nextExecution = this.reminderParser.calculateNextExecution(
          currentNext, 
          recurring, 
          recurringData
        );
        reminder.set('下次執行時間', nextExecution.format('YYYY-MM-DD HH:mm:ss'));
        
        console.log(`📅 ${recurring}提醒已更新，下次執行時間: ${nextExecution.format('YYYY-MM-DD HH:mm:ss')}`);
      } else {
        // 單次提醒，執行後停用
        reminder.set('狀態', '已完成');
        console.log('✅ 單次提醒已完成並停用');
      }
      
      await reminder.save();
      
    } catch (error) {
      console.error('更新提醒執行狀態錯誤:', error);
    }
  }
}

module.exports = GoogleSheetsReminderController;
