// utils/languageDetector.js
const { LANGUAGE_KEYWORDS } = require('../constants/commands');

class LanguageDetector {
  /**
   * 檢測訊息的語言
   * @param {string} message - 輸入訊息
   * @returns {string} 'zh' 或 'ja'
   */
  static detectLanguage(message) {
    if (!message || typeof message !== 'string') {
      return 'zh'; // 預設中文
    }

    const text = message.trim();
    
    // 檢查日文平假名、片假名字符
    const japaneseChars = /[\u3040-\u309F\u30A0-\u30FF]/;
    const hasJapaneseChars = japaneseChars.test(text);
    
    // 檢查日文關鍵詞
    const hasJapaneseKeyword = LANGUAGE_KEYWORDS.japanese.some(keyword => 
      text.includes(keyword)
    );
    
    // 如果有日文字符或關鍵詞，判定為日文
    if (hasJapaneseChars || hasJapaneseKeyword) {
      return 'ja';
    }
    
    // 否則預設為中文
    return 'zh';
  }
  
  /**
   * 檢查是否為純日文輸入
   * @param {string} message - 輸入訊息
   * @returns {boolean}
   */
  static isJapanese(message) {
    return this.detectLanguage(message) === 'ja';
  }
  
  /**
   * 檢查是否為純中文輸入
   * @param {string} message - 輸入訊息
   * @returns {boolean}
   */
  static isChinese(message) {
    return this.detectLanguage(message) === 'zh';
  }
  
  /**
   * 取得對應語言的訊息
   * @param {string} messageKey - 訊息鍵值
   * @param {Object} messages - 訊息物件（包含 zh 和 ja）
   * @param {string} language - 語言代碼
   * @returns {string}
   */
  static getMessage(messageKey, messages, language = 'zh') {
    return messages[language]?.[messageKey] || messages['zh']?.[messageKey] || messageKey;
  }
}

module.exports = LanguageDetector;
