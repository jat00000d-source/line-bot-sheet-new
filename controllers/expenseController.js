const { GoogleSpreadsheet } = require('google-spreadsheet');
const { createServiceAccountAuth } = require('../utils/envValidator');
const { CATEGORY_MAPPING } = require('../constants/categoryMapping');

class GoogleSheetsExpenseController {
  constructor() {
    this.doc = null;
  }

  async getGoogleSheet() {
    if (!this.doc) {
      const serviceAccountAuth = createServiceAccountAuth();
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

module.exports = GoogleSheetsExpenseController;
