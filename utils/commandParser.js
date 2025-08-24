// utils/commandParser.js
const { COMMAND_MAPPING, COMMAND_TYPES } = require('../constants/commands');
const { ERROR_MESSAGES, PROMPT_MESSAGES } = require('../constants/messages');
const LanguageDetector = require('./languageDetector');

class CommandParser {
  /**
   * 解析輸入指令
   * @param {string} message - 用戶輸入訊息
   * @returns {Object} 解析結果
   */
  static parseCommand(message) {
    if (!message || typeof message !== 'string') {
      return { success: false, error: '輸入訊息無效' };
    }

    const trimmedMessage = message.trim();
    const language = LanguageDetector.detectLanguage(trimmedMessage);

    try {
      // 1. 檢查是否為預定義指令
      const predefinedCommand = this.parsePredefinedCommand(trimmedMessage, language);
      if (predefinedCommand.success) return predefinedCommand;

      // 2. 檢查是否為預算設定格式
      const budgetCommand = this.parseBudgetCommand(trimmedMessage, language);
      if (budgetCommand.success) return budgetCommand;

      // 3. 嘗試解析為記帳資料
      const expenseCommand = this.parseExpenseCommand(trimmedMessage, language);
      if (expenseCommand.success) return expenseCommand;

      // 4. 無法識別的指令
      return {
        success: false,
        language,
        error: LanguageDetector.getMessage('INPUT_FORMAT_HINT', PROMPT_MESSAGES, language)
      };

    } catch (error) {
      console.error('指令解析錯誤:', error);
      return {
        success: false,
        language,
        error: LanguageDetector.getMessage('SYSTEM_ERROR', ERROR_MESSAGES, language)
      };
    }
  }

  /** 預定義指令解析 */
  static parsePredefinedCommand(message, language) {
    const commandType = COMMAND_MAPPING[message];
    if (commandType) {
      return { success: true, commandType, language, originalMessage: message };
    }
    return { success: false };
  }

  /** 預算設定指令解析 */
  static parseBudgetCommand(message, language) {
    const patterns = [
      /^設定預算[\s　]+(\d+)/,
      /^預算設定[\s　]+(\d+)/,
      /^予算設定[\s　]+(\d+)/,
      /^予算[\s　]+(\d+)/,
      /^預算[\s　]+(\d+)/
    ];

    for (let pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          success: true,
          commandType: COMMAND_TYPES.SET_BUDGET,
          language,
          originalMessage: message,
          budgetAmount: parseInt(match[1], 10)
        };
      }
    }

    return { success: false };
  }

  /** 記帳指令解析（先留空，之後接 ExpenseParser） */
  static parseExpenseCommand(message, language) {
    return { success: false };
  }
}

module.exports = CommandParser;
