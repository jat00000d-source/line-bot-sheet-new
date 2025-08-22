// controllers/expenseController.js
const ExpenseService = require('../services/expenseService');
const ExpenseParser = require('../parsers/expenseParser');
const LanguageDetector = require('../utils/languageDetector');

class ExpenseController {
  constructor() {
    this.expenseService = new ExpenseService();
    this.expenseParser = new ExpenseParser();
  }

  /**
   * 處理記帳相關指令
   * @param {Object} parsedCommand - 解析後的指令物件
   * @returns {Promise<string>} 回應訊息
   */
  async handleExpense(parsedCommand) {
    const { commandType, language, originalMessage } = parsedCommand;
    
    try {
      switch (commandType) {
        case 'expense_summary':
          return await this.expenseService.getMonthlyExpenseSummary(language);
        
        case 'expense':
          // 需要先解析記帳資料
          const parseResult = this.expenseParser.parseNaturalLanguage(originalMessage, language);
          if (!parseResult.success) {
            return parseResult.error;
          }
          return await this.expenseService.addExpenseRecord(parseResult, language);
        
        case 'set_budget':
          return await this.expenseService.setBudget(originalMessage, language);
        
        case 'budget':
        case 'remaining':
          return await this.expenseService.getBudgetInfo(language);
        
        default:
          return language === 'ja' ? 
            '記帳機能：未対応のコマンドです' : 
            '記帳功能：不支援的指令';
      }
    } catch (error) {
      console.error('記帳控制器處理錯誤:', error);
      return language === 'ja' ? 
        'システムエラーが発生しました' : 
        '系統發生錯誤';
    }
  }

  /**
   * 檢查是否為記帳相關指令
   * @param {string} message - 輸入訊息
   * @returns {boolean} 是否為記帳指令
   */
  isExpenseCommand(message) {
    const language = LanguageDetector.detectLanguage(message);
    
    // 檢查是否為自然語言記帳格式
    const parseResult = this.expenseParser.parseNaturalLanguage(message, language);
    return parseResult.success;
  }

  /**
   * 取得記帳功能說明
   * @param {string} language - 語言代碼
   * @returns {string} 說明訊息
   */
  getHelpMessage(language = 'zh') {
    if (language === 'ja') {
      return `📝 記帳ボット使用説明\n\n` +
             `💡 記帳形式：\n` +
             `【従来形式】\n` +
             `項目　金額　[備考]（全角スペース対応）\n` +
             `項目 金額 [備考]（半角スペース対応）\n\n` +
             `【自然言語形式】NEW！\n` +
             `• 昨日ランチ100円食べた\n` +
             `• 今日コーヒー85円\n` +
             `• 交通費150\n` +
             `• 午餐100元（中国語もOK）\n\n` +
             `💰 予算管理：NEW！\n` +
             `• 予算設定 50000 （月度予算設定）\n` +
             `• 予算 （予算状況確認）\n` +
             `• 残り （残額確認）\n\n` +
             `📌 例：\n` +
             `• 昼食　150\n` +
             `• コーヒー　85　スターバックス\n` +
             `• 昨天午餐吃了200\n` +
             `• 前天買咖啡花80\n\n` +
             `📊 まとめ確認：\n` +
             `「集計」で今月の支出を確認\n\n` +
             `✨ 特長：\n` +
             `• 月度予算設定・管理\n` +
             `• 自動で残額・使用率計算\n` +
             `• 1日使用可能金額表示\n` +
             `• 予算警告機能\n` +
             `• 全角・半角スペース対応\n` +
             `• 自然言語理解\n` +
             `• 中国語・日本語対応`;
    } else {
      return `📝 記帳機器人使用說明\n\n` +
             `💡 記帳格式：\n` +
             `【傳統格式】\n` +
             `項目　金額　[備註]（支援全形空格）\n` +
             `項目 金額 [備註]（支援半形空格）\n\n` +
             `【自然語言格式】全新功能！\n` +
             `• 昨天午餐吃了100元\n` +
             `• 今天咖啡85円\n` +
             `• 交通費150\n` +
             `• ランチ200（日文也可以）\n\n` +
             `💰 預算管理：全新功能！\n` +
             `• 設定預算 50000 （設定月度預算）\n` +
             `• 預算 （查看預算狀況）\n` +
             `• 剩餘 （查看剩餘金額）\n\n` +
             `📌 範例：\n` +
             `• 午餐　150\n` +
             `• 咖啡　85　星巴克\n` +
             `• 昨天買東西花了200\n` +
             `• 前天搭車用50\n\n` +
             `📊 查看總結：\n` +
             `輸入「總結」查看本月支出\n\n` +
             `✨ 特色功能：\n` +
             `• 月度預算設定與管理\n` +
             `• 自動計算剩餘金額與使用率\n` +
             `• 每日可用金額顯示\n` +
             `• 預算警告提醒功能\n` +
             `• 支援全形、半形空格\n` +
             `• 自然語言理解\n` +
             `• 支援中日雙語指令`;
    }
  }
}

module.exports = ExpenseController;
