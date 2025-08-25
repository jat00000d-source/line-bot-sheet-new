const { google } = require('googleapis');

class GoogleSheetsService {
    constructor() {
        this.sheets = null;
        this.spreadsheetId = process.env.GOOGLE_SHEET_ID;
        this.initializeAuth();
    }

    async initializeAuth() {
        try {
            const auth = new google.auth.GoogleAuth({
                credentials: {
                    type: "service_account",
                    project_id: process.env.GOOGLE_PROJECT_ID,
                    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
                    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                    client_id: process.env.GOOGLE_CLIENT_ID,
                    auth_uri: "https://accounts.google.com/o/oauth2/auth",
                    token_uri: "https://oauth2.googleapis.com/token",
                },
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });

            this.sheets = google.sheets({ version: 'v4', auth });
            console.log('✅ Google Sheets Service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Google Sheets:', error.message);
            throw error;
        }
    }

    // 記帳相關方法
    async addAccountingRecord(data) {
        const sheetName = '記帳'; // 你的記帳工作表名稱
        return this.appendRow(sheetName, data);
    }

    async getAccountingRecords(range = 'A:F') {
        const sheetName = '記帳';
        return this.getRows(sheetName, range);
    }

    // 提醒相關方法
    async addReminder(reminderData) {
        const sheetName = '提醒'; // 新的提醒工作表
        await this.ensureSheetExists(sheetName);
        return this.appendRow(sheetName, reminderData);
    }

    async getReminders(range = 'A:J') {
        const sheetName = '提醒';
        await this.ensureSheetExists(sheetName);
        return this.getRows(sheetName, range);
    }

    async updateReminder(rowIndex, reminderData) {
        const sheetName = '提醒';
        return this.updateRow(sheetName, rowIndex, reminderData);
    }

    async deleteReminder(rowIndex) {
        const sheetName = '提醒';
        return this.deleteRow(sheetName, rowIndex);
    }

    // 基礎 CRUD 操作
    async appendRow(sheetName, values) {
        try {
            const request = {
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:A`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [values] }
            };

            const response = await this.sheets.spreadsheets.values.append(request);
            console.log(`✅ Added row to ${sheetName}:`, values);
            return response.data;
        } catch (error) {
            console.error(`❌ Failed to append row to ${sheetName}:`, error.message);
            throw error;
        }
    }

    async getRows(sheetName, range) {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!${range}`,
            });

            return response.data.values || [];
        } catch (error) {
            console.error(`❌ Failed to get rows from ${sheetName}:`, error.message);
            return [];
        }
    }

    async updateRow(sheetName, rowIndex, values) {
        try {
            const response = await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A${rowIndex}:J${rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [values] }
            });

            console.log(`✅ Updated row ${rowIndex} in ${sheetName}`);
            return response.data;
        } catch (error) {
            console.error(`❌ Failed to update row in ${sheetName}:`, error.message);
            throw error;
        }
    }

    async deleteRow(sheetName, rowIndex) {
        try {
            // Google Sheets API 不直接支援刪除行，我們用清空資料的方式
            const emptyValues = ['', '', '', '', '', '', '', '', '', ''];
            return this.updateRow(sheetName, rowIndex, emptyValues);
        } catch (error) {
            console.error(`❌ Failed to delete row from ${sheetName}:`, error.message);
            throw error;
        }
    }

    // 確保工作表存在
    async ensureSheetExists(sheetName) {
        try {
            const spreadsheet = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });

            const sheetExists = spreadsheet.data.sheets.some(
                sheet => sheet.properties.title === sheetName
            );

            if (!sheetExists) {
                await this.createSheet(sheetName);
            }
        } catch (error) {
            console.error(`❌ Failed to check/create sheet ${sheetName}:`, error.message);
            throw error;
        }
    }

    async createSheet(sheetName) {
        try {
            const request = {
                spreadsheetId: this.spreadsheetId,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: { title: sheetName }
                        }
                    }]
                }
            };

            await this.sheets.spreadsheets.batchUpdate(request);

            // 如果是提醒工作表，添加標題行
            if (sheetName === '提醒') {
                const headers = [
                    'ID', '用戶ID', '提醒內容', '提醒時間', '重複類型', 
                    '狀態', '創建時間', '位置', '語言', '備註'
                ];
                await this.appendRow(sheetName, headers);
            }

            console.log(`✅ Created new sheet: ${sheetName}`);
        } catch (error) {
            console.error(`❌ Failed to create sheet ${sheetName}:`, error.message);
            throw error;
        }
    }

    // 搜尋功能
    async searchReminders(userId, query = '') {
        const allReminders = await this.getReminders();
        return allReminders.filter(reminder => {
            const [id, uid, content, time, type, status] = reminder;
            return uid === userId && 
                   (query === '' || content.includes(query) || time.includes(query));
        });
    }

    // 獲取即將到期的提醒
    async getUpcomingReminders(timeframe = 60) { // 預設60分鐘內
        const allReminders = await this.getReminders();
        const now = new Date();
        const futureTime = new Date(now.getTime() + timeframe * 60000);

        return allReminders.filter(reminder => {
            const [id, userId, content, reminderTime, repeatType, status] = reminder;
            
            if (status !== '啟用') return false;

            try {
                const reminderDate = new Date(reminderTime);
                return reminderDate >= now && reminderDate <= futureTime;
            } catch (error) {
                return false;
            }
        });
    }
}

// 單例模式
let instance = null;

function getGoogleSheetsService() {
    if (!instance) {
        instance = new GoogleSheetsService();
    }
    return instance;
}

module.exports = { GoogleSheetsService, getGoogleSheetsService };
