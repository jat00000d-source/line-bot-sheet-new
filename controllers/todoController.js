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
      
      // 解析提醒內容
      const reminderData = this.reminderParser.parseReminderCommand(command.text || command.reminder);
      
      const reminderId = `R${now.format('YYMMDDHHmmss')}${Math.random().toString(36).substr(2, 3)}`;
      
      // 計算下次執行時間
      const nextExecution = this.reminderParser.calculateNextExecution(reminderData.datetime, reminderData.recurring);
      
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
          text: language === 'ja' ? 'アクティブなリマインダーはありません。' : '目前沒有啟用的提醒事項。
