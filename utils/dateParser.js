// utils/dateParser.js
class DateParser {
  constructor(language = 'zh') {
    this.language = language;
  }

  /**
   * 解析日期時間文字
   * @param {string} text - 輸入文字
   * @param {string} defaultType - 預設類型
   * @returns {Object} 解析結果
   */
  parseDateTime(text, defaultType = 'once') {
    const result = {
      success: false,
      datetime: null,
      type: defaultType,
      interval: null,
      remainingText: text
    };

    try {
      // 相對時間解析
      const relativeResult = this.parseRelativeTime(text);
      if (relativeResult.success) {
        result.success = true;
        result.datetime = relativeResult.datetime;
        result.remainingText = relativeResult.remainingText;
        return result;
      }

      // 絕對時間解析
      const absoluteResult = this.parseAbsoluteTime(text);
      if (absoluteResult.success) {
        result.success = true;
        result.datetime = absoluteResult.datetime;
        result.remainingText = absoluteResult.remainingText;
        return result;
      }

      // 時間點解析（僅時間，無日期）
      const timeResult = this.parseTimeOnly(text);
      if (timeResult.success) {
        result.success = true;
        result.datetime = timeResult.datetime;
        result.remainingText = timeResult.remainingText;
        return result;
      }

    } catch (error) {
      console.error('日期解析錯誤:', error);
    }

    return result;
  }

  /**
   * 解析相對時間（明天、下週等）
   */
  parseRelativeTime(text) {
    const result = {
      success: false,
      datetime: null,
      remainingText: text
    };

    const now = new Date();
    let targetDate = new Date(now);
    let matched = false;
    let matchText = '';

    if (this.language === 'ja') {
      // 日文相對時間
      const patterns = [
        { regex: /今日(\s*(\d{1,2})[時:](\d{1,2})[分:]?)?/g, offset: 0, unit: 'day' },
        { regex: /明日(\s*(\d{1,2})[時:](\d{1,2})[分:]?)?/g, offset: 1, unit: 'day' },
        { regex: /明後日(\s*(\d{1,2})[時:](\d{1,2})[分:]?)?/g, offset: 2, unit: 'day' },
        { regex: /来週(\s*(\d{1,2})[時:](\d{1,2})[分:]?)?/g, offset: 7, unit: 'day' },
        { regex: /再来週(\s*(\d{1,2})[時:](\d{1,2})[分:]?)?/g, offset: 14, unit: 'day' },
        { regex: /来月(\s*(\d{1,2})日)?(\s*(\d{1,2})[時:](\d{1,2})[分:]?)?/g, offset: 1, unit: 'month' },
        { regex: /(\d+)日後(\s*(\d{1,2})[時:](\d{1,2})[分:]?)?/g, offset: 0, unit: 'custom_day' },
        { regex: /(\d+)時間後/g, offset: 0, unit: 'hour' },
        { regex: /(\d+)分後/g, offset: 0, unit: 'minute' }
      ];
