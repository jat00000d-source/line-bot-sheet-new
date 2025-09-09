// utils/dateParser.js - 完整版日期解析器
class DateParser {
  constructor(language = 'zh') {
    this.language = language;
  }

  /**
   * 主要解析方法
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
      // 1. 相對時間解析（明天、下週等）
      const relativeResult = this.parseRelativeTime(text);
      if (relativeResult.success) {
        result.success = true;
        result.datetime = relativeResult.datetime;
        result.remainingText = relativeResult.remainingText;
        return result;
      }

      // 2. 絕對時間解析（具體日期）
      const absoluteResult = this.parseAbsoluteTime(text);
      if (absoluteResult.success) {
        result.success = true;
        result.datetime = absoluteResult.datetime;
        result.remainingText = absoluteResult.remainingText;
        return result;
      }

      // 3. 時間點解析（僅時間，無日期）
      const timeResult = this.parseTimeOnly(text);
      if (timeResult.success) {
        result.success = true;
        result.datetime = timeResult.datetime;
        result.remainingText = timeResult.remainingText;
        return result;
      }

      // 4. 週期性任務解析
      const recurringResult = this.parseRecurring(text);
      if (recurringResult.success) {
        result.success = true;
        result.datetime = recurringResult.datetime;
        result.type = 'recurring';
        result.interval = recurringResult.interval;
        result.remainingText = recurringResult.remainingText;
        return result;
      }

    } catch (error) {
      console.error('日期解析錯誤:', error);
    }

    return result;
  }

  /**
   * 解析相對時間
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

    // 相對時間模式
    const patterns = [
      // 基本相對時間
      { regex: /今天(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, offset: 0, unit: 'day' },
      { regex: /明天(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, offset: 1, unit: 'day' },
      { regex: /後天(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, offset: 2, unit: 'day' },
      { regex: /大後天(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, offset: 3, unit: 'day' },
      
      // 週相關
      { regex: /下週(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, offset: 7, unit: 'day' },
      { regex: /下下週(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, offset: 14, unit: 'day' },
      
      // 月相關
      { regex: /下個?月(\s*(\d{1,2})[號日])?(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, offset: 1, unit: 'month' },
      { regex: /下下個?月(\s*(\d{1,2})[號日])?(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, offset: 2, unit: 'month' },
      
      // 自定義天數
      { regex: /(\d+)天後(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, offset: 0, unit: 'custom_day' },
      { regex: /(\d+)[個]?小時後/g, offset: 0, unit: 'hour' },
      { regex: /(\d+)[個]?分鐘?後/g, offset: 0, unit: 'minute' },
      
      // 星期
      { regex: /下週?([一二三四五六日天])(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, offset: 0, unit: 'weekday' }
    ];

    for (let pattern of patterns) {
      pattern.regex.lastIndex = 0;
      const match = pattern.regex.exec(text);
      if (match) {
        matched = true;
        matchText = match[0];
        
        switch (pattern.unit) {
          case 'day':
            targetDate.setDate(targetDate.getDate() + pattern.offset);
            if (match[2] && match[3]) {
              targetDate.setHours(parseInt(match[2]), parseInt(match[3]), 0, 0);
            } else {
              targetDate.setHours(9, 0, 0, 0);
            }
            break;
            
          case 'month':
            targetDate.setMonth(targetDate.getMonth() + pattern.offset);
            if (match[2]) {
              targetDate.setDate(parseInt(match[2]));
            }
            if (match[4] && match[5]) {
              targetDate.setHours(parseInt(match[4]), parseInt(match[5]), 0, 0);
            } else {
              targetDate.setHours(9, 0, 0, 0);
            }
            break;
            
          case 'custom_day':
            const days = parseInt(match[1]);
            targetDate.setDate(targetDate.getDate() + days);
            if (match[3] && match[4]) {
              targetDate.setHours(parseInt(match[3]), parseInt(match[4]), 0, 0);
            } else {
              targetDate.setHours(9, 0, 0, 0);
            }
            break;
            
          case 'hour':
            const hours = parseInt(match[1]);
            targetDate.setHours(targetDate.getHours() + hours);
            break;
            
          case 'minute':
            const minutes = parseInt(match[1]);
            targetDate.setMinutes(targetDate.getMinutes() + minutes);
            break;
            
          case 'weekday':
            const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
            const targetWeekday = weekdays.indexOf(match[1]);
            const currentWeekday = targetDate.getDay();
            let daysUntilTarget = (targetWeekday - currentWeekday + 7) % 7;
            if (daysUntilTarget === 0) daysUntilTarget = 7; // 下週同一天
            
            targetDate.setDate(targetDate.getDate() + daysUntilTarget);
            if (match[3] && match[4]) {
              targetDate.setHours(parseInt(match[3]), parseInt(match[4]), 0, 0);
            } else {
              targetDate.setHours(9, 0, 0, 0);
            }
            break;
        }
        break;
      }
    }

    if (matched) {
      result.success = true;
      result.datetime = targetDate.toISOString();
      result.remainingText = text.replace(matchText, '').trim();
    }

    return result;
  }

  /**
   * 解析絕對時間
   */
  parseAbsoluteTime(text) {
    const result = {
      success: false,
      datetime: null,
      remainingText: text
    };

    const now = new Date();
    let matched = false;
    let matchText = '';
    let targetDate = new Date(now);

    // 絕對時間模式
    const patterns = [
      // 完整日期時間
      {
        regex: /(\d{4})年(\d{1,2})月(\d{1,2})[日號]\s*(上午|下午)?(\d{1,2})[點時:](\d{1,2})[分:]?/g,
        type: 'full_date_time'
      },
      // 月日時間
      {
        regex: /(\d{1,2})月(\d{1,2})[日號]\s*(上午|下午)?(\d{1,2})[點時:](\d{1,2})[分:]?/g,
        type: 'month_day_time'
      },
      // 月日（僅到小時）
      {
        regex: /(\d{1,2})月(\d{1,2})[日號]\s*(上午|下午)?(\d{1,2})[點時]/g,
        type: 'month_day_hour'
      },
      // 日期時間
      {
        regex: /(\d{1,2})[日號]\s*(上午|下午)?(\d{1,2})[點時:](\d{1,2})[分:]?/g,
        type: 'day_time'
      },
      // 完整日期（無時間）
      {
        regex: /(\d{4})年(\d{1,2})月(\d{1,2})[日號]/g,
        type: 'full_date'
      },
      // 月日（無時間）
      {
        regex: /(\d{1,2})月(\d{1,2})[日號](?!\s*\d)/g,
        type: 'month_day'
      },
      // 短格式日期時間 (M/D H:M)
      {
        regex: /(\d{1,2})[\/\-](\d{1,2})\s*(上午|下午)?(\d{1,2})[點時:](\d{1,2})[分:]?/g,
        type: 'short_date_time'
      },
      // 短格式日期（無時間）
      {
        regex: /(\d{1,2})[\/\-](\d{1,2})(?!\s*\d)/g,
        type: 'short_date'
      }
    ];

    for (let pattern of patterns) {
      pattern.regex.lastIndex = 0;
      const match = pattern.regex.exec(text);
      if (match) {
        matched = true;
        matchText = match[0];
        
        let hour, minute;
        
        switch (pattern.type) {
          case 'full_date_time':
            hour = parseInt(match[5]);
            minute = parseInt(match[6]);
            if (match[4] === '下午' && hour < 12) hour += 12;
            if (match[4] === '上午' && hour === 12) hour = 0;
            
            targetDate = new Date(
              parseInt(match[1]),
              parseInt(match[2]) - 1,
              parseInt(match[3]),
              hour, minute, 0, 0
            );
            break;
            
          case 'month_day_time':
            const month = parseInt(match[1]);
            const day = parseInt(match[2]);
            hour = parseInt(match[4]);
            minute = parseInt(match[5]) || 0;
            
            if (match[3] === '下午' && hour < 12) hour += 12;
            if (match[3] === '上午' && hour === 12) hour = 0;
            
            targetDate = new Date(
              now.getFullYear(),
              month - 1,
              day,
              hour, minute, 0, 0
            );
            
            // 如果日期已過，設為明年
            if (targetDate <= now) {
              targetDate.setFullYear(targetDate.getFullYear() + 1);
            }
            break;

          case 'month_day_hour':
            const monthH = parseInt(match[1]);
            const dayH = parseInt(match[2]);
            hour = parseInt(match[4]);
            
            if (match[3] === '下午' && hour < 12) hour += 12;
            if (match[3] === '上午' && hour === 12) hour = 0;
            
            targetDate = new Date(
              now.getFullYear(),
              monthH - 1,
              dayH,
              hour, 0, 0, 0
            );
            
            if (targetDate <= now) {
              targetDate.setFullYear(targetDate.getFullYear() + 1);
            }
            break;
            
          case 'day_time':
            const dayOnly = parseInt(match[1]);
            hour = parseInt(match[3]);
            minute = parseInt(match[4]) || 0;
            if (match[2] === '下午' && hour < 12) hour += 12;
            if (match[2] === '上午' && hour === 12) hour = 0;
            
            targetDate = new Date(
              now.getFullYear(),
              now.getMonth(),
              dayOnly,
              hour, minute, 0, 0
            );
            
            // 如果日期已過，設為下個月
            if (targetDate <= now || targetDate.getDate() !== dayOnly) {
              targetDate.setMonth(targetDate.getMonth() + 1);
              targetDate.setDate(dayOnly);
            }
            break;
            
          case 'full_date':
            targetDate = new Date(
              parseInt(match[1]),
              parseInt(match[2]) - 1,
              parseInt(match[3]),
              9, 0, 0, 0
            );
            break;
            
          case 'month_day':
            const mdMonth = parseInt(match[1]);
            const mdDay = parseInt(match[2]);
            
            targetDate = new Date(
              now.getFullYear(),
              mdMonth - 1,
              mdDay,
              9, 0, 0, 0
            );
            
            if (targetDate <= now) {
              targetDate.setFullYear(targetDate.getFullYear() + 1);
            }
            break;
            
          case 'short_date_time':
            const shortMonth = parseInt(match[1]);
            const shortDay = parseInt(match[2]);
            hour = parseInt(match[4]);
            minute = parseInt(match[5]) || 0;
            
            if (match[3] === '下午' && hour < 12) hour += 12;
            if (match[3] === '上午' && hour === 12) hour = 0;
            
            targetDate = new Date(
              now.getFullYear(),
              shortMonth - 1,
              shortDay,
              hour, minute, 0, 0
            );
            
            if (targetDate <= now) {
              targetDate.setFullYear(targetDate.getFullYear() + 1);
            }
            break;
            
          case 'short_date':
            const sdMonth = parseInt(match[1]);
            const sdDay = parseInt(match[2]);
            
            targetDate = new Date(
              now.getFullYear(),
              sdMonth - 1,
              sdDay,
              9, 0, 0, 0
            );
            
            if (targetDate <= now) {
              targetDate.setFullYear(targetDate.getFullYear() + 1);
            }
            break;
        }
        break;
      }
    }

    if (matched) {
      result.success = true;
      result.datetime = targetDate.toISOString();
      result.remainingText = text.replace(matchText, '').trim();
    }

    return result;
  }

  /**
   * 解析時間（僅時間，預設為今天）
   */
  parseTimeOnly(text) {
    const result = {
      success: false,
      datetime: null,
      remainingText: text
    };

    const now = new Date();
    let matched = false;
    let matchText = '';
    let targetDate = new Date(now);

    const patterns = [
      // 基本時間格式
      /(\d{1,2})[點時:](\d{1,2})[分:]?/g,
      // 上午/下午格式
      /(上午|下午)(\d{1,2})[點時:](\d{1,2})[分:]?/g,
      // 時段格式
      /(早上|中午|下午|晚上)(\d{1,2})[點時:](\d{1,2})[分:]?/g,
      // 僅小時
      /(\d{1,2})[點時]/g,
      // 上午/下午僅小時
      /(上午|下午)(\d{1,2})[點時]/g
    ];

    for (let pattern of patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (match) {
        matched = true;
        matchText = match[0];
        
        let hour, minute = 0;
        
        if (match.length === 3) {
          // 基本格式 HH:MM 或僅 HH
          hour = parseInt(match[1]);
          minute = parseInt(match[2]) || 0;
        } else if (match.length === 4) {
          // 上午/下午格式
          hour = parseInt(match[2]);
          minute = parseInt(match[3]) || 0;
          
          const period = match[1];
          if (period === '下午' && hour < 12) hour += 12;
          if (period === '上午' && hour === 12) hour = 0;
          if (period === '晚上' && hour < 12) hour += 12;
          if (period === '中午' && hour === 12) hour = 12;
          if (period === '早上' && hour >= 6 && hour < 12) hour = hour;
          if (period === '早上' && hour < 6) hour += 6;
        }
        
        targetDate.setHours(hour, minute, 0, 0);
        
        // 如果時間已過，設為明天
        if (targetDate <= now) {
          targetDate.setDate(targetDate.getDate() + 1);
        }
        break;
      }
    }

    if (matched) {
      result.success = true;
      result.datetime = targetDate.toISOString();
      result.remainingText = text.replace(matchText, '').trim();
    }

    return result;
  }

  /**
   * 解析週期性任務
   */
  parseRecurring(text) {
    const result = {
      success: false,
      datetime: null,
      interval: null,
      remainingText: text
    };

    const now = new Date();
    let matched = false;
    let matchText = '';
    let targetDate = new Date(now);

    // 週期性模式
    const patterns = [
      { regex: /每天(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, interval: 'daily' },
      { regex: /每週(\s*([一二三四五六日天]))?(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, interval: 'weekly' },
      { regex: /每月(\s*(\d{1,2})[號日])?(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, interval: 'monthly' },
      { regex: /每年(\s*(\d{1,2})月(\d{1,2})[日號])?(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, interval: 'yearly' }
    ];

    for (let pattern of patterns) {
      pattern.regex.lastIndex = 0;
      const match = pattern.regex.exec(text);
      if (match) {
        matched = true;
        matchText = match[0];
        
        // 設定預設時間
        targetDate.setHours(9, 0, 0, 0);
        
        switch (pattern.interval) {
          case 'daily':
            if (match[2] && match[3]) {
              targetDate.setHours(parseInt(match[2]), parseInt(match[3]), 0, 0);
            }
            if (targetDate <= now) {
              targetDate.setDate(targetDate.getDate() + 1);
            }
            break;
            
          case 'weekly':
            if (match[2]) {
              const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
              const targetWeekday = weekdays.indexOf(match[2]);
              const currentWeekday = targetDate.getDay();
              let daysUntilTarget = (targetWeekday - currentWeekday + 7) % 7;
              if (daysUntilTarget === 0 && targetDate <= now) daysUntilTarget = 7;
              
              targetDate.setDate(targetDate.getDate() + daysUntilTarget);
            }
            if (match[4] && match[5]) {
              targetDate.setHours(parseInt(match[4]), parseInt(match[5]), 0, 0);
            }
            break;
            
          case 'monthly':
            if (match[2]) {
              targetDate.setDate(parseInt(match[2]));
            }
            if (match[4] && match[5]) {
              targetDate.setHours(parseInt(match[4]), parseInt(match[5]), 0, 0);
            }
            if (targetDate <= now) {
              targetDate.setMonth(targetDate.getMonth() + 1);
            }
            break;
            
          case 'yearly':
            if (match[2] && match[3]) {
              targetDate.setMonth(parseInt(match[2]) - 1, parseInt(match[3]));
            }
            if (match[5] && match[6]) {
              targetDate.setHours(parseInt(match[5]), parseInt(match[6]), 0, 0);
            }
            if (targetDate <= now) {
              targetDate.setFullYear(targetDate.getFullYear() + 1);
            }
            break;
        }
        
        result.interval = pattern.interval;
        break;
      }
    }

    if (matched) {
      result.success = true;
      result.datetime = targetDate.toISOString();
      result.remainingText = text.replace(matchText, '').trim();
    }

    return result;
  }
}

module.exports = DateParser;
