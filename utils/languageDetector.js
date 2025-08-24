// utils/languageDetector.js
class LanguageDetector {
  /**
   * 偵測文字語言
   * @param {string} text - 使用者輸入訊息
   * @returns {string} 'zh' | 'ja' | 'unknown'
   */
  static detectLanguage(text) {
    if (!text) return 'unknown';

    // 日文 (平假名、片假名)
    if (/[\u3040-\u30ff\u31f0-\u31ff]/.test(text)) return 'ja';
    
    // 中文 (CJK Unified Ideographs)
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';

    return 'unknown';
  }

  /**
   * 根據語言回傳提示訊息
   * @param {string} key - message key
   * @param {Object} messages - 各語言訊息集合
   * @param {string} language - 語言代碼
   * @returns {string} 對應訊息
   */
  static getMessage(key, messages, language) {
    if (messages[key] && messages[key][language]) {
      return messages[key][language];
    }
    // fallback: 中文訊息
    return messages[key] ? messages[key]['zh'] : '未知錯誤';
  }
}

module.exports = LanguageDetector;
