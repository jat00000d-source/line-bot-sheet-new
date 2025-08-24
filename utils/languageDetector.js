// utils/languageDetector.js

class LanguageDetector {
  /**
   * 偵測訊息語言
   * @param {string} message - 訊息文本
   * @returns {string} 語言代碼 ('zh', 'ja', 'en')
   */
  static detectLanguage(message) {
    // 日文檢測（平假名、片假名、漢字）
    const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    
    // 中文檢測（繁體中文常用字）
    const chinesePattern = /[一-龯]/;
    
    // 英文檢測
    const englishPattern = /^[a-zA-Z\s\d\.,!?'"()-]+$/;
    
    if (japanesePattern.test(message)) {
      // 進一步判斷是否為日文（包含假名）
      const hiraganaKatakana = /[\u3040-\u309F\u30A0-\u30FF]/;
      if (hiraganaKatakana.test(message)) {
        return 'ja';
      }
    }
    
    if (chinesePattern.test(message)) {
      return 'zh';
    }
    
    if (englishPattern.test(message)) {
      return 'en';
    }
    
    // 預設返回中文
    return 'zh';
  }

  /**
   * 從訊息物件中獲取對應語言的訊息
   * @param {string} key - 訊息鍵值
   * @param {Object} messages - 訊息物件
   * @param {string} language - 語言代碼
   * @returns {string} 對應語言的訊息
   */
  static getMessage(key, messages, language = 'zh') {
    if (messages && messages[key] && messages[key][language]) {
      return messages[key][language];
    }
    
    // 如果找不到對應語言，嘗試返回中文
    if (messages && messages[key] && messages[key].zh) {
      return messages[key].zh;
    }
    
    // 如果都找不到，返回鍵值本身
    return key;
  }

  /**
   * 檢查是否為日文輸入
   * @param {string} text - 文本
   * @returns {boolean} 是否為日文
   */
  static isJapanese(text) {
    const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF]/;
    return japanesePattern.test(text);
  }

  /**
   * 檢查是否為中文輸入
   * @param {string} text - 文本
   * @returns {boolean} 是否為中文
   */
  static isChinese(text) {
    const chinesePattern = /[一-龯]/;
    return chinesePattern.test(text);
  }

  /**
   * 檢查是否為英文輸入
   * @param {string} text - 文本
   * @returns {boolean} 是否為英文
   */
  static isEnglish(text) {
    const englishPattern = /^[a-zA-Z\s\d\.,!?'"()-]+$/;
    return englishPattern.test(text);
  }
}

module.exports = LanguageDetector;
