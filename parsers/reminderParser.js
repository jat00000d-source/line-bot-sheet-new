const moment = require('moment-timezone');

class ReminderParser {
  constructor() {
    this.timezone = 'Asia/Tokyo';
    
    // 中文數字對照表
    this.chineseNumbers = {
      '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
      '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
      '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
      '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
      '二十一': 21, '二十二': 22, '二十三': 23, '二十四': 24, '二十五': 25,
      '二十六': 26, '二十七': 27, '二十八': 28, '二十九': 29, '三十': 30, '三十一': 31
    };

    // 星期對照表
    this.weekdays = {
      '星期一': 1, '星期二': 2, '星期三': 3, '星期四': 4, '星期五': 5, '星期六': 6, '星期日': 0,
      '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6, '週日': 0,
      '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 0,
      '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0
    };

    // 時間單位對照
    this.timeUnits = {
      '小時': 'hours', '時': 'hours',
      '分鐘': 'minutes', '分': 'minutes',
      '天': 'days', '日': 'days',
      '週': 'weeks', '周': 'weeks', '星期': 'weeks',
      '月': 'months', '個月': 'months',
      '年': 'years'
    };
  }

  /**
   * 解析提醒指令 - 主要入口函數
   * @param {string} text - 用戶輸入的提醒文字
   * @returns {Object} 解析結果
   */
  parseReminderCommand(text) {
    console.log('🔍 解析提醒指令:', text);
    
    const now = moment().tz(this.timezone);
    let content = text.trim();
    let datetime = now.clone().add(1, 'hour'); // 預設1小時後
    let recurring = null;
    let recurringData = null;

    // 嘗試各種解析模式
    const parseResult = this.tryParsePatterns(content);
    
    if (parseResult.success) {
      datetime = parseResult.datetime;
      recurring = parseResult.recurring;
      recurringData = parseResult.recurringData;
      content = parseResult.content;
      
      console.log('✅ 解析成功:', {
        datetime: datetime.format('YYYY-MM-DD HH:mm:ss'),
        recurring,
        content
      });
    } else {
      console.log('⚠️ 使用預設設定 (1小時後)');
    }

    return {
      datetime,
      recurring,
      recurringData,
      content: content.trim()
    };
  }

  /**
   * 嘗試各種解析模式
   */
  tryParsePatterns(text) {
    const patterns = [
      // 每月特定日期
      () => this.parseMonthlyReminder(text),
      
      // 重複間隔 (每週、隔週等)
      () => this.parseRecurringInterval(text),
      
      // 相對時間 (明天、後天等)
      () => this.parseRelativeTime(text),
      
      // 特定星期幾
      () => this.parseSpecificWeekday(text),
      
      // 絕對時間
      () => this.parseAbsoluteTime(text),
      
      // 今天/明天特定時間
      () => this.parseTodayTomorrow(text)
    ];

    for (const pattern of patterns) {
      try {
        const result = pattern();
        if (result && result.success) {
          return result;
        }
      } catch (error) {
        console.warn('解析模式錯誤:', error.message);
      }
    }

    return { success: false };
  }

  /**
   * 解析每月提醒 (如: "每月20號提醒我...")
   */
  parseMonthlyReminder(text) {
    const patterns = [
      // 每月數字號
      {
        regex: /(.*?)每月(\d+)號(.*)/,
        handler: (match) => {
          const day = parseInt(match[2]);
          const beforeText = match[1].trim();
          const afterText = match[3].trim();
          return { day, content: beforeText + afterText };
        }
      },
      // 每個月數字號
      {
        regex: /(.*?)每個月(\d+)號(.*)/,
        handler: (match) => {
          const day = parseInt(match[2]);
          const beforeText = match[1].trim();
          const afterText = match[3].trim();
          return { day, content: beforeText + afterText };
        }
      },
      // 每月中文數字號
      {
        regex: /(.*?)每月(一|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|二十一|二十二|二十三|二十四|二十五|二十六|二十七|二十八|二十九|三十|三十一)號(.*)/,
        handler: (match) => {
          const day = this.chineseNumbers[match[2]];
          const beforeText = match[1].trim();
          const afterText = match[3].trim();
          return { day, content: beforeText + afterText };
        }
      }
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const { day, content } = pattern.handler(match);
        
        if (day >= 1 && day <= 31) {
          const now = moment().tz(this.timezone);
          let nextDate = now.clone().date(day).hour(9).minute(0).second(0).millisecond(0);
          
          // 如果本月該日期已過，設定為下個月
          if (nextDate.isSameOrBefore(now)) {
            nextDate.add(1, 'month');
          }

          // 檢查指定日期在該月是否存在
          if (nextDate.date() !== day) {
            nextDate = nextDate.endOf('month');
          }

          return {
            success: true,
            datetime: nextDate,
            recurring: '每月',
            recurringData: { day: day },
            content: content,
            type: 'monthly'
          };
        }
      }
    }

    return { success: false };
  }

  /**
   * 解析重複間隔
   */
  parseRecurringInterval(text) {
    const patterns = [
      // 每週特定天
      {
        regex: /(.*?)每週(一|二|三|四|五|六|日|星期一|星期二|星期三|星期四|星期五|星期六|星期日|週一|週二|週三|週四|週五|週六|週日)(.*)/,
        handler: (match) => {
          let weekdayText = match[2];
          // 標準化星期文字
          if (weekdayText.length === 1) {
            weekdayText = '星期' + weekdayText;
          }
          const weekday = this.weekdays[weekdayText];
          const content = match[1].trim() + ' ' + match[3].trim();
          return { weekday, content, type: 'weekly' };
        }
      },
      // 隔週提醒
      {
        regex: /(.*?)隔週(.*)/,
        handler: (match) => {
          const content = match[1].trim() + ' ' + match[2].trim();
          return { content, type: 'biweekly' };
        }
      },
      // 每N天
      {
        regex: /(.*?)每(\d+)天(.*)/,
        handler: (match) => {
          const days = parseInt(match[2]);
          const content = match[1].trim() + ' ' + match[3].trim();
          return { days, content, type: 'days' };
        }
      },
      // 每天
      {
        regex: /(.*?)每天(.*)/,
        handler: (match) => {
          const content = match[1].trim() + ' ' + match[2].trim();
          return { content, type: 'daily' };
        }
      }
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const result = pattern.handler(match);
        const now = moment().tz(this.timezone);
        let nextDate = now.clone().add(1, 'hour'); // 預設時間

        switch (result.type) {
          case 'weekly':
            nextDate = now.clone().startOf('week').add(result.weekday, 'days').hour(9).minute(0).second(0);
            if (nextDate.isSameOrBefore(now)) {
              nextDate.add(1, 'week');
            }
            return {
              success: true,
              datetime: nextDate,
              recurring: '每週',
              recurringData: { weekday: result.weekday },
              content: result.content.trim(),
              type: 'weekly'
            };

          case 'biweekly':
            nextDate = now.clone().add(2, 'weeks').hour(9).minute(0).second(0);
            return {
              success: true,
              datetime: nextDate,
              recurring: '隔週',
              recurringData: { weeks: 2 },
              content: result.content.trim(),
              type: 'biweekly'
            };

          case 'days':
            nextDate = now.clone().add(result.days, 'days').hour(9).minute(0).second(0);
            return {
              success: true,
              datetime: nextDate,
              recurring: `每${result.days}天`,
              recurringData: { days: result.days },
              content: result.content.trim(),
              type: 'days'
            };

          case 'daily':
            nextDate = now.clone().add(1, 'day').hour(9).minute(0).second(0);
            return {
              success: true,
              datetime: nextDate,
              recurring: '每天',
              recurringData: { days: 1 },
              content: result.content.trim(),
              type: 'daily'
            };
        }
      }
    }

    return { success: false };
  }

  /**
   * 解析相對時間 (如: "明天9點", "3小時後")
   */
  parseRelativeTime(text) {
    const now = moment().tz(this.timezone);
    
    // 明天/後天模式
    const relativeDay = text.match(/(.*?)(明天|後天|明日)(.*)/);
    if (relativeDay) {
      const days = relativeDay[2].includes('明') ? 1 : 2;
      const beforeText = relativeDay[1].trim();
      const afterText = relativeDay[3].trim();
      const content = beforeText + ' ' + afterText;
      
      let targetDate = now.clone().add(days, 'days');
      
      // 嘗試解析時間
      const timeInfo = this.extractTimeFromText(afterText);
      if (timeInfo.success) {
        targetDate.hour(timeInfo.hour).minute(timeInfo.minute).second(0).millisecond(0);
      } else {
        targetDate.hour(9).minute(0).second(0).millisecond(0);
      }

      return {
        success: true,
        datetime: targetDate,
        recurring: null,
        content: content.trim(),
        type: 'relative'
      };
    }

    // N小時後/N分鐘後模式
    const relativeTime = text.match(/(.*?)(\d+)(小時|時間|分鐘|分)後(.*)/);
    if (relativeTime) {
      const amount = parseInt(relativeTime[2]);
      const unit = relativeTime[3].includes('小時') || relativeTime[3].includes('時間') ? 'hours' : 'minutes';
      const beforeText = relativeTime[1].trim();
      const afterText = relativeTime[4].trim();
      const content = beforeText + ' ' + afterText;
      
      const targetDate = now.clone().add(amount, unit);

      return {
        success: true,
        datetime: targetDate,
        recurring: null,
        content: content.trim(),
        type: 'relative'
      };
    }

    return { success: false };
  }

  /**
   * 解析特定星期幾 (如: "下週三9點")
   */
  parseSpecificWeekday(text) {
    const weekdayPattern = text.match(/(.*?)(下週|下周|這週|這周)?(一|二|三|四|五|六|日|星期一|星期二|星期三|星期四|星期五|星期六|星期日|週一|週二|週三|週四|週五|週六|週日)(.*)/);
    
    if (weekdayPattern) {
      const beforeText = weekdayPattern[1].trim();
      const weekPrefix = weekdayPattern[2];
      let weekdayText = weekdayPattern[3];
      const afterText = weekdayPattern[4].trim();
      
      // 標準化星期文字
      if (weekdayText.length === 1) {
        weekdayText = '星期' + weekdayText;
      }
      
      const weekday = this.weekdays[weekdayText];
      if (weekday !== undefined) {
        const now = moment().tz(this.timezone);
        let targetDate = now.clone().startOf('week').add(weekday, 'days');
        
        // 處理週前綴
        if (weekPrefix && (weekPrefix.includes('下') || weekPrefix.includes('下'))) {
          targetDate.add(1, 'week');
        } else if (targetDate.isSameOrBefore(now)) {
          targetDate.add(1, 'week');
        }

        // 嘗試解析時間
        const timeInfo = this.extractTimeFromText(afterText);
        if (timeInfo.success) {
          targetDate.hour(timeInfo.hour).minute(timeInfo.minute).second(0).millisecond(0);
        } else {
          targetDate.hour(9).minute(0).second(0).millisecond(0);
        }

        const content = beforeText + ' ' + afterText;

        return {
          success: true,
          datetime: targetDate,
          recurring: null,
          content: content.trim(),
          type: 'weekday'
        };
      }
    }

    return { success: false };
  }

  /**
   * 解析今天/明天的特定時間
   */
  parseTodayTomorrow(text) {
    const patterns = [
      {
        regex: /(.*?)(今天|今日)(\d{1,2})[：:](\d{2})(.*)/,
        handler: (match) => {
          const hour = parseInt(match[3]);
          const minute = parseInt(match[4]);
          const content = match[1].trim() + ' ' + match[5].trim();
          return { hour, minute, content, offset: 0 };
        }
      },
      {
        regex: /(.*?)(今天|今日)(\d{1,2})[點时](.*)/,
        handler: (match) => {
          const hour = parseInt(match[3]);
          const content = match[1].trim() + ' ' + match[4].trim();
          return { hour, minute: 0, content, offset: 0 };
        }
      },
      {
        regex: /(.*?)(明天|明日)(\d{1,2})[：:](\d{2})(.*)/,
        handler: (match) => {
          const hour = parseInt(match[3]);
          const minute = parseInt(match[4]);
          const content = match[1].trim() + ' ' + match[5].trim();
          return { hour, minute, content, offset: 1 };
        }
      },
      {
        regex: /(.*?)(明天|明日)(\d{1,2})[點时](.*)/,
        handler: (match) => {
          const hour = parseInt(match[3]);
          const content = match[1].trim() + ' ' + match[4].trim();
          return { hour, minute: 0, content, offset: 1 };
        }
      }
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const result = pattern.handler(match);
        const now = moment().tz(this.timezone);
        let targetDate = now.clone().add(result.offset, 'day')
          .hour(result.hour)
          .minute(result.minute)
          .second(0)
          .millisecond(0);

        // 如果是今天且時間已過，改為明天
        if (result.offset === 0 && targetDate.isSameOrBefore(now)) {
          targetDate.add(1, 'day');
        }

        return {
          success: true,
          datetime: targetDate,
          recurring: null,
          content: result.content.trim(),
          type: 'specific'
        };
      }
    }

    return { success: false };
  }

  /**
   * 解析絕對時間 (如: "10:30", "下午3點")
   */
  parseAbsoluteTime(text) {
    const patterns = [
      // HH:MM 格式
      {
        regex: /(\d{1,2})[：:](\d{2})/,
        handler: (match) => {
          const hour = parseInt(match[1]);
          const minute = parseInt(match[2]);
          return { hour, minute };
        }
      },
      // 數字點格式
      {
        regex: /(\d{1,2})[點时]/,
        handler: (match) => {
          const hour = parseInt(match[1]);
          return { hour, minute: 0 };
        }
      },
      // 上午/下午格式
      {
        regex: /(上午|早上|下午|晚上)(\d{1,2})[點时]/,
        handler: (match) => {
          let hour = parseInt(match[2]);
          if (match[1] === '下午' || match[1] === '晚上') {
            if (hour < 12) hour += 12;
          } else if (match[1] === '上午' && hour === 12) {
            hour = 0;
          }
          return { hour, minute: 0 };
        }
      }
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const { hour, minute } = pattern.handler(match);
        
        if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
          const now = moment().tz(this.timezone);
          let targetDate = now.clone().hour(hour).minute(minute).second(0).millisecond(0);
          
          // 如果時間已過，設為明天
          if (targetDate.isSameOrBefore(now)) {
            targetDate.add(1, 'day');
          }

          const content = text.replace(match[0], '').trim();

          return {
            success: true,
            datetime: targetDate,
            recurring: null,
            content: content,
            type: 'absolute'
          };
        }
      }
    }

    return { success: false };
  }

  /**
   * 從文字中提取時間資訊
   */
  extractTimeFromText(text) {
    const patterns = [
      {
        regex: /(\d{1,2})[：:](\d{2})/,
        handler: (match) => ({ hour: parseInt(match[1]), minute: parseInt(match[2]) })
      },
      {
        regex: /(\d{1,2})[點时]/,
        handler: (match) => ({ hour: parseInt(match[1]), minute: 0 })
      },
      {
        regex: /(上午|早上)(\d{1,2})[點时]/,
        handler: (match) => {
          let hour = parseInt(match[2]);
          if (hour === 12) hour = 0;
          return { hour, minute: 0 };
        }
      },
      {
        regex: /(下午|晚上)(\d{1,2})[點时]/,
        handler: (match) => {
          let hour = parseInt(match[2]);
          if (hour < 12) hour += 12;
          return { hour, minute: 0 };
        }
      }
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const result = pattern.handler(match);
        if (result.hour >= 0 && result.hour <= 23 && result.minute >= 0 && result.minute <= 59) {
          return {
            success: true,
            hour: result.hour,
            minute: result.minute
          };
        }
      }
    }

    return { success: false };
  }

  /**
   * 計算下次執行時間
   */
  calculateNextExecution(datetime, recurring, recurringData = null) {
    if (!recurring || recurring === '單次') {
      return datetime;
    }
    
    const now = moment().tz(this.timezone);
    let next = datetime.clone();
    
    // 確保下次執行時間在未來
    while (next.isSameOrBefore(now)) {
      switch (recurring) {
        case '每天':
          next.add(1, 'day');
          break;
        case '每週':
          next.add(1, 'week');
          break;
        case '每月':
          next.add(1, 'month');
          // 處理月底日期問題
          if (recurringData && recurringData.day) {
            next.date(Math.min(recurringData.day, next.daysInMonth()));
          }
          break;
        case '隔週':
          next.add(2, 'weeks');
          break;
        case '每年':
          next.add(1, 'year');
          break;
        default:
          if (recurring.includes('每') && recurring.includes('天')) {
            const match = recurring.match(/每(\d+)天/);
            if (match) {
              next.add(parseInt(match[1]), 'days');
            }
          } else {
            next.add(1, 'day'); // 預設
          }
          break;
      }
    }
    
    return next;
  }
}

module.exports = ReminderParser;
