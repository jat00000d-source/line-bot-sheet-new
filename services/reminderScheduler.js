// services/reminderScheduler.js - 提醒排程器
const line = require('@line/bot-sdk');
const config = require('../config/config');
const TodoService = require('./todoService');

class ReminderScheduler {
  constructor() {
    this.client = new line.Client(config.line);
    this.todoService = new TodoService();
    this.intervalId = null;
    this.isRunning = false;
  }

  /**
   * 啟動提醒排程器
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  提醒排程器已在運行中');
      return;
    }

    console.log('🚀 啟動提醒排程器...');
    this.isRunning = true;
    
    // 立即執行一次檢查
    this.checkReminders();
    
    // 設定定期檢查
    this.intervalId = setInterval(() => {
      this.checkReminders();
    }, config.reminder.checkInterval);
    
    console.log(`✅ 提醒排程器已啟動，檢查間隔：${config.reminder.checkInterval / 1000}秒`);
  }

  /**
   * 停止提醒排程器
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  提醒排程器未在運行');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    console.log('🛑 提醒排程器已停止');
  }

  /**
   * 檢查並發送提醒
   */
  async checkReminders() {
    try {
      const now = new Date();
      console.log(`🔍 檢查提醒 - ${now.toISOString()}`);
      
      // 獲取所有活躍的提醒
      const activeReminders = await this.todoService.getActiveReminders();
      
      if (!activeReminders || activeReminders.length === 0) {
        return;
      }
      
      console.log(`📋 找到 ${activeReminders.length} 個活躍提醒`);
      
      for (const reminder of activeReminders) {
        if (this.shouldTrigger(reminder, now)) {
          await this.sendReminder(reminder);
          await this.updateReminderAfterTrigger(reminder);
        }
      }
    } catch (error) {
      console.error('❌ 檢查提醒時發生錯誤:', error);
    }
  }

  /**
   * 判斷提醒是否應該觸發
   * @param {Object} reminder - 提醒物件
   * @param {Date} now - 當前時間
   * @returns {boolean} 是否應該觸發
   */
  shouldTrigger(reminder, now) {
    const reminderTime = new Date(reminder.reminderTime);
    
    // 檢查是否已到提醒時間（允許1分鐘誤差）
    const timeDiff = now.getTime() - reminderTime.getTime();
    if (timeDiff < 0 || timeDiff > 60000) { // 60秒內
      return false;
    }

    // 檢查上次觸發時間，避免重複發送
    if (reminder.lastTriggered) {
      const lastTriggered = new Date(reminder.lastTriggered);
      const sinceLastTrigger = now.getTime() - lastTriggered.getTime();
      if (sinceLastTrigger < 60000) { // 60秒內不重複發送
        return false;
      }
    }

    return true;
  }

  /**
   * 發送提醒訊息
   * @param {Object} reminder - 提醒物件
   */
  async sendReminder(reminder) {
    try {
      const message = this.formatReminderMessage(reminder);
      
      await this.client.pushMessage(reminder.userId, {
        type: 'text',
        text: message
      });
      
      console.log(`📨 提醒已發送給用戶 ${reminder.userId}: ${reminder.title}`);
    } catch (error) {
      console.error(`❌ 發送提醒失敗 (${reminder.id}):`, error);
    }
  }

  /**
   * 格式化提醒訊息
   * @param {Object} reminder - 提醒物件
   * @returns {string} 格式化後的訊息
   */
  formatReminderMessage(reminder) {
    const isJapanese = reminder.language === 'ja';
    
    let message = '';
    
    if (isJapanese) {
      message = `⏰ リマインド\n\n📝 ${reminder.title}`;
      
      if (reminder.description) {
        message += `\n💭 ${reminder.description}`;
      }
      
      // 添加提醒類型信息
      switch (reminder.type) {
        case 'daily':
          message += '\n🔄 毎日のリマインドです';
          break;
        case 'weekly':
          message += '\n🔄 毎週のリマインドです';
          break;
        case 'monthly':
          message += '\n🔄 毎月のリマインドです';
          break;
        case 'custom':
          message += `\n🔄 ${reminder.intervalDays}日ごとのリマインドです`;
          break;
        default:
          message += '\n📅 一回限りのリマインドです';
      }
      
      message += '\n\n完了したい場合は「リマインド削除 ' + reminder.id + '」と入力してください';
    } else {
      message = `⏰ 提醒通知\n\n📝 ${reminder.title}`;
      
      if (reminder.description) {
        message += `\n💭 ${reminder.description}`;
      }
      
      // 添加提醒類型信息
      switch (reminder.type) {
        case 'daily':
          message += '\n🔄 這是每日提醒';
          break;
        case 'weekly':
          message += '\n🔄 這是每週提醒';
          break;
        case 'monthly':
          message += '\n🔄 這是每月提醒';
          break;
        case 'custom':
          message += `\n🔄 這是每${reminder.intervalDays}天的提醒`;
          break;
        default:
          message += '\n📅 這是一次性提醒';
      }
      
      message += '\n\n如要取消請輸入「刪除提醒 ' + reminder.id + '」';
    }
    
    return message;
  }

  /**
   * 提醒觸發後更新狀態
   * @param {Object} reminder - 提醒物件
   */
  async updateReminderAfterTrigger(reminder) {
    try {
      const now = new Date();
      
      // 更新最後觸發時間
      reminder.lastTriggered = now.toISOString();
      
      // 計算下次提醒時間
      const nextReminderTime = this.calculateNextReminderTime(reminder, now);
      
      if (nextReminderTime) {
        // 更新下次提醒時間
        reminder.reminderTime = nextReminderTime.toISOString();
        await this.todoService.updateReminder(reminder.id, reminder);
        
        console.log(`📅 已更新提醒 ${reminder.id} 的下次觸發時間: ${nextReminderTime.toISOString()}`);
      } else {
        // 一次性提醒，標記為已完成
        await this.todoService.completeReminder(reminder.id);
        
        console.log(`✅ 一次性提醒 ${reminder.id} 已完成`);
      }
    } catch (error) {
      console.error(`❌ 更新提醒狀態失敗 (${reminder.id}):`, error);
    }
  }

  /**
   * 計算下次提醒時間
   * @param {Object} reminder - 提醒物件
   * @param {Date} currentTime - 當前時間
   * @returns {Date|null} 下次提醒時間，如果是一次性提醒則返回 null
   */
  calculateNextReminderTime(reminder, currentTime) {
    const current = new Date(currentTime);
    
    switch (reminder.type) {
      case 'daily':
        // 每日提醒：加一天
        return new Date(current.getTime() + 24 * 60 * 60 * 1000);
        
      case 'weekly':
        // 每週提醒：加七天
        return new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
        
      case 'monthly':
        // 每月提醒：加一個月
        const nextMonth = new Date(current);
        nextMonth.setMonth(current.getMonth() + 1);
        return nextMonth;
        
      case 'custom':
        // 自定義間隔：加指定天數
        const intervalMs = (reminder.intervalDays || 1) * 24 * 60 * 60 * 1000;
        return new Date(current.getTime() + intervalMs);
        
      default:
        // 一次性提醒
        return null;
    }
  }

  /**
   * 獲取排程器狀態
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: config.reminder.checkInterval,
      lastCheck: new Date().toISOString()
    };
  }
}

module.exports = ReminderScheduler;
