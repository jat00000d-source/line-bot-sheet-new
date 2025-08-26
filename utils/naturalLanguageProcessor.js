// utils/naturalLanguageProcessor.js
const LanguageDetector = require('./languageDetector');

class NaturalLanguageProcessor {
  /**
   * 解析自然語言的記帳輸入
   * @param {string} message - 使用者輸入
   * @param {string} language - 指定語言 ('zh' | 'ja')，可選
   * @returns {Object} { success, item, amount, language, error? }
   */
  parseNaturalLanguage(message, language = null) {
    if (!message || typeof message !== 'string') {
      return { success: false, error: '輸入無效' };
    }

    // 自動偵測語言（如果未指定）
    if (!language) {
      language = LanguageDetector.detectLanguage(message);
    }

    const trimmed = message.trim();

    // === 支援格式: 「品項 金額」 ===
    // 例子: 午餐 200 / 交通 500 / ランチ 500 / 電車 300
    const expensePattern = /^(.+?)[\s　]+(\d+)$/; // 支援全形空格
    const match = trimmed.match(expensePattern);

    if (match) {
      return {
        success: true,
        category: 'expense',
        item: match[1].trim(),
        amount: parseInt(match[2], 10),
        language
      };
    }

    // === 支援格式: 「金額 品項」 ===
    // 例子: 200 午餐 / 500 ランチ
    const reversePattern = /^(\d+)[\s　]+(.+)$/;
    const reverseMatch = trimmed.match(reversePattern);

    if (reverseMatch) {
      return {
        success: true,
        category: 'expense',
        item: reverseMatch[2].trim(),
        amount: parseInt(reverseMatch[1], 10),
        language
      };
    }

    // === 未匹配 ===
    return {
      success: false,
      error: language === 'ja'
        ? '入力を解析できませんでした。例：「ランチ 500」'
        : '無法解析輸入，範例：「午餐 200」'
    };
  }
}

module.exports = NaturalLanguageProcessor;
