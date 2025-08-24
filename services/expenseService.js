// services/expenseService.js
const GoogleSheetService = require('./googleSheetService');
const DateHelper = require('../utils/dateHelper');
const { CATEGORY_MAPPING } = require('../constants/commands');
const { SUCCESS_MESSAGES, ERROR_MESSAGES } = require('../constants/messages');
const LanguageDetector = require('../utils/languageDetector');

class ExpenseService {
  constructor() {
    this.googleSheetService = new GoogleSheetService();
  }

  /**
   * 新增記帳記錄（從解析後的資料）
   * @param {Object} parsedData - 解析後的記帳資料
   * @param {string} language - 語言代碼
   * @returns {Promise<string>} 回應訊息
   */
  async addExpenseRecord(parsedData, language = 'zh') {
    try {
      let { item, amount, note, dateOffset } = parsedData;

      // 項目名稱統一處理（日文轉中文）
      item = CATEGORY_MAPPING[item] || item;

      // 計算實際日期
      const targetDate = DateHelper.getTargetDate(dateOffset);
      const sheetName = DateHelper.formatDate(targetDate, 'YYYY-MM');
      const dateStr = DateHelper.formatDate(targetDate, 'MM/DD');

      // 準備記帳資料
      const recordData = {
        date: dateStr,
        item: item,
        amount: amount,
        note: note || ''
      };

      // 加入記帳資料到 Google Sheets
      await this.googleSheetService.addExpenseRecord(sheetName, recordData);

      // 獲取預算資訊並計算剩餘
      const budgetInfo = await this.calculateBudgetRemaining(language);
      
      // 組合基本回應
      const dateLabel = DateHelper.getDateLabel(dateOffset, language);
      
      let response;
      if (language === 'ja') {
        response = `✅ 記録完了！\n日付：${dateStr}（${dateLabel}）\n項目：${item}\n金額：${amount.toLocaleString('ja-JP')}円\n備考：${note}`;
      } else {
        response = `✅ 記帳成功！\n日期：${dateStr}（${dateLabel}）\n項目：${item}\n金額：${amount.toLocaleString('zh-TW')}円\n備註：${note}`;
      }

      // 添加預算資訊
      if (budgetInfo.hasBudget) {
        response += '\n\n' + budgetInfo.message;
      }

      return response;

    } catch (error) {
      console.error('新增記帳記錄時發生錯誤:', error);
      return LanguageDetector.getMessage('EXPENSE_ADD_ERROR', ERROR_MESSAGES, language);
    }
  }

  /**
   * 設定月度預算
   * @param {string} messageText - 原始訊息文本
   * @param {string} language - 語言代碼
   * @returns {Promise<string>} 回應訊息
   */
  async setBudget(messageText, language = 'zh') {
    try {
      // 提取預算金額
      const budgetMatch = messageText.match(/(\d+)/);
      
      if (!budgetMatch) {
        return LanguageDetector.getMessage('BUDGET_FORMAT_HINT', ERROR_MESSAGES, language);
      }

      const budgetAmount = parseInt(budgetMatch[1]);
      const sheetName = DateHelper.getCurrentMonthSheetName();

      // 設定預算到 Google Sheets
      await this.googleSheetService.setBudgetRecord(sheetName, budgetAmount);

      // 計算當前剩餘預算
      const remaining = await this.calculateBudgetRemaining(language);

      if (language === 'ja') {
        return `💰 今月の予算を${budgetAmount.toLocaleString('ja-JP')}円に設定しました！\n\n${remaining.message}`;
      } else {
        return `💰 本月預算已設定為 ${budgetAmount.toLocaleString('zh-TW')} 円！\n\n${remaining.message}`;
      }

    } catch (error) {
      console.error('設定預算時發生錯誤:', error);
      return LanguageDetector.getMessage('BUDGET_SET_ERROR', ERROR_MESSAGES, language);
    }
  }

  /**
   * 獲取預算資訊
   * @param {string} language - 語言代碼
   * @returns {Promise<string>} 預算資訊訊息
   */
  async getBudgetInfo(language = 'zh') {
    try {
      const budgetInfo = await this.calculateBudgetRemaining(language);
      return budgetInfo.message;
    } catch (error) {
      console.error('獲取預算資訊時發生錯誤:', error);
      return language === 'ja' ? 
        '予算情報の取得に失敗しました' : 
        '無法獲取預算資訊';
    }
  }

  /**
   * 計算剩餘預算
   * @param {string} language - 語言代碼
   * @returns {Promise<Object>} 預算資訊物件
   */
  async calculateBudgetRemaining(language = 'zh') {
    try {
      const sheetName = DateHelper.getCurrentMonthSheetName();
      const rows = await this.googleSheetService.getSheetRecords(sheetName);

      if (rows.length === 0) {
        return {
          hasBudget: false,
          message: language === 'ja' ? 
            'まだ予算が設定されていません。「予算設定 金額」で設定してください' : 
            '尚未設定預算，請使用「設定預算 金額」來設定'
        };
      }

      // 尋找預算設定
      const budgetRow = rows.find(row => row.get('項目') === '月度預算');
      if (!budgetRow) {
        return {
          hasBudget: false,
          message: language === 'ja' ? 
            'まだ予算が設定されていません。「予算設定 金額」で設定してください' : 
            '尚未設定預算，請使用「設定預算 金額」來設定'
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
      const remainingDays = DateHelper.getRemainingDaysInMonth();
      const dailyAllowance = remainingDays > 0 ? Math.floor(remaining / remainingDays) : 0;

      // 構建預算資訊訊息
      let message;
      if (language === 'ja') {
        message = `📊 今月の予算状況：\n`;
        message += `予算：${budget.toLocaleString('ja-JP')}円\n`;
        message += `支出：${totalExpense.toLocaleString('ja-JP')}円（${usagePercentage}%）\n`;
        message += `残額：${remaining.toLocaleString('ja-JP')}円\n`;
        message += `残り${remainingDays}日、一日当たり：${dailyAllowance.toLocaleString('ja-JP')}円`;
      } else {
        message = `📊 本月預算狀況：\n`;
        message += `預算：${budget.toLocaleString('zh-TW')} 円\n`;
        message += `支出：${totalExpense.toLocaleString('zh-TW')} 円（${usagePercentage}%）\n`;
        message += `餘額：${remaining.toLocaleString('zh-TW')} 円\n`;
        message += `剩餘 ${remainingDays} 天，每日可用：${dailyAllowance.toLocaleString('zh-TW')} 円`;
      }

      // 預算警告
      if (remaining < 0) {
        message += language === 'ja' ? '\n⚠️ 予算をオーバーしています！' : '\n⚠️ 預算已超支！';
      } else if (usagePercentage >= 80) {
        message += language === 'ja' ? '\n⚠️ 予算の80%を使用しました' : '\n⚠️ 已使用 80% 預算';
      }

      return {
        hasBudget: true,
        budget: budget,
        totalExpense: totalExpense,
        remaining: remaining,
        usagePercentage: parseFloat(usagePercentage),
        dailyAllowance: dailyAllowance,
        message: message
      };

    } catch (error) {
      console.error('計算預算剩餘時發生錯誤:', error);
      return {
        hasBudget: false,
        message: language === 'ja' ? 
          '予算情報の取得に失敗しました' : 
          '無法獲取預算資訊'
      };
    }
  }

  /**
   * 獲取月度統計報告
   * @param {string} language - 語言代碼
   * @returns {Promise<string>} 統計報告訊息
   */
  async getMonthlyReport(language = 'zh') {
    try {
      const sheetName = DateHelper.getCurrentMonthSheetName();
      const rows = await this.googleSheetService.getSheetRecords(sheetName);

      if (rows.length === 0) {
        return language === 'ja' ? 
          '今月の記録がありません' : 
          '本月尚無記錄';
      }

      // 統計各分類支出
      const categoryStats = {};
      let totalExpense = 0;
      let recordCount = 0;

      rows.forEach(row => {
        const item = row.get('項目');
        const amount = parseFloat(row.get('金額'));
        
        if (item !== '月度預算' && !isNaN(amount)) {
          categoryStats[item] = (categoryStats[item] || 0) + amount;
          totalExpense += amount;
          recordCount++;
        }
      });

      // 排序分類（由大到小）
      const sortedCategories = Object.entries(categoryStats)
        .sort(([,a], [,b]) => b - a);

      // 構建報告
      let report;
      if (language === 'ja') {
        report = `📈 ${DateHelper.getCurrentMonthSheetName()} 支出レポート\n\n`;
        report += `総支出：${totalExpense.toLocaleString('ja-JP')}円\n`;
        report += `記録数：${recordCount}件\n`;
        report += `平均：${Math.round(totalExpense / recordCount).toLocaleString('ja-JP')}円/件\n\n`;
        report += `📊 カテゴリ別：\n`;
        
        sortedCategories.forEach(([category, amount]) => {
          const percentage = ((amount / totalExpense) * 100).toFixed(1);
          report += `• ${category}：${amount.toLocaleString('ja-JP')}円 (${percentage}%)\n`;
        });
      } else {
        report = `📈 ${DateHelper.getCurrentMonthSheetName()} 支出報告\n\n`;
        report += `總支出：${totalExpense.toLocaleString('zh-TW')} 円\n`;
        report += `記錄數：${recordCount} 筆\n`;
        report += `平均：${Math.round(totalExpense / recordCount).toLocaleString('zh-TW')} 円/筆\n\n`;
        report += `📊 分類統計：\n`;
        
        sortedCategories.forEach(([category, amount]) => {
          const percentage = ((amount / totalExpense) * 100).toFixed(1);
          report += `• ${category}：${amount.toLocaleString('zh-TW')} 円 (${percentage}%)\n`;
        });
      }

      // 添加預算資訊
      const budgetInfo = await this.calculateBudgetRemaining(language);
      if (budgetInfo.hasBudget) {
        report += '\n' + budgetInfo.message;
      }

      return report;

    } catch (error) {
      console.error('獲取月度報告時發生錯誤:', error);
      return language === 'ja' ? 
        'レポートの生成に失敗しました' : 
        '產生報告時發生錯誤';
    }
  }
}

module.exports = ExpenseService;
