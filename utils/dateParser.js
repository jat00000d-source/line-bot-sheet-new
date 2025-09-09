case 'month_day':
              const mdMonth = parseInt(match[1]);
              const mdDay = parseInt(match[2]);
              
              targetDate = new Date(
                now.getFullYear(),
                mdMonth - 1,
                mdDay,
                9, 0, 0, 0  // 預設上午9點
              );
              
              // 檢查日期是否有效
              if (targetDate.getDate() !== mdDay) {
                // 如果當前月份沒有這一天，嘗試下個月
                targetDate = new Date(
                  now.getFullYear(),
                  mdMonth,  // 下個月
                  mdDay,
                  9, 0, 0, 0
                );
              }
              
              // 如果日期已過，設定為明年同月
              if (targetDate <= now) {
                targetDate = new Date(
                  now.getFullYear() + 1,
                  mdMonth - 1,
                  mdDay,
                  9, 0, 0, 0
                );
              }
              break;// utils/dateParser.js - 完整修正版本
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
   * 解析絕對時間（具體日期）- 修正版本
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
      // 日文絕對時間模式 - 修正正則表達式順序和邏輯
      const patterns = [
        // 2024年12月25日 15:30
        {
          regex: /(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2})[時:](\d{1,2})[分:]?/g,
          type: 'full_date_time'
        },
        // 12月25日 15:30 - 優先處理帶時間的
        {
          regex: /(\d{1,2})月(\d{1,2})[日號]\s*(\d{1,2})[時點:](\d{1,2})[分:]?/g,
          type: 'month_day_time'
        },
        // 25日 15:30 - 優先處理帶時間的
        {
          regex: /(\d{1,2})[日號]\s*(\d{1,2})[時點:](\d{1,2})[分:]?/g,
          type: 'day_time'
        },
        // 2024年12月25日（沒有時間）
        {
          regex: /(\d{4})年(\d{1,2})月(\d{1,2})日/g,
          type: 'full_date'
        },
        // 12月25日（沒有時間）
        {
          regex: /(\d{1,2})月(\d{1,2})[日號]/g,
          type: 'month_day'
        },
        // 支援簡單格式：9/27、9-27
        {
          regex: /(\d{1,2})[\/\-](\d{1,2})\s*(\d{1,2})[時點:](\d{1,2})[分:]?/g,
          type: 'short_date_time'
        },
        {
          regex: /(\d{1,2})[\/\-](\d{1,2})/g,
          type: 'short_date'
        }
      ];

      for (let pattern of patterns) {
        pattern.regex.lastIndex = 0;
        const match = pattern.regex.exec(text);
        if (match) {
          matched = true;
          matchText = match[0];
          
          switch (pattern.type) {
            case 'full_date_time':
              targetDate = new Date(
                parseInt(match[1]), 
                parseInt(match[2]) - 1, 
                parseInt(match[3]),
                parseInt(match[4]),
                parseInt(match[5]),
                0, 0
              );
              break;
              
            case 'month_day_time':
              const month = parseInt(match[1]);
              const day = parseInt(match[2]);
              const hour = parseInt(match[3]);
              const minute = parseInt(match[4]);
              
              // 創建目標日期
              targetDate = new Date(
                now.getFullYear(),
                month - 1,
                day,
                hour,
                minute,
                0, 0
              );
              
              // 檢查日期是否有效
              if (targetDate.getDate() !== day) {
                // 如果當前月份沒有這一天，嘗試下個月
                targetDate = new Date(
                  now.getFullYear(),
                  month,  // 下個月
                  day,
                  hour,
                  minute,
                  0, 0
                );
              }
              
              // 如果日期已過，設定為明年同月
              if (targetDate <= now) {
                targetDate = new Date(
                  now.getFullYear() + 1,
                  month - 1,
                  day,
                  hour,
                  minute,
                  0, 0
                );
              }
              break;
              
            case 'day_time':
              const dayOnly = parseInt(match[1]);
              const hourOnly = parseInt(match[2]);
              const minuteOnly = parseInt(match[3]);
              
              // 先嘗試當前月份
              targetDate = new Date(
                now.getFullYear(),
                now.getMonth(),
                dayOnly,
                hourOnly,
                minuteOnly,
                0, 0
              );
              
              // 檢查該日期是否有效且未過期
              if (targetDate.getDate() !== dayOnly || targetDate <= now) {
                // 嘗試下個月
                targetDate = new Date(
                  now.getFullYear(),
                  now.getMonth() + 1,
                  dayOnly,
                  hourOnly,
                  minuteOnly,
                  0, 0
                );
                
                // 如果下個月也無效，嘗試明年同月
                if (targetDate.getDate() !== dayOnly) {
                  targetDate = new Date(
                    now.getFullYear() + 1,
                    now.getMonth(),
                    dayOnly,
                    hourOnly,
                    minuteOnly,
                    0, 0
                  );
                }
              }
              break;
              
            case 'short_date_time':
              const shortMonth = parseInt(match[1]);
              const shortDay = parseInt(match[2]);
              const shortHour = parseInt(match[3]);
              const shortMinute = parseInt(match[4]);
              
              targetDate = new Date(
                now.getFullYear(),
                shortMonth - 1,
                shortDay,
                shortHour,
                shortMinute,
                0, 0
              );
              
              // 如果日期已過或無效，設定為明年
              if (targetDate <= now || targetDate.getDate() !== shortDay) {
                targetDate = new Date(
                  now.getFullYear() + 1,
                  shortMonth - 1,
                  shortDay,
                  shortHour,
                  shortMinute,
                  0, 0
                );
              }
              break;
              
            case 'short_date_hour':
              const shortHourMonth = parseInt(match[1]);
              const shortHourDay = parseInt(match[2]);
              const shortHourHour = parseInt(match[3]);
              
              targetDate = new Date(
                now.getFullYear(),
                shortHourMonth - 1,
                shortHourDay,
                shortHourHour,
                0, // 分鐘設為0
                0, 0
              );
              
              // 如果日期已過或無效，設定為明年
              if (targetDate <= now || targetDate.getDate() !== shortHourDay) {
                targetDate = new Date(
                  now.getFullYear() + 1,
                  shortHourMonth - 1,
                  shortHourDay,
                  shortHourHour,
                  0,
                  0, 0
                );
              }
              break;
              
            case 'full_date':
              targetDate = new Date(
                parseInt(match[1]),
                parseInt(match[2]) - 1,
                parseInt(match[3]),
                9, 0, 0, 0  // 預設上午9點
              );
              break;
              
            case 'month_day':
              const mdMonth = parseInt(match[1]);
              const mdDay = parseInt(match[2]);
              
              targetDate = new Date(
                now.getFullYear(),
                mdMonth - 1,
                mdDay,
                9, 0, 0, 0  // 預設上午9點
              );
              
              // 檢查日期是否有效
              if (targetDate.getDate() !== mdDay) {
                // 如果當前月份沒有這一天，嘗試下個月
                targetDate = new Date(
                  now.getFullYear(),
                  mdMonth,  // 下個月
                  mdDay,
                  9, 0, 0, 0
                );
              }
              
              // 如果日期已過，設定為明年同月
              if (targetDate <= now) {
                targetDate = new Date(
                  now.getFullYear() + 1,
                  mdMonth - 1,
                  mdDay,
                  9, 0, 0, 0
                );
              }
              break;
              
            case 'short_date':
              const sdMonth = parseInt(match[1]);
              const sdDay = parseInt(match[2]);
              
              targetDate = new Date(
                now.getFullYear(),
                sdMonth - 1,
                sdDay,
                9, 0, 0, 0  // 預設上午9點
              );
              
              // 如果日期已過或無效，設定為明年
              if (targetDate <= now || targetDate.getDate() !== sdDay) {
                targetDate = new Date(
                  now.getFullYear() + 1,
                  sdMonth - 1,
                  sdDay,
                  9, 0, 0, 0
                );
              }
              break;
          }
          break;
        }
      }
    } else {
      // 中文絕對時間模式 - 修正版本
      const patterns = [
        // 2024年12月25日 下午3:30
        {
          regex: /(\d{4})年(\d{1,2})月(\d{1,2})[日號]\s*(上午|下午)?(\d{1,2})[點時:](\d{1,2})[分:]?/g,
          type: 'full_date_time'
        },
        // 12月25日 下午3:30 或 12月25號9點 - 優先處理帶時間的
        {
          regex: /(\d{1,2})月(\d{1,2})[日號]\s*(上午|下午)?(\d{1,2})[點時:](\d{1,2})[分:]?/g,
          type: 'month_day_time'
        },
        // 25日 下午3:30 或 25號 下午3:30 - 優先處理帶時間的
        {
          regex: /(\d{1,2})[日號]\s*(上午|下午)?(\d{1,2})[點時:](\d{1,2})[分:]?/g,
          type: 'day_time'
        },
        // 2024年12月25日（沒有時間）
        {
          regex: /(\d{4})年(\d{1,2})月(\d{1,2})[日號]/g,
          type: 'full_date'
        },
        // 12月25日（沒有時間）
        {
          regex: /(\d{1,2})月(\d{1,2})[日號]/g,
          type: 'month_day'
        },
        // 支援簡單格式：9/27 9點、9-27 9:30
        {
          regex: /(\d{1,2})[\/\-](\d{1,2})\s*(上午|下午)?(\d{1,2})[點時:](\d{1,2})[分:]?/g,
          type: 'short_date_time'
        },
        // 支援簡單格式：9/27、9-27
        {
          regex: /(\d{1,2})[\/\-](\d{1,2})/g,
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
              
              // 創建目標日期
              targetDate = new Date(
                now.getFullYear(),
                month - 1,
                day,
                hour, minute, 0, 0
              );
              
              // 檢查日期是否有效
              if (targetDate.getDate() !== day) {
                // 如果當前月份沒有這一天，嘗試下個月
                targetDate = new Date(
                  now.getFullYear(),
                  month,  // 下個月
                  day,
                  hour, minute, 0, 0
                );
              }
              
              // 如果日期已過，設定為明年同月
              if (targetDate <= now) {
                targetDate = new Date(
                  now.getFullYear() + 1,
                  month - 1,
                  day,
                  hour, minute, 0, 0
                );
              }
              break;
              
            case 'day_time':
              const dayOnly = parseInt(match[1]);
              hour = parseInt(match[3]);
              minute = parseInt(match[4]) || 0;
              if (match[2] === '下午' && hour < 12) hour += 12;
              if (match[2] === '上午' && hour === 12) hour = 0;
              
              // 先嘗試當前月份
              targetDate = new Date(
                now.getFullYear(),
                now.getMonth(),
                dayOnly,
                hour, minute, 0, 0
              );
              
              // 檢查該日期是否有效且未過期
              if (targetDate.getDate() !== dayOnly || targetDate <= now) {
                // 嘗試下個月
                targetDate = new Date(
                  now.getFullYear(),
                  now.getMonth() + 1,
                  dayOnly,
                  hour, minute, 0, 0
                );
                
                // 如果下個月也無效，嘗試明年同月
                if (targetDate.getDate() !== dayOnly) {
                  targetDate = new Date(
                    now.getFullYear() + 1,
                    now.getMonth(),
                    dayOnly,
                    hour, minute, 0, 0
                  );
                }
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
              
              // 如果日期已過或無效，設定為明年
              if (targetDate <= now || targetDate.getDate() !== shortDay) {
                targetDate = new Date(
                  now.getFullYear() + 1,
                  shortMonth - 1,
                  shortDay,
                  hour, minute, 0, 0
                );
              }
              break;
              
            case 'full_date':
              targetDate = new Date(
                parseInt(match[1]),
                parseInt(match[2]) - 1,
                parseInt(match[3]),
                9, 0, 0, 0  // 預設上午9點
              );
              break;
              
            case 'month_day':
              const mdMonth = parseInt(match[1]);
              const mdDay = parseInt(match[2]);
              
              targetDate = new Date(
                now.getFullYear(),
                mdMonth - 1,
                mdDay,
                9, 0, 0, 0  // 預設上午9點
              );
              
              // 檢查日期是否有效
              if (targetDate.getDate() !== mdDay) {
                // 如果當前月份沒有這一天，嘗試下個月
                targetDate = new Date(
                  now.getFullYear(),
                  mdMonth,  // 下個月
                  mdDay,
                  9, 0, 0, 0
                );
              }
              
              // 如果日期已過，設定為明年同月
              if (targetDate <= now) {
                targetDate = new Date(
                  now.getFullYear() + 1,
                  mdMonth - 1,
                  mdDay,
                  9, 0, 0, 0
                );
              }
              break;
              
            case 'short_date':
              const sdMonth = parseInt(match[1]);
              const sdDay = parseInt(match[2]);
              
              targetDate = new Date(
                now.getFullYear(),
                sdMonth - 1,
                sdDay,
                9, 0, 0, 0  // 預設上午9點
              );
              
              // 如果日期已過或無效，設定為明年
              if (targetDate <= now || targetDate.getDate() !== sdDay) {
                targetDate = new Date(
                  now.getFullYear() + 1,
                  sdMonth - 1,
                  sdDay,
                  9, 0, 0, 0
                );
              }
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
      const patterns = [
        /(\d{1,2})[時:](\d{1,2})[分:]?/g,
        /(午前|午後)(\d{1,2})[時:](\d{1,2})[分:]?/g
      ];

      for (let pattern of patterns) {
        pattern.lastIndex = 0;
        const match = pattern.exec(text);
        if (match) {
          matched = true;
          matchText = match[0];
          
          let hour, minute;
          if (match.length === 3) {
            hour = parseInt(match[1]);
            minute = parseInt(match[2]);
          } else if (match.length === 4) {
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
      const patterns = [
        /(\d{1,2})[點時:](\d{1,2})[分:]?/g,
        /(上午|下午)(\d{1,2})[點時:](\d{1,2})[分:]?/g,
        /(早上|中午|下午|晚上)(\d{1,2})[點時:](\d{1,2})[分:]?/g
      ];
      
      for (let pattern of patterns) {
        pattern.lastIndex = 0;
        const match = pattern.exec(text);
        if (match) {
          matched = true;
          matchText = match[0];
          
          let hour, minute;
          if (match.length === 3) {
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
}

module.exports = DateParser;
