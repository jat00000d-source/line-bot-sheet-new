const moment = require('moment-timezone');

class ReminderParser {
  parseReminderCommand(text) {
    const now = moment().tz('Asia/Tokyo');
    let content = text;
    let datetime = now.clone().add(1, 'hour'); // 預設1小時後
    let recurring = null;

    // 先解析重複設定，並完全移除匹配的文字
    const recurringPatterns = [
      {
        pattern: /(每天|毎日|daily)/gi,
        value: '每天'
      },
      {
        pattern: /(每週|毎週|週次|weekly)/gi,
        value: '每週'
      },
      {
        pattern: /(每月|毎月|monthly)/gi,
        value: '每月'
      },
      {
        pattern: /(每年|毎年|yearly)/gi,
        value: '每年'
      }
    ];

    // 應用重複設定解析並清理內容
    for (const { pattern, value } of recurringPatterns) {
      if (pattern.test(text)) {
        recurring = value;
        content = content.replace(pattern, '').trim();
        break;
      }
    }

    // 改進時間解析
    const timePatterns = [
      // 中文完整格式：10點10分、12點30分
      {
        pattern: /(\d{1,2})\s*[點点时]\s*(\d{1,2})\s*分/,
        handler: (match) => {
          const hour = parseInt(match[1]);
          const minute = parseInt(match[2]);
          datetime = now.clone().hour(hour).minute(minute).second(0).millisecond(0);
          if (datetime.isBefore(now)) datetime.add(1, 'day');
          content = content.replace(match[0], '').trim();
        }
      },
      
      // 純數字冒號格式：10:10、15:30
      {
        pattern: /(\d{1,2})[:：](\d{2})/,
        handler: (match) => {
          const hour = parseInt(match[1]);
          const minute = parseInt(match[2]);
          datetime = now.clone().hour(hour).minute(minute).second(0).millisecond(0);
          if (datetime.isBefore(now)) datetime.add(1, 'day');
          content = content.replace(match[0], '').trim();
        }
      },
      
      // 日文格式：10時10分
      {
        pattern: /(\d{1,2})\s*時\s*(\d{1,2})\s*分/,
        handler: (match) => {
          const hour = parseInt(match[1]);
          const minute = parseInt(match[2]);
          datetime = now.clone().hour(hour).minute(minute).second(0).millisecond(0);
          if (datetime.isBefore(now)) datetime.add(1, 'day');
          content = content.replace(match[0], '').trim();
        }
      },
      
      // 絕對時間 - 今天/明天 + 時間（精確匹配）
      {
        pattern: /(今天|今日)\s*(\d{1,2})[:：時点](\d{2})/,
        handler: (match) => {
          const hour = parseInt(match[2]);
          const minute = parseInt(match[3]);
          datetime = now.clone().hour(hour).minute(minute).second(0).millisecond(0);
          if (datetime.isBefore(now)) datetime.add(1, 'day');
          content = content.replace(match[0], '').trim();
        }
      },
      {
        pattern: /(今天|今日)\s*(\d{1,2})[:：時点]?$/,
        handler: (match) => {
          const hour = parseInt(match[2]);
          datetime = now.clone().hour(hour).minute(0).second(0).millisecond(0);
          if (datetime.isBefore(now)) datetime.add(1, 'day');
          content = content.replace(match[0], '').trim();
        }
      },
      {
        pattern: /(明天|明日)\s*(\d{1,2})[:：時点](\d{2})/,
        handler: (match) => {
          const hour = parseInt(match[2]);
          const minute = parseInt(match[3]);
          datetime = now.clone().add(1, 'day').hour(hour).minute(minute).second(0).millisecond(0);
          content = content.replace(match[0], '').trim();
        }
      },
      {
        pattern: /(明天|明日)\s*(\d{1,2})[:：時点]?$/,
        handler: (match) => {
          const hour = parseInt(match[2]);
          datetime = now.clone().add(1, 'day').hour(hour).minute(0).second(0).millisecond(0);
          content = content.replace(match[0], '').trim();
        }
      },
      
      // 相對時間
      {
        pattern: /(\d+)\s*(分鐘?|分|minutes?)\s*後/,
        handler: (match) => {
          const minutes = parseInt(match[1]);
          datetime = now.clone().add(minutes, 'minutes').second(0).millisecond(0);
          content = content.replace(match[0], '').trim();
        }
      },
      {
        pattern: /(\d+)\s*(小時?|時間|hours?)\s*後/,
        handler: (match) => {
          const hours = parseInt(match[1]);
          datetime = now.clone().add(hours, 'hours').second(0).millisecond(0);
          content = content.replace(match[0], '').trim();
        }
      },
      
      // 只有數字的時間（如"9點"）
      {
        pattern: /(\d{1,2})\s*[點时]/,
        handler: (match) => {
          const hour = parseInt(match[1]);
          datetime = now.clone().hour(hour).minute(0).second(0).millisecond(0);
          if (datetime.isBefore(now)) datetime.add(1, 'day');
          content = content.replace(match[0], '').trim();
        }
      }
    ];

    // 應用時間模式處理
    for (const timePattern of timePatterns) {
      const match = content.match(timePattern.pattern);
      if (match) {
        timePattern.handler(match);
        break;
      }
    }

    // 如果解析出了時間和重複設定，計算下次執行時間
    if (datetime) {
      datetime = this.calculateNextExecution(datetime, recurring);
    }

    // 返回解析結果
    return {
      datetime,
      recurring,
      content: content.trim()
    };
  }

  calculateNextExecution(datetime, recurring) {
    if (!recurring || recurring === '單次') {
      return datetime;
    }
    
    const now = moment().tz('Asia/Tokyo');
    let next = datetime.clone();
    
    // 如果時間已經過了，計算下一次執行時間
    while (next.isBefore(now)) {
      switch (recurring) {
        case '每天':
          next.add(1, 'day');
          break;
        case '每週':
          next.add(1, 'week');
          break;
        case '每月':
          next.add(1, 'month');
          break;
        case '每年':
          next.add(1, 'year');
          break;
        default:
          break;
      }
    }
    
    return next;
  }
}

module.exports = ReminderParser;
