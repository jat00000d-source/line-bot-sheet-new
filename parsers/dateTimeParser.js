// parsers/dateTimeParser.js
// 中日文日期時間解析核心系統

const { 
  TIME_PATTERNS, 
  TIME_KEYWORDS, 
  REPEAT_TYPES, 
  TIMEZONE,
  VALIDATION_RULES,
  ERROR_TYPES 
} = require('../constants/dateTimeConstants');
const LanguageParser = require('./languageParser');

class DateTimeParser {
  constructor() {
    this.languageParser = new LanguageParser();
    this.timezone = TIMEZONE;
  }

  /**
   * 解析日期時間字符串
   * @param {string} text - 輸入文本
   * @param {Date} baseDate - 基準日期，預設為當前時間
   * @returns {Object} 解析結果
   */
  parse(text, baseDate = new Date()) {
    try {
      const normalizedText = this.languageParser.normalizeText(text);
      const languageInfo = this.languageParser.detectLanguage(normalizedText);
      
      const result = {
        original: text,
        normalized: normalizedText,
        language: languageInfo,
        datetime: null,
        repeatType: REPEAT_TYPES.NONE,
        repeatInterval: null,
        isValid: false,
        error: null,
        confidence: 0
      };

      // 根據語言選擇解析策略
      switch (languageInfo.primary) {
        case 'chinese':
          return this._parseChineseDateTime(result, baseDate);
        case 'japanese':
          return this._parseJapaneseDateTime(result, baseDate);
        default:
          // 嘗試通用解析
          return this._parseUniversalDateTime(result, baseDate);
      }
    } catch (error) {
      return {
        original: text,
        isValid: false,
        error: ERROR_TYPES.INVALID_TIME_FORMAT,
        details: error.message
      };
    }
  }

  /**
   * 解析中文日期時間
   * @private
   */
  _parseChineseDateTime(result, baseDate) {
    const { normalized } = result;
    
    // 解析時間部分
    const timeInfo = this._parseChineseTime(normalized, baseDate);
    
    // 解析日期部分
    const dateInfo = this._parseChineseDate(normalized, baseDate);
    
    // 解析重複模式
    const repeatInfo = this._parseChineseRepeat(normalized);
    
    // 組合結果
    if (timeInfo.found || dateInfo.found) {
      const combinedDateTime = this._combineDateTime(dateInfo, timeInfo, baseDate);
      
      result.datetime = combinedDateTime;
      result.repeatType = repeatInfo.type;
      result.repeatInterval = repeatInfo.interval;
      result.isValid = this._validateDateTime(combinedDateTime);
      result.confidence = this._calculateConfidence(timeInfo, dateInfo, repeatInfo);
    }

    return result;
  }

  /**
   * 解析中文時間
   * @private
   */
  _parseChineseTime(text, baseDate) {
    const patterns = TIME_PATTERNS.chinese.absoluteTime;
    const keywords = TIME_KEYWORDS.chinese;
    
    let hour = null;
    let minute = 0;
    let found = false;
    let period = null; // 上午/下午/晚上

    // 嘗試各種時間格式
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        found = true;
        
        if (pattern.source.includes('上午')) {
          period = 'morning';
          hour = parseInt(match[1]);
          minute = match[2] ? parseInt(match[2]) : 0;
        } else if (pattern.source.includes('下午')) {
          period = 'afternoon';
          hour = parseInt(match[1]) + (parseInt(match[1]) < 12 ? 12 : 0);
          minute = match[2] ? parseInt(match[2]) : 0;
        } else if (pattern.source.includes('晚上')) {
          period = 'evening';
          hour = parseInt(match[1]) + (parseInt(match[1]) < 12 ? 12 : 0);
          minute = match[2] ? parseInt(match[2]) : 0;
        } else if (pattern.source.includes(':')) {
          // HH:MM 格式
          hour = parseInt(match[1]);
          minute = parseInt(match[2]);
        } else {
          // 純數字格式
          hour = parseInt(match[1]);
          minute = match[2] ? parseInt(match[2]) : 0;
        }
        break;
      }
    }

    // 檢查相對時間詞彙
    if (!found) {
      // 檢查是否有相對時間關鍵字
      for (const [keyword, offset] of Object.entries(keywords.relative)) {
        if (text.includes(keyword)) {
          found = true;
          const targetDate = new Date(baseDate);
          targetDate.setDate(targetDate.getDate() + offset);
          hour = targetDate.getHours();
          minute = targetDate.getMinutes();
          break;
        }
      }
    }

    return {
      found,
      hour,
      minute,
      period,
      confidence: found ? 0.8 : 0
    };
  }

  /**
   * 解析中文日期
   * @private
   */
  _parseChineseDate(text, baseDate) {
    const patterns = TIME_PATTERNS.chinese.dateFormats;
    const keywords = TIME_KEYWORDS.chinese;
    
    let year = null;
    let month = null;
    let day = null;
    let found = false;
    let isRelative = false;

    // 嘗試絕對日期格式
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        found = true;
        
        if (match.length === 4) {
          // YYYY-MM-DD 格式
          year = parseInt(match[1]);
          month = parseInt(match[2]);
          day = parseInt(match[3]);
        } else if (match.length === 3) {
          // MM-DD 格式
          year = baseDate.getFullYear();
          month = parseInt(match[1]);
          day = parseInt(match[2]);
        } else if (match.length === 2) {
          // DD 格式（號）
          year = baseDate.getFullYear();
          month = baseDate.getMonth() + 1;
          day = parseInt(match[1]);
        }
        break;
      }
    }

    // 檢查相對日期
    if (!found) {
      for (const [keyword, offset] of Object.entries(keywords.relative)) {
        if (text.includes(keyword)) {
          found = true;
          isRelative = true;
          const targetDate = new Date(baseDate);
          targetDate.setDate(targetDate.getDate() + offset);
          year = targetDate.getFullYear();
          month = targetDate.getMonth() + 1;
          day = targetDate.getDate();
          break;
        }
      }
    }

    // 檢查星期
    if (!found) {
      for (const [weekday, weekdayNum] of Object.entries(keywords.weekdays)) {
        if (text.includes(weekday)) {
          found = true;
          isRelative = true;
          const targetDate = this._getNextWeekday(baseDate, weekdayNum);
          year = targetDate.getFullYear();
          month = targetDate.getMonth() + 1;
          day = targetDate.getDate();
          break;
        }
      }
    }

    // 檢查「下週」、「下個月」等
    if (text.includes('下週') || text.includes('下星期')) {
      const weekdayMatch = text.match(/(?:下週|下星期)([一二三四五六日天])/);
      if (weekdayMatch) {
        found = true;
        isRelative = true;
        const weekdayName = '星期' + weekdayMatch[1];
        const weekdayNum = keywords.weekdays[weekdayName];
        if (weekdayNum !== undefined) {
          const targetDate = this._getNextWeekday(baseDate, weekdayNum, 1); // 下週
          year = targetDate.getFullYear();
          month = targetDate.getMonth() + 1;
          day = targetDate.getDate();
        }
      }
    }

    if (text.includes('下個月') || text.includes('下月')) {
      const dayMatch = text.match(/(?:下個月|下月)(\d{1,2})[號日]/);
      if (dayMatch) {
        found = true;
        isRelative = true;
        const targetDate = new Date(baseDate);
        targetDate.setMonth(targetDate.getMonth() + 1);
        targetDate.setDate(parseInt(dayMatch[1]));
        year = targetDate.getFullYear();
        month = targetDate.getMonth() + 1;
        day = targetDate.getDate();
      }
    }

    return {
      found,
      year,
      month,
      day,
      isRelative,
      confidence: found ? 0.8 : 0
    };
  }

  /**
   * 解析中文重複模式
   * @private
   */
  _parseChineseRepeat(text) {
    const patterns = TIME_PATTERNS.chinese.repeatPatterns;
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const matchedText = match[0];
        
        if (matchedText.includes('每天') || matchedText.includes('每日')) {
          return { type: REPEAT_TYPES.DAILY, interval: 1 };
        } else if (matchedText.includes('每週') || matchedText.includes('每星期') || matchedText.includes('每禮拜')) {
          return { type: REPEAT_TYPES.WEEKLY, interval: 1 };
        } else if (matchedText.includes('每月') || matchedText.includes('每個月')) {
          return { type: REPEAT_TYPES.MONTHLY, interval: 1 };
        } else if (matchedText.includes('每年') || matchedText.includes('每一年')) {
          return { type: REPEAT_TYPES.YEARLY, interval: 1 };
        } else if (match[1]) {
          // 自定義間隔
          const interval = parseInt(match[1]);
          if (matchedText.includes('天')) {
            return { type: REPEAT_TYPES.CUSTOM, interval, unit: 'days' };
          } else if (matchedText.includes('週')) {
            return { type: REPEAT_TYPES.CUSTOM, interval, unit: 'weeks' };
          } else if (matchedText.includes('月')) {
            return { type: REPEAT_TYPES.CUSTOM, interval, unit: 'months' };
          }
        }
      }
    }

    return { type: REPEAT_TYPES.NONE, interval: null };
  }

  /**
   * 解析日文日期時間
   * @private
   */
  _parseJapaneseDateTime(result, baseDate) {
    const { normalized } = result;
    
    // 解析時間部分
    const timeInfo = this._parseJapaneseTime(normalized, baseDate);
    
    // 解析日期部分
    const dateInfo = this._parseJapaneseDate(normalized, baseDate);
    
    // 解析重複模式
    const repeatInfo = this._parseJapaneseRepeat(normalized);
    
    // 組合結果
    if (timeInfo.found || dateInfo.found) {
      const combinedDateTime = this._combineDateTime(dateInfo, timeInfo, baseDate);
      
      result.datetime = combinedDateTime;
      result.repeatType = repeatInfo.type;
      result.repeatInterval = repeatInfo.interval;
      result.isValid = this._validateDateTime(combinedDateTime);
      result.confidence = this._calculateConfidence(timeInfo, dateInfo, repeatInfo);
    }

    return result;
  }

  /**
   * 解析日文時間
   * @private
   */
  _parseJapaneseTime(text, baseDate) {
    const patterns = TIME_PATTERNS.japanese.absoluteTime;
    const keywords = TIME_KEYWORDS.japanese;
    
    let hour = null;
    let minute = 0;
    let found = false;
    let period = null;

    // 嘗試各種時間格式
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        found = true;
        
        if (pattern.source.includes('午前')) {
          period = 'morning';
          hour = parseInt(match[1]);
          minute = match[2] ? parseInt(match[2]) : 0;
        } else if (pattern.source.includes('午後')) {
          period = 'afternoon';
          hour = parseInt(match[1]) + (parseInt(match[1]) < 12 ? 12 : 0);
          minute = match[2] ? parseInt(match[2]) : 0;
        } else if (pattern.source.includes('夜')) {
          period = 'evening';
          hour = parseInt(match[1]) + (parseInt(match[1]) < 12 ? 12 : 0);
          minute = match[2] ? parseInt(match[2]) : 0;
        } else {
          // 純數字格式
          hour = parseInt(match[1]);
          minute = match[2] ? parseInt(match[2]) : 0;
        }
        break;
      }
    }

    return {
      found,
      hour,
      minute,
      period,
      confidence: found ? 0.8 : 0
    };
  }

  /**
   * 解析日文日期
   * @private
   */
  _parseJapaneseDate(text, baseDate) {
    const patterns = TIME_PATTERNS.japanese.dateFormats;
    const keywords = TIME_KEYWORDS.japanese;
    
    let year = null;
    let month = null;
    let day = null;
    let found = false;
    let isRelative = false;

    // 嘗試絕對日期格式
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        found = true;
        
        if (match.length === 4) {
          // YYYY年MM月DD日
          year = parseInt(match[1]);
          month = parseInt(match[2]);
          day = parseInt(match[3]);
        } else if (match.length === 3) {
          // MM月DD日
          year = baseDate.getFullYear();
          month = parseInt(match[1]);
          day = parseInt(match[2]);
        } else if (match.length === 2) {
          // DD日
          year = baseDate.getFullYear();
          month = baseDate.getMonth() + 1;
          day = parseInt(match[1]);
        }
        break;
      }
    }

    // 檢查相對日期
    if (!found) {
      for (const [keyword, offset] of Object.entries(keywords.relative)) {
        if (text.includes(keyword)) {
          found = true;
          isRelative = true;
          const targetDate = new Date(baseDate);
          targetDate.setDate(targetDate.getDate() + offset);
          year = targetDate.getFullYear();
          month = targetDate.getMonth() + 1;
          day = targetDate.getDate();
          break;
        }
      }
    }

    // 檢查曜日
    if (!found) {
      for (const [weekday, weekdayNum] of Object.entries(keywords.weekdays)) {
        if (text.includes(weekday)) {
          found = true;
          isRelative = true;
          const targetDate = this._getNextWeekday(baseDate, weekdayNum);
          year = targetDate.getFullYear();
          month = targetDate.getMonth() + 1;
          day = targetDate.getDate();
          break;
        }
      }
    }

    // 檢查「来週」、「来月」等
    if (text.includes('来週') || text.includes('らいしゅう')) {
      const weekdayMatch = text.match(/(?:来週|らいしゅう)([月火水木金土日])曜?/);
      if (weekdayMatch) {
        found = true;
        isRelative = true;
        const weekdayName = weekdayMatch[1] + '曜日';
        const weekdayNum = keywords.weekdays[weekdayName];
        if (weekdayNum !== undefined) {
          const targetDate = this._getNextWeekday(baseDate, weekdayNum, 1);
          year = targetDate.getFullYear();
          month = targetDate.getMonth() + 1;
          day = targetDate.getDate();
        }
      }
    }

    if (text.includes('来月') || text.includes('らいげつ')) {
      const dayMatch = text.match(/(?:来月|らいげつ)(\d{1,2})日/);
      if (dayMatch) {
        found = true;
        isRelative = true;
        const targetDate = new Date(baseDate);
        targetDate.setMonth(targetDate.getMonth() + 1);
        targetDate.setDate(parseInt(dayMatch[1]));
        year = targetDate.getFullYear();
        month = targetDate.getMonth() + 1;
        day = targetDate.getDate();
      }
    }

    return {
      found,
      year,
      month,
      day,
      isRelative,
      confidence: found ? 0.8 : 0
    };
  }

  /**
   * 解析日文重複模式
   * @private
   */
  _parseJapaneseRepeat(text) {
    const patterns = TIME_PATTERNS.japanese.repeatPatterns;
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const matchedText = match[0];
        
        if (matchedText.includes('毎日') || matchedText.includes('まいにち')) {
          return { type: REPEAT_TYPES.DAILY, interval: 1 };
        } else if (matchedText.includes('毎週') || matchedText.includes('まいしゅう')) {
          return { type: REPEAT_TYPES.WEEKLY, interval: 1 };
        } else if (matchedText.includes('毎月') || matchedText.includes('まいつき')) {
          return { type: REPEAT_TYPES.MONTHLY, interval: 1 };
        } else if (matchedText.includes('毎年') || matchedText.includes('まいとし') || matchedText.includes('まいねん')) {
          return { type: REPEAT_TYPES.YEARLY, interval: 1 };
        } else if (match[1]) {
          const interval = parseInt(match[1]);
          if (matchedText.includes('日毎')) {
            return { type: REPEAT_TYPES.CUSTOM, interval, unit: 'days' };
          } else if (matchedText.includes('週間毎')) {
            return { type: REPEAT_TYPES.CUSTOM, interval, unit: 'weeks' };
          } else if (matchedText.includes('ヶ月毎')) {
            return { type: REPEAT_TYPES.CUSTOM, interval, unit: 'months' };
          }
        }
      }
    }

    return { type: REPEAT_TYPES.NONE, interval: null };
  }

  /**
   * 通用日期時間解析（當語言不明確時）
   * @private
   */
  _parseUniversalDateTime(result, baseDate) {
    // 先嘗試中文解析
    const chineseResult = this._parseChineseDateTime(result, baseDate);
    if (chineseResult.isValid && chineseResult.confidence > 0.5) {
      return chineseResult;
    }

    // 再嘗試日文解析
    const japaneseResult = this._parseJapaneseDateTime(result, baseDate);
    if (japaneseResult.isValid && japaneseResult.confidence > 0.5) {
      return japaneseResult;
    }

    // 嘗試基本數字格式解析
    const basicResult = this._parseBasicDateTime(result, baseDate);
    return basicResult;
  }

  /**
   * 基本數字格式解析
   * @private
   */
  _parseBasicDateTime(result, baseDate) {
    const { normalized } = result;
    
    // 時間格式 HH:MM
    const timeMatch = normalized.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = parseInt(timeMatch[2]);
      
      if (this._isValidTime(hour, minute)) {
        const datetime = new Date(baseDate);
        datetime.setHours(hour, minute, 0, 0);
        
        result.datetime = datetime;
        result.isValid = true;
        result.confidence = 0.7;
      }
    }

    // 日期格式 YYYY-MM-DD 或 MM-DD
    const dateMatch = normalized.match(/(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})-(\d{1,2})/);
    if (dateMatch) {
      let year, month, day;
      
      if (dateMatch[1]) {
        // YYYY-MM-DD
        year = parseInt(dateMatch[1]);
        month = parseInt(dateMatch[2]);
        day = parseInt(dateMatch[3]);
      } else {
        // MM-DD
        year = baseDate.getFullYear();
        month = parseInt(dateMatch[4]);
        day = parseInt(dateMatch[5]);
      }

      if (this._isValidDate(year, month, day)) {
        result.datetime = new Date(year, month - 1, day);
        result.isValid = true;
        result.confidence = 0.6;
      }
    }

    return result;
  }

  /**
   * 組合日期和時間
   * @private
   */
  _combineDateTime(dateInfo, timeInfo, baseDate) {
    let targetDate = new Date(baseDate);

    // 設定日期
    if (dateInfo.found) {
      if (dateInfo.year) targetDate.setFullYear(dateInfo.year);
      if (dateInfo.month) targetDate.setMonth(dateInfo.month - 1);
      if (dateInfo.day) targetDate.setDate(dateInfo.day);
    }

    // 設定時間
    if (timeInfo.found) {
      if (timeInfo.hour !== null) targetDate.setHours(timeInfo.hour);
      if (timeInfo.minute !== null) targetDate.setMinutes(timeInfo.minute);
      targetDate.setSeconds(0);
      targetDate.setMilliseconds(0);
    }

    return targetDate;
  }

  /**
   * 獲取下個指定星期幾的日期
   * @private
   */
  _getNextWeekday(baseDate, targetWeekday, weeksOffset = 0) {
    const currentWeekday = baseDate.getDay();
    const daysUntilTarget = (targetWeekday - currentWeekday + 7) % 7;
    const daysToAdd = daysUntilTarget === 0 ? 7 : daysUntilTarget; // 如果是同一天，則選擇下週
    
    const result = new Date(baseDate);
    result.setDate(result.getDate() + daysToAdd + (weeksOffset * 7));
    
    return result;
  }

  /**
   * 驗證日期時間
   * @private
   */
  _validateDateTime(datetime) {
    if (!datetime || !(datetime instanceof Date) || isNaN(datetime.getTime())) {
      return false;
    }

    // 檢查是否為過去時間
    const now = new Date();
    if (datetime <= now) {
      return false;
    }

    return true;
  }

  /**
   * 驗證時間格式
   * @private
   */
  _isValidTime(hour, minute) {
    return hour >= VALIDATION_RULES.VALID_HOURS.min && 
           hour <= VALIDATION_RULES.VALID_HOURS.max &&
           minute >= VALIDATION_RULES.VALID_MINUTES.min && 
           minute <= VALIDATION_RULES.VALID_MINUTES.max;
  }

  /**
   * 驗證日期格式
   * @private
   */
  _isValidDate(year, month, day) {
    return year >= 2024 && year <= 2030 &&
           month >= VALIDATION_RULES.VALID_MONTHS.min && 
           month <= VALIDATION_RULES.VALID_MONTHS.max &&
           day >= VALIDATION_RULES.VALID_DAYS.min && 
           day <= VALIDATION_RULES.VALID_DAYS.max;
  }

  /**
   * 計算解析信心度
   * @private
   */
  _calculateConfidence(timeInfo, dateInfo, repeatInfo) {
    let confidence = 0;
    
    if (timeInfo.found) confidence += timeInfo.confidence * 0.4;
    if (dateInfo.found) confidence += dateInfo.confidence * 0.4;
    if (repeatInfo.type !== REPEAT_TYPES.NONE) confidence += 0.2;
    
    return Math.min(1, confidence);
  }

  /**
   * 格式化日期時間為可讀字符串
   * @param {Date} datetime - 日期時間對象
   * @param {string} language - 語言 ('chinese' | 'japanese')
   * @returns {string} 格式化的字符串
   */
  formatDateTime(datetime, language = 'chinese') {
    if (!datetime || !(datetime instanceof Date)) {
      return '';
    }

    const year = datetime.getFullYear();
    const month = datetime.getMonth() + 1;
    const day = datetime.getDate();
    const hour = datetime.getHours();
    const minute = datetime.getMinutes();

    if (language === 'japanese') {
      return `${year}年${month}月${day}日 ${hour}時${minute.toString().padStart(2, '0')}分`;
    } else {
      return `${year}年${month}月${day}日 ${hour}點${minute.toString().padStart(2, '0')}分`;
    }
  }
}

module.exports = DateTimeParser;
