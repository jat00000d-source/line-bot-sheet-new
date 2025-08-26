const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

class GoogleSheetsService {
  constructor() {
    this.serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }

  // 記帳相關的 Google Sheet 操作
  async getExpenseSheet() {
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, this.serviceAccountAuth);
    await doc.loadInfo();
    return doc.sheetsByTitle[process.env.GOOGLE_SHEET_NAME] || doc.sheetsByIndex[0];
  }

  async addExpenseRecord(data) {
    try {
      const sheet = await this.getExpenseSheet();
      await sheet.addRow(data);
      return { success: true };
    } catch (error) {
      console.error('Error adding expense record:', error);
      return { success: false, error: error.message };
    }
  }

  // 提醒相關的 Google Sheet 操作
  async getRemindersSheet() {
    const doc = new GoogleSpreadsheet(process.env.REMINDERS_SHEET_ID, this.serviceAccountAuth);
    await doc.loadInfo();
    return doc.sheetsByTitle[process.env.REMINDERS_SHEET_NAME] || doc.sheetsByIndex[0];
  }

  async addReminder(reminderData) {
    try {
      const sheet = await this.getRemindersSheet();
      await sheet.addRow({
        id: reminderData.id,
        userId: reminderData.userId,
        title: reminderData.title,
        description: reminderData.description,
        reminderTime: reminderData.reminderTime.toISOString(),
        type: reminderData.type,
        interval: reminderData.interval,
        isActive: reminderData.isActive,
        createdAt: new Date().toISOString(),
        location: reminderData.location || ''
      });
      return { success: true };
    } catch (error) {
      console.error('Error adding reminder:', error);
      return { success: false, error: error.message };
    }
  }

  async getReminders(userId) {
    try {
      const sheet = await this.getRemindersSheet();
      const rows = await sheet.getRows();
      return rows
        .filter(row => row.get('userId') === userId && row.get('isActive') === 'true')
        .map(row => ({
          id: row.get('id'),
          userId: row.get('userId'),
          title: row.get('title'),
          description: row.get('description'),
          reminderTime: new Date(row.get('reminderTime')),
          type: row.get('type'),
          interval: row.get('interval'),
          isActive: row.get('isActive') === 'true',
          location: row.get('location')
        }));
    } catch (error) {
      console.error('Error getting reminders:', error);
      return [];
    }
  }

  async updateReminder(reminderId, updateData) {
    try {
      const sheet = await this.getRemindersSheet();
      const rows = await sheet.getRows();
      const reminderRow = rows.find(row => row.get('id') === reminderId);
      
      if (reminderRow) {
        Object.keys(updateData).forEach(key => {
          if (key === 'reminderTime' && updateData[key] instanceof Date) {
            reminderRow.set(key, updateData[key].toISOString());
          } else {
            reminderRow.set(key, updateData[key]);
          }
        });
        await reminderRow.save();
        return { success: true };
      }
      return { success: false, error: 'Reminder not found' };
    } catch (error) {
      console.error('Error updating reminder:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteReminder(reminderId) {
    try {
      const sheet = await this.getRemindersSheet();
      const rows = await sheet.getRows();
      const reminderRow = rows.find(row => row.get('id') === reminderId);
      
      if (reminderRow) {
        reminderRow.set('isActive', 'false');
        await reminderRow.save();
        return { success: true };
      }
      return { success: false, error: 'Reminder not found' };
    } catch (error) {
      console.error('Error deleting reminder:', error);
      return { success: false, error: error.message };
    }
  }

  async getAllActiveReminders() {
    try {
      const sheet = await this.getRemindersSheet();
      const rows = await sheet.getRows();
      return rows
        .filter(row => row.get('isActive') === 'true')
        .map(row => ({
          id: row.get('id'),
          userId: row.get('userId'),
          title: row.get('title'),
          description: row.get('description'),
          reminderTime: new Date(row.get('reminderTime')),
          type: row.get('type'),
          interval: row.get('interval'),
          isActive: row.get('isActive') === 'true',
          location: row.get('location')
        }));
    } catch (error) {
      console.error('Error getting all active reminders:', error);
      return [];
    }
  }
}

module.exports = GoogleSheetsService;
