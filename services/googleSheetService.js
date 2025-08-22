// services/googleSheetService.js
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const config = require('../config/config');

class GoogleSheetService {
  constructor() {
    // 初始化 Google Sheets 認證
    this.serviceAccountAuth = new JWT({
      email: config.google.serviceAccountEmail,
      key: config.google.privateKey,
      scopes: config.google.scopes,
    });
  }

  /**
   * 建立 Google Spreadsheet 連接
   * @returns {Promise<GoogleSpreadsheet>}
   */
  async getGoogleSheet() {
    try {
      const doc = new GoogleSpreadsheet(config.google.spreadsheetId, this.serviceAccountAuth);
      await doc.loadInfo();
      
      if (config.features.debugMode) {
        console.log(`📊 已連接到 Google Sheets: ${doc.title}`);
      }
      
      return doc;
    } catch (error) {
      console.error('Google Sheets 連接失敗:', error);
      throw new Error('無法連接到 Google Sheets');
    }
  }

  /**
   * 取得或建立指定月份的工作表
   * @param {string} sheetName - 工作表名稱 (格式: YYYY-MM)
   * @returns {Promise<Object>} 工作表物件
   */
  async getOrCreateMonthSheet(sheetName) {
    try {
      const doc = await this.getGoogleSheet();
      
      // 檢查工作表是否已存在
      let sheet = doc.sheetsByTitle[sheetName];
      
      if (!sheet) {
        // 建立新的月份工作表
        sheet = await this.createNewMonthSheet(doc, sheetName);
        console.log(`📅 已建立新的月份工作表: ${sheetName}`);
      }
      
      return sheet;
    } catch (error) {
      console.error(`取得工作表 ${sheetName} 時發生錯誤:`, error);
      throw error;
    }
  }

  /**
   * 建立新的月份工作表
   * @param {GoogleSpreadsheet} doc - Google Spreadsheet 文檔
   * @param {string} sheetName - 工作表名稱
   * @returns {Promise<Object>} 新建的工作表
   */
  async createNewMonthSheet(doc, sheetName) {
    try {
      // 建立工作表與標題列
      const sheet = await doc.addSheet({
        title: sheetName,
        headerValues: ['日期', '項目', '金額', '備註']
      });

      // 格式化工作表
      await this.formatSheet(sheet);
      
      return sheet;
    } catch (error) {
      console.error(`建立工作表 ${sheetName} 時發生錯誤:`, error);
      throw error;
    }
  }

  /**
   * 格式化工作表樣式
   * @param {Object} sheet - 工作表物件
   */
  async formatSheet(sheet) {
    try {
      await sheet.loadCells('A1:D1');
      
      // 設定標題列格式
      for (let i = 0; i < 4; i++) {
        const cell = sheet.getCell(0, i);
        cell.textFormat = { bold: true };
        cell.backgroundColor = { red: 0.91, green: 0.94, blue: 0.996 };
        cell.horizontalAlignment = 'CENTER';
      }

      await sheet.saveUpdatedCells();

      // 設定欄位寬度
      await sheet.resize({ columnCount: 4 });
      
    } catch (error) {
      console.error('格式化工作表時發生錯誤:', error);
      // 不拋出錯誤，因為格式化失敗不影響功能
    }
  }

  /**
   * 新增記帳記錄到工作表
   * @param {string} sheetName - 工作表名稱
   * @param {Object} recordData - 記帳資料
   * @returns {Promise<boolean>} 成功與否
   */
  async addExpenseRecord(sheetName, recordData) {
    try {
      const sheet = await this.getOrCreateMonthSheet(sheetName);
      
      await sheet.addRow({
        '日期': recordData.date,
        '項目': recordData.item,
        '金額': recordData.amount,
        '備註': recordData.note || ''
      });

      if (config.features.debugMode) {
        console.log(`✅ 記帳記錄已加入工作表 ${sheetName}:`, recordData);
      }
      
      return true;
    } catch (error) {
      console.error('新增記帳記錄時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 取得工作表的所有記錄
   * @param {string} sheetName - 工作表名稱
   * @returns {Promise<Array>} 記錄陣列
   */
  async getSheetRecords(sheetName) {
    try {
      const doc = await this.getGoogleSheet();
      const sheet = doc.sheetsByTitle[sheetName];
      
      if (!sheet) {
        return [];
      }

      const rows = await sheet.getRows();
      return rows;
    } catch (error) {
      console.error(`取得工作表 ${sheetName} 記錄時發生錯誤:`, error);
      throw error;
    }
  }

  /**
   * 更新或新增預算記錄
   * @param {string} sheetName - 工作表名稱
   * @param {number} budgetAmount - 預算金額
   * @returns {Promise<boolean>} 成功與否
   */
  async setBudgetRecord(sheetName, budgetAmount) {
    try {
      const sheet = await this.getOrCreateMonthSheet(sheetName);
      const rows = await sheet.getRows();
      
      // 尋找是否已有預算設定
      const budgetRow = rows.find(row => row.get('項目') === '月度預算');

      if (budgetRow) {
        // 更新現有預算
        budgetRow.set('金額', budgetAmount);
        await budgetRow.save();
        console.log(`💰 已更新預算: ${budgetAmount}`);
      } else {
        // 新增預算記錄
        await sheet.addRow({
          '日期': '預算',
          '項目': '月度預算',
          '金額': budgetAmount,
          '備註': `${sheetName}月度預算設定`
        });
        console.log(`💰 已設定新預算: ${budgetAmount}`);
      }
      
      return true;
    } catch (error) {
      console.error('設定預算記錄時發生錯誤:', error);
      throw error;
    }
  }
}

module.exports = GoogleSheetService;
