// services/reminderScheduler.js - 提醒排程服務
const moment = require('moment-timezone');
const GoogleSheetsService = require('./googleSheetsService');
const NotificationService = require('./notificationService');

class ReminderScheduler {
  constructor(lineClient) {
    this.lineClient = lineClient;
    this.googleSheetsService = new GoogleSheetsService();
    this.notificationService = new NotificationService(lineClient);
  }

  async checkAndSendReminders() {
    try {
      const now = moment().tz('Asia/Tokyo');
      console.log(`🕐 [${now.format('YYYY-MM-DD HH:mm:ss JST')}] Checking for reminders...`);

      const activeReminders = await this.googleSheetsService.getAllActiveReminders();
      
      for (const reminder of activeReminders) {
        const reminderTime = moment(reminder.reminderTime).tz('Asia/Tokyo');
        const currentMinute = now.format('YYYY-MM-DD HH:mm');
        const reminderMinute = reminderTime.format('YYYY-MM-DD HH:mm');

        if (currentMinute === reminderMinute) {
          await this.sendReminder(reminder);
          await this.scheduleNextReminder(reminder, now);
        }
      }
    } catch (error) {
      console.error('Error in checkAndSendReminders:', error);
    }
  }

  async scheduleNextReminder(reminder, currentTime) {
    let nextTime = null;

    switch (reminder.type) {
      case 'daily':
        nextTime = moment(reminder.reminderTime)
          .tz('Asia/Tokyo')
          .add(1, 'day');
        break;
      
      case 'weekly':
        nextTime = moment(reminder.reminderTime)
          .tz('Asia/Tokyo')
          .add(1, 'week');
        break;
      
      case 'monthly':
        nextTime = moment(reminder.reminderTime)
          .tz('Asia/Tokyo')
          .add(1, 'month');
        break;
      
      case 'custom':
        if (reminder.interval) {
          const intervalDays = parseInt(reminder.interval);
          nextTime = moment(reminder.reminderTime)
            .tz('Asia/Tokyo')
            .add(intervalDays, 'days');
        }
        break;
      
      case 'once':
        // 一次性提醒，標記為非活動狀態
        await this.googleSheetsService.updateReminder(reminder.id, { isActive: false });
        return;
    }

    if (nextTime) {
      await this.googleSheetsService.updateReminder(reminder.id, {
        reminderTime: nextTime.toDate()
      });
    }
  }

  async sendReminder(reminder) {
    try {
      const message = {
        type: 'text',
        text: `⏰ 提醒通知\n${reminder.title}\n${reminder.description || ''}`
      };

      await this.lineClient.pushMessage(reminder.userId, message);
      console.log(`✅ Reminder sent to ${reminder.userId}: ${reminder.title}`);
    } catch (error) {
      console.error('Error sending reminder:', error);
    }
  }
}

module.exports = ReminderScheduler;

// ========================================

// parsers/dateTimeParser.js - 日期時間解析器
// 注意：删除了重复的 const moment = require('moment-timezone');

class DateTimeParser {
  constructor() {
    // 設定預設時區為日本時間
    this.timezone = 'Asia/Tokyo';
  }

  parse(text, language = 'zh') {
    const now = moment().tz(this.timezone);
    
    // 時間格式正則表達式
    const timePatterns = {
      // 24小時制：8點、20:30、08:00
      time24: /(\d{1,2})[時点:：](\d{0,2})/g,
      // 12小時制：上午8點、下午3點
      time12: /[上下午早晚][午]?(\d{1,2})[時点]/g,
      // 日文時間：8時、20時30分
      timeJa: /(\d{1,2})時(\d{0,2})[分]?/g
    };

    // 日期格式正則表達式
    const datePatterns = {
      // 明確日期：2023-08-26、8/26
      absolute: /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})[日]?/g,
      // 相對日期：明天、明日、後天
      relative: /(明天|明日|後天|あした|あす|あさって)/g,
      // 星期：每週一、毎週月曜日
      weekday: /(每週|毎週|每星期)[一二三四五六日月火水木金土]/g
    };

    let result = {
      datetime: null,
      type: 'once', // once, daily, weekly, monthly, custom
      interval: null,
      text: text
    };

    // 解析相對時間
    if (text.includes('明天') || text.includes('明日') || text.includes('あした') || text.includes('あす')) {
      result.datetime = now.clone().add(1, 'day');
      result.type = 'once';
    } else if (text.includes('後天') || text.includes('あさって')) {
      result.datetime = now.clone().add(2, 'day');
      result.type = 'once';
    }

    // 解析重複類型
    if (text.includes('每天') || text.includes('毎日')) {
      result.type = 'daily';
      result.datetime = now.clone();
    } else if (text.includes('每週') || text.includes('毎週')) {
      result.type = 'weekly';
      result.datetime = this.parseWeekday(text, now);
    } else if (text.includes('每月') || text.includes('毎月')) {
      result.type = 'monthly';
      result.datetime = now.clone();
    }

    // 解析時間
    const timeMatch = text.match(/(\d{1,2})[時点:：](\d{0,2})/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      
      if (result.datetime) {
        result.datetime.hour(hour).minute(minute).second(0);
      } else {
        result.datetime = now.clone().hour(hour).minute(minute).second(0);
        // 如果時間已過，設為明天
        if (result.datetime.isBefore(now)) {
          result.datetime.add(1, 'day');
        }
      }
    }

    // 解析自定義間隔
    const intervalMatch = text.match(/每(\d+)[天日]/);
    if (intervalMatch) {
      result.type = 'custom';
      result.interval = parseInt(intervalMatch[1]);
      if (!result.datetime) {
        result.datetime = now.clone();
      }
    }

    return result;
  }

  parseWeekday(text, baseDate) {
    const weekdayMap = {
      '一': 1, '月': 1, '月曜日': 1,
      '二': 2, '火': 2, '火曜日': 2,
      '三': 3, '水': 3, '水曜日': 3,
      '四': 4, '木': 4, '木曜日': 4,
      '五': 5, '金': 5, '金曜日': 5,
      '六': 6, '土': 6, '土曜日': 6,
      '日': 0, '日曜日': 0
    };

    for (const [key, day] of Object.entries(weekdayMap)) {
      if (text.includes(key)) {
        const targetDate = baseDate.clone();
        const currentDay = targetDate.day();
        let daysToAdd = day - currentDay;
        
        if (daysToAdd <= 0) {
          daysToAdd += 7;
        }
        
        return targetDate.add(daysToAdd, 'days');
      }
    }

    return baseDate.clone();
  }

  formatForDisplay(datetime, language = 'zh') {
    if (!datetime) return '';

    const formatted = moment(datetime).tz(this.timezone);
    
    if (language === 'ja') {
      return formatted.format('YYYY年MM月DD日 HH:mm');
    } else {
      return formatted.format('YYYY-MM-DD HH:mm');
    }
  }

  isValidTime(datetime) {
    if (!datetime) return false;
    
    const now = moment().tz(this.timezone);
    const target = moment(datetime).tz(this.timezone);
    
    // 檢查是否為未來時間
    return target.isAfter(now);
  }
}

module.exports = DateTimeParser;
