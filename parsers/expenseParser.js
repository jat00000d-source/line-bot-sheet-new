// parsers/expenseParser.js
const { CATEGORY_MAPPING } = require('../constants/commands');
const { ERROR_MESSAGES } = require('../constants/messages');
const LanguageDetector = require('../utils/languageDetector');

class ExpenseParser {
  constructor() {
    // 將原 NaturalLanguageProcessor 的屬性移到這裡
    this.amountKeywords = ['元', '円', '圓', '塊', '錢', '用了', '花了', '花費', '支出', '費用'];
    
    // 日期相關的關鍵詞
    this.dateKeywords = {
      '今天': 0,
      '昨天': -1,
      '前天': -2,
      '大前天': -3,
      '今日': 0,
      '昨日': -1,
      '一昨日': -2
    };
    
    // 常見動詞
    this.actionVerbs = ['吃', '買', '喝', '花', '用', '搭', '坐', '看', '玩'];
  }

  /**
   * 智能解析自然語言輸入
   * @param {string} message - 用戶輸入訊息
   * @param {string} language - 語言代碼
   * @returns {Object} 解析結果
   */
  parseNaturalLanguage(message, language) {
    try {
      console.log('記帳解析 - 原始輸入:', message);
      
      // 首先嘗試傳統格式解析（支援全形空格）
      const traditionalResult = this.parseTraditionalFormat(message);
      if (traditionalResult.success) {
        console.log('記帳解析 - 傳統格式解析成功:', traditionalResult);
        return traditionalResult;
      }
      
      // 自然語言解析
      const nlResult = this.parseNaturalText(message, language);
      console.log('記帳解析 - 自然語言解析結果:', nlResult);
      return nlResult;
      
    } catch (error) {
      console.error('記帳解析錯誤:', error);
      return {
        success: false,
        error: LanguageDetector.getMessage('PARSE_ERROR', ERROR_MESSAGES, language)
      };
    }
  }

  /**
   * 解析傳統格式（支援全形和半形空格）
   * @param {string} message - 訊息內容
   * @returns {Object} 解析結果
   */
  parseTraditionalFormat(message) {
    // 同時支援全形空格（　）和半形空格（ ）
    const parts = message.split(/[\s　]+/).filter(part => part.length > 0);
    
    if (parts.length >= 2) {
      const firstPart = parts[0];
      const secondPart = parts[1];
      
      // 檢查第二部分是否為純數字
      const amount = this.extractAmount(secondPart);
      if (amount !== null) {
        return {
          success: true,
          item: firstPart,
          amount: amount,
          note: parts.slice(2).join(' ') || '',
          date: null // 使用今天日期
        };
      }
      
      // 檢查第一部分是否為純數字
      const amountFirst = this.extractAmount(firstPart);
      if (amountFirst !== null) {
        return {
          success: true,
          item: secondPart,
          amount: amountFirst,
          note: parts.slice(2).join(' ') || '',
          date: null
        };
      }
    }
    
    return { success: false };
  }

  /**
   * 解析自然語言文本
   * @param {string} message - 訊息內容
   * @param {string} language - 語言代碼
   * @returns {Object} 解析結果
   */
  parseNaturalText(message, language) {
    let item = null;
    let amount = null;
    let dateOffset = 0; // 相對今天的天數差
    let note = '';
    
    // 提取金額
    amount = this.extractAmountFromText(message);
    if (amount === null) {
      return {
        success: false,
        error: LanguageDetector.getMessage('INVALID_AMOUNT', ERROR_MESSAGES, language)
      };
    }
    
    // 提取日期偏移
    dateOffset = this.extractDateOffset(message);
    
    // 提取項目
    item = this.extractItemFromText(message, language);
    if (!item) {
      return {
        success: false,
        error: LanguageDetector.getMessage('INVALID_ITEM', ERROR_MESSAGES, language)
      };
    }
    
    // 提取備註（移除已識別的部分）
    note = this.extractNote(message, item, amount, dateOffset);
    
    return {
      success: true,
      item: item,
      amount: amount,
      note: note,
      dateOffset: dateOffset
    };
  }

  /**
   * 從文本中提取金額
   * @param {string} text - 輸入文本
   * @returns {number|null} 金額或null
   */
  extractAmountFromText(text) {
    // 匹配各種金額格式
    const patterns = [
      /(\d+(?:\.\d+)?)\s*[元円圓塊錢]/g,  // 100元, 150円
      /[元円圓塊錢]\s*(\d+(?:\.\d+)?)/g,  // 元100, 円150
      /(?:花了?|用了?|費用|支出|花費)\s*(\d+(?:\.\d+)?)/g, // 花了100
      /(\d+(?:\.\d+)?)\s*(?:花了?|用了?)/g, // 100花了
      /(?:^|\s)(\d+(?:\.\d+)?)(?=\s|[^.\d]|$)/g  // 單純的數字
    ];
    
    for (let pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        const amount = parseFloat(matches[0][1]);
        if (!isNaN(amount) && amount > 0) {
          return amount;
        }
      }
    }
    
    return null;
  }

  /**
   * 從純數字字串提取金額
   * @param {string} str - 輸入字串
   * @returns {number|null} 金額或null
   */
  extractAmount(str) {
    // 移除貨幣符號
    const cleaned = str.replace(/[元円圓塊錢]/g, '');
    const amount = parseFloat(cleaned);
    return (!isNaN(amount) && amount > 0) ? amount : null;
  }

  /**
   * 提取日期偏移
   * @param {string} text - 輸入文本
   * @returns {number} 日期偏移量
   */
  extractDateOffset(text) {
    for (let [keyword, offset] of Object.entries(this.dateKeywords)) {
      if (text.includes(keyword)) {
        return offset;
      }
    }
    return 0; // 預設今天
  }

  /**
   * 從文本中提取項目
   * @param {string} message - 訊息內容
   * @param {string} language - 語言代碼
   * @returns {string|null} 項目名稱
   */
  extractItemFromText(message, language) {
    // 先檢查是否有明確的類別關鍵詞
    for (let [key, value] of Object.entries(CATEGORY_MAPPING)) {
      if (message.includes(key)) {
        return value;
      }
    }
    
    // 嘗試從上下文推斷
    const contextPatterns = {
      // 餐食相關
      '午餐': ['午餐', '中餐', '午飯', 'ランチ', '昼食', '昼飯'],
      '晚餐': ['晚餐', '晚飯', '夕食', '夜食', '夕飯', '晩御飯'],
      '早餐': ['早餐', '早飯', '朝食', '朝飯'],
      '咖啡': ['咖啡', 'コーヒー', '珈琲', '拿鐵', 'ラテ'],
      
      // 交通相關
      '交通': ['電車', '巴士', '公車', '計程車', 'タクシー', 'バス', '地鐵', '捷運'],
      
      // 購物相關
      '購物': ['買', '購買', 'ショッピング', '買い物'],
      
      // 娛樂相關
      '娛樂': ['電影', '遊戲', 'ゲーム', '映画', '唱歌', 'カラオケ']
    };
    
    for (let [category, keywords] of Object.entries(contextPatterns)) {
      for (let keyword of keywords) {
        if (message.includes(keyword)) {
          return category;
        }
      }
    }
    
    // 如果都找不到，嘗試提取第一個可能的名詞
    const words = message.replace(/[\d\s元円圓塊錢花了用了昨天今天前天]/g, '').trim();
    if (words.length > 0) {
      // 取前幾個字符作為項目名
      return words.substring(0, Math.min(words.length, 4));
    }
    
    return language === 'ja' ? 'その他' : '其他';
  }

  /**
   * 提取備註
   * @param {string} originalText - 原始文本
   * @param {string} item - 項目名稱
   * @param {number} amount - 金額
   * @param {number} dateOffset - 日期偏移
   * @returns {string} 備註內容
   */
  extractNote(originalText, item, amount, dateOffset) {
    let note = originalText;
    
    // 移除已識別的部分
    note = note.replace(new RegExp(item, 'g'), '');
    note = note.replace(/\d+(?:\.\d+)?[元円圓塊錢]?/g, '');
    note = note.replace(/[元円圓塊錢]/g, '');
    note = note.replace(/(?:花了?|用了?|費用|支出|花費)/g, '');
    note = note.replace(/(?:今天|昨天|前天|大前天|今日|昨日|一昨日)/g, '');
    note = note.replace(/(?:吃|買|喝|花|用|搭|坐|看|玩)/g, '');
    
    // 清理空格和標點
    note = note.replace(/[\s　，,。.！!？?]+/g, ' ').trim();
    
    return note || '';
  }
}

module.exports = ExpenseParser;
