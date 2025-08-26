// services/reminderScheduler.js - 修復版
const moment = require('moment-timezone');

class ReminderScheduler {
  constructor(lineClient) {
    this.client = lineClient;
    this.reminders = []; // 這會被設定為 TodoController 的 reminders 參考
    console.log('⏰ ReminderScheduler 初始化完成');
  }

  // 設定提醒資料的參考（從 TodoController 傳入）
  setReminders(reminders) {
    this.reminders = reminders;
  }

  async checkAndSendReminders() {
    try {
      const now = moment().tz('Asia/Tokyo');
      const currentTime = now.format('HH:mm');
      const currentDate = now.format('YYYY-MM-DD');
      const currentWeekday = now.format('dddd').toLowerCase();
      
      console.log(`⏰ 檢查提醒 - 目前時間: ${now.format('YYYY-MM-DD HH:mm:ss JST')}`);

      // 找出需要觸發的提醒
      const activeReminders = this.reminders.filter(reminder => 
        reminder.isActive && this.shouldTriggerReminder(reminder, now)
      );

      if (activeReminders.length === 0) {
        return;
      }

      console.log(`📨 找到 ${activeReminders.length} 個需要發送的提醒`);

      // 發送提醒訊息
      for (const reminder of activeReminders) {
        await this.sendReminderMessage(reminder);
        
        // 如果是單次提醒，設為不活躍
        if (reminder.type === 'once') {
          reminder.isActive = false;
          console.log(`🔕 單次提醒已完成: ${reminder.title}`);
        }
      }

    } catch (error) {
      console.error('❌ 檢查提醒時發生錯誤:', error);
    }
  }

  shouldTriggerReminder(reminder, now) {
    try {
      // 解析提醒時間
      const reminderMoment = moment.tz(reminder.reminderTime, 'Asia/Tokyo');
      
      switch (reminder.type) {
        case 'once':
          // 單次提醒：檢查是否到了指定時間（精確到分鐘）
          return now.isSame(reminderMoment, 'minute');
          
        case 'daily':
          // 每日提醒：檢查時間是否相同
          return now.format('HH:mm') === reminderMoment.format('HH:mm');
          
        case 'weekly':
          // 每週提醒：檢查星期幾和時間是否相同
          return now.format('dddd HH:mm') === reminderMoment.format('dddd HH:mm');
          
        case 'monthly':
          // 每月提醒：檢查日期和時間是否相同
          return now.format('DD HH:mm') === reminderMoment.format('DD HH:mm');
          
        default:
          return false;
      }
    } catch (error) {
      console.error('❌ 判斷提醒觸發條件時發生錯誤:', error);
      return false;
    }
  }

  async sendReminderMessage(reminder) {
    try {
      const message = {
        type: 'text',
        text: `⏰ 提醒時間到了！\n\n📋 ${reminder.title}\n\n${reminder.description ? `📝 ${reminder.description}\n\n` : ''}🕐 ${moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss JST')}`
      };

      await this.client.pushMessage(reminder.userId, message);
      console.log(`📨 提醒訊息已發送給用戶 ${reminder.userId}: ${reminder.title}`);
      
    } catch (error) {
      console.error(`❌ 發送提醒訊息失敗 (用戶: ${reminder.userId}):`, error);
    }
  }

  // 取得活躍提醒數量（用於監控）
  getActiveReminderCount() {
    return this.reminders.filter(reminder => reminder.isActive).length;
  }

  // 取得今日待觸發的提醒
  getTodayPendingReminders() {
    const now = moment().tz('Asia/Tokyo');
    const today = now.format('YYYY-MM-DD');
    
    return this.reminders.filter(reminder => {
      if (!reminder.isActive) return false;
      
      const reminderMoment = moment.tz(reminder.reminderTime, 'Asia/Tokyo');
      
      switch (reminder.type) {
        case 'once':
          return reminderMoment.format('YYYY-MM-DD') === today && reminderMoment.isAfter(now);
        case 'daily':
          return reminderMoment.format('HH:mm') > now.format('HH:mm');
        case 'weekly':
          return reminderMoment.format('dddd') === now.format('dddd') && reminderMoment.format('HH:mm') > now.format('HH:mm');
        case 'monthly':
          return reminderMoment.format('DD') === now.format('DD') && reminderMoment.format('HH:mm') > now.format('HH:mm');
        default:
          return false;
      }
    });
  }
}

module.exports = ReminderScheduler;
