// services/googleSheetsService.js
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

class GoogleSheetsService {
  constructor() {
    this.serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, this.serviceAccountAuth);
  }

  async initialize() {
    await this.doc.loadInfo();
    console.log('Google Sheets 服務初始化完成');
  }

  // 你的其他 Google Sheets 操作方法...
}

// 改成匯出實例
module.exports = new GoogleSheetsService();
