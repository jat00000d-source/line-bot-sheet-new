// utils/dateParser.js - 保守修正版本（保留所有原有功能）
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

      for (let pattern of patterns) {
        pattern.regex.lastIndex = 0; // 重置正則表達式狀態
        const match = pattern.regex.exec(text);
        if (match) {
          matched = true;
          matchText = match[0];
          
          switch (pattern.unit) {
            case 'day':
              targetDate.setDate(targetDate.getDate() + pattern.offset);
              // 解析時間
              if (match[2] && match[3]) {
                targetDate.setHours(parseInt(match[2]), parseInt(match[3]), 0, 0);
              } else {
                targetDate.setHours(9, 0, 0, 0); // 預設上午9點
              }
              break;
            case 'month':
              targetDate.setMonth(targetDate.getMonth() + pattern.offset);
              if (match[2]) { // 指定日期
                targetDate.setDate(parseInt(match[2]));
              }
              if (match[4] && match[5]) { // 指定時間
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
          }
          break;
        }
      }
    } else {
      // 中文相對時間
      const patterns = [
        { regex: /今天(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, offset: 0, unit: 'day' },
        { regex: /明天(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, offset: 1, unit: 'day' },
        { regex: /後天(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, offset: 2, unit: 'day' },
        { regex: /下週(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, offset: 7, unit: 'day' },
        { regex: /下下週(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, offset: 14, unit: 'day' },
        { regex: /下個?月(\s*(\d{1,2})[號日])?(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, offset: 1, unit: 'month' },
        { regex: /(\d+)天後(\s*(\d{1,2})[點時:](\d{1,2})[分:]?)?/g, offset: 0, unit: 'custom_day' },
        { regex: /(\d+)[個]?小時後/g, offset: 0, unit: 'hour' },
        { regex: /(\d+)[個]?分鐘?後/g, offset: 0, unit: 'minute' }
      ];

      for (let pattern of patterns) {
        pattern.regex.lastIndex = 0; // 重置正則表達式狀態
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
          }
          break;
        }
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
   * 解析絕對時間（具體日期） - 只修正關鍵bug
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

    if (this.language === 'ja') {
      // 日文絕對時間模式
      const patterns = [
        // 2024年12月25日 15:30
        /(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2})[時:](\d{1,2})[分:]?/g,
        // 12月25日 15:30
        /(\d{1,2})月(\d{1,2})日\s*(\d{1,2})[時:](\d{1,2})[分:]?/g,
        // 25日 15:30
        /(\d{1,2})日\s*(\d{1,2})[時:](\d{1,2})[分:]?/g
      ];

      for (let pattern of patterns) {
        pattern.lastIndex = 0; // 重置正則表達式狀態
        const match = pattern.exec(text);
        if (match) {
          matched = true;
          matchText = match[0];
          
          if (match.length === 6) {
            // 包含年份
            targetDate = new Date(
              parseInt(match[1]), 
              parseInt(match[2]) - 1, 
              parseInt(match[3]),
              parseInt(match[4]),
              parseInt(match[5]),
              0, 0
            );
          } else if (match.length === 5) {
            // 不包含年份，使用當年
            targetDate = new Date(
              now.getFullYear(),
              parseInt(match[1]) - 1,
              parseInt(match[2]),
              parseInt(match[3]),
              parseInt(match[4]),
              0, 0
            );
            // 如果日期已過，則設定為明年
            if (targetDate < now) {
              targetDate.setFullYear(targetDate.getFullYear() + 1);
            }
          } else if (match.length === 4) {
            // 僅日期和時間
            const day = parseInt(match[1]);
            const hour = parseInt(match[2]);
            const minute = parseInt(match[3]);
            
            // 先嘗試當前月份
            targetDate = new Date(
              now.getFullYear(),
              now.getMonth(),
              day,
              hour,
              minute,
              0, 0
            );
            
            // 檢查該日期是否有效且未過期
            if (targetDate.getDate() !== day || targetDate < now) {
              // 如果日期無效或已過期，嘗試下個月
              targetDate = new Date(
                now.getFullYear(),
                now.getMonth() + 1,
                day,
                hour,
                minute,
                0, 0
              );
              
              // 如果下個月也無效，嘗試明年同月
              if (targetDate.getDate() !== day) {
                targetDate = new Date(
                  now.getFullYear() + 1,
                  now.getMonth(),
                  day,
                  hour,
                  minute,
                  0, 0
                );
              }
            }
          }
          break;
        }
      }
    } else {
      // 中文絕對時間模式
      const patterns = [
        // 2024年12月25日 下午3:30
        /(\d{4})年(\d{1,2})月(\d{1,2})[日號]\s*(上午|下午)?(\d{1,2})[點時:](\d{1,2})[分:]?/g,
        // 12月25日 下午3:30 或 12月25號9點
        /(\d{1,2})月(\d{1,2})[日號]\s*(上午|下午)?(\d{1,2})[點時:](\d{1,2})[分:]?/g,
        // 25日 下午3:30 或 25號 下午3:30
        /(\d{1,2})[日號]\s*(上午|下午)?(\d{1,2})[點時:](\d{1,2})[分:]?/g
      ];

      for (let pattern of patterns) {
        pattern.lastIndex = 0; // 重置正則表達式狀態 - 關鍵修正！
        const match = pattern.exec(text);
        if (match) {
          matched = true;
          matchText = match[0];
          
          let hour, minute;
          if (match.length === 7) {
            // 包含年份
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
          } else if (match.length === 6) {
            // 不包含年份，包含月份 - 關鍵修正！
            const month = parseInt(match[1]);
            const day = parseInt(match[2]);
            hour = parseInt(match[4]);
            minute = parseInt(match[5]) || 0; // 提供預設值
            
            if (match[3] === '下午' && hour < 12) hour += 12;
            if (match[3] === '上午' && hour === 12) hour = 0;
            
            // 先嘗試當年的該月份
            targetDate = new Date(
              now.getFullYear(),
              month - 1, // JavaScript 月份從0開始
              day,
              hour, minute, 0, 0
            );
            
            // 如果日期已過，設定為明年
            if (targetDate < now) {
              targetDate.setFullYear(targetDate.getFullYear() + 1);
            }
            
          } else if (match.length === 5) {
            // 僅日期和時間
            const day = parseInt(match[1]);
            hour = parseInt(match[3]);
            minute = parseInt(match[4]) || 0;
            if (match[2] === '下午' && hour < 12) hour += 12;
            if (match[2] === '上午' && hour === 12) hour = 0;
            
            // 先嘗試當前月份
            targetDate = new Date(
              now.getFullYear(),
              now.getMonth(),
              day,
              hour, minute, 0, 0
            );
            
            // 檢查該日期是否有效且未過期
            if (targetDate.getDate() !== day || targetDate < now) {
              // 如果日期無效或已過期，嘗試下個月
              targetDate = new Date(
                now.getFullYear(),
                now.getMonth() + 1,
                day,
                hour, minute, 0, 0
              );
              
              // 如果下個月也無效，嘗試明年同月
              if (targetDate.getDate() !== day) {
                targetDate = new Date(
                  now.getFullYear() + 1,
                  now.getMonth(),
                  day,
                  hour, minute, 0, 0
                );
              }
            }
          }
          break;
        }
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
   * 解析僅時間（今天的指定時間）
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

    if (this.language === 'ja') {
      // 15:30 或 15時30分
      const patterns = [
        /(\d{1,2})[時:](\d{1,2})[分:]?/g,
        /(午前|午後)(\d{1,2})[時:](\d{1,2})[分:]?/g
      ];

      for (let pattern of patterns) {
        pattern.lastIndex = 0; // 重置狀態
        const match = pattern.exec(text);
        if (match) {
          matched = true;
          matchText = match[0];
          
          let hour, minute;
          if (match.length === 3) {
            // 24小時制
            hour = parseInt(match[1]);
            minute = parseInt(match[2]);
          } else if (match.length === 4) {
            // 12小時制
            hour = parseInt(match[2]);
            minute = parseInt(match[3]);
            if (match[1] === '午後' && hour < 12) hour += 12;
            if (match[1] === '午前' && hour === 12) hour = 0;
          }
          
          targetDate.setHours(hour, minute, 0, 0);
          
          // 如果時間已過，設定為明天
          if (targetDate <= now) {
            targetDate.setDate(targetDate.getDate() + 1);
          }
          break;
        }
      }
    } else {
      // 中文時間模式
      const patterns = [
        /(\d{1,2})[點時:](\d{1,2})[分:]?/g,
        /(上午|下午)(\d{1,2})[點時:](\d{1,2})[分:]?/g,
        /(早上|中午|下午|晚上)(\d{1,2})[點時:](\d{1,2})[分:]?/g
      ];

      for (let pattern of patterns) {
        pattern.lastIndex = 0; // 重置狀態
        const match = pattern.exec(text);
        if (match) {
          matched = true;
          matchText = match[0];
          
          let hour, minute;
          if (match.length === 3) {
            // 24小時制
            hour = parseInt(match[1]);
            minute = parseInt(match[2]);
          } else if (match.length === 4) {
            hour = parseInt(match[2]);
            minute = parseInt(match[3]);
            
            const period = match[1];
            if (period === '下午' && hour < 12) hour += 12;
            if (period === '上午' && hour === 12) hour = 0;
            if (period === '晚上' && hour < 12) hour += 12;
            if (period === '中午' && hour === 12) hour = 12;
            if (period === '早上' && hour >= 6 && hour < 12) hour = hour;
            if (period === '早上' && hour < 6) hour += 6;
          }
          
          targetDate.setHours(hour, minute, 0, 0);
          
          // 如果時間已過，設定為明天
          if (targetDate <= now) {
            targetDate.setDate(targetDate.getDate() + 1);
          }
          break;
        }
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
   * 解析自然語言中的星期
   */
  parseWeekday(text) {
    const result = {
      success: false,
      weekday: null,
      remainingText: text
    };

    let weekdayMap;
    let patterns;

    if (this.language === 'ja') {
      weekdayMap = {
        '月曜': 1, '火曜': 2, '水曜': 3, '木曜': 4, '金曜': 5, '土曜': 6, '日曜': 0,
        '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6, '日': 0
      };
      patterns = [/(月曜日?|火曜日?|水曜日?|木曜日?|金曜日?|土曜日?|日曜日?)/g];
    } else {
      weekdayMap = {
        '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6, '週日': 0,
        '星期一': 1, '星期二': 2, '星期三': 3, '星期四': 4, '星期五': 5, '星期六': 6, '星期日': 0,
        '禮拜一': 1, '禮拜二': 2, '禮拜三': 3, '禮拜四': 4, '禮拜五': 5, '禮拜六': 6, '禮拜日': 0
      };
      patterns = [/(週[一二三四五六日]|星期[一二三四五六日]|禮拜[一二三四五六日])/g];
    }

    for (let pattern of patterns) {
      pattern.lastIndex = 0; // 重置狀態
      const match = pattern.exec(text);
      if (match) {
        const dayStr = match[1];
        const weekday = weekdayMap[dayStr];
        
        if (weekday !== undefined) {
          result.success = true;
          result.weekday = weekday;
          result.remainingText = text.replace(match[0], '').trim();
          break;
        }
      }
    }

    return result;
  }
}

module.exports = DateParser;
