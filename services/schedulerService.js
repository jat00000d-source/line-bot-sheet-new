// services/schedulerService.js - 提醒排程服務
const cron = require('node-cron');
const line = require('@line/bot-sdk');

class SchedulerService {
  constructor() {
    this.client = new line.Client({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
      channelSecret: process.env.LINE_CHANNEL_SECRET,
    });
    
    this.reminderService = null;
    this.isRunning = false;
    this.cronJobs = new Map();
    
    // 載入依賴
    this.loadDependencies();
    
    // 初始化排程
    this.initialize();
  }

  // 載入依賴服務
  loadDependencies() {
    try {
      const ReminderService = require('./reminderService');
      this.reminderService = new ReminderService();
      console.log('✅ ReminderService 載入成功');
    } catch (error) {
      console.log('⚠️ ReminderService 載入失敗:', error.message);
    }
  }

  // 初始化排程服務
  initialize() {
    if (!this.reminderService) {
      console.log('⚠️ 無法啟動排程服務：ReminderService 未載入');
      return;
    }

    // 檢查是否啟用排程
    const cronEnabled = process.env.CRON_ENABLED !== 'false'; // 預設啟用
    
    if (!cronEnabled) {
      console.log('⏸️ 排程服務已禁用（CRON_ENABLED=false）');
      return;
    }

    this.startScheduler();
  }

  // 啟動排程服務
  startScheduler() {
    if (this.isRunning) {
      console.log('⚠️ 排程服務已在運行中');
      return;
    }

    try {
      // 每分鐘檢查一次待觸發的提醒
      const mainJob = cron.schedule('* * * * *', async () => {
        await this.checkPendingReminders();
      }, {
        scheduled: true,
        timezone: process.env.TIMEZONE || 'Asia/Taipei'
      });

      this.cronJobs.set('main', mainJob);

      // 每小時清理一次過期的提醒檢查記錄
      const cleanupJob = cron.schedule('0 * * * *', async () => {
        await this.performHourlyCleanup();
      }, {
        scheduled: true,
        timezone: process.env.TIMEZONE || 'Asia/Taipei'
      });

      this.cronJobs.set('cleanup', cleanupJob);

      // 每天午夜進行維護任務
      const maintenanceJob = cron.schedule('0 0 * * *', async () => {
        await this.performDailyMaintenance();
      }, {
        scheduled: true,
        timezone: process.env.TIMEZONE || 'Asia/Taipei'
      });

      this.cronJobs.set('maintenance', maintenanceJob);

      this.isRunning = true;
      console.log('✅ 排程服務已啟動');
      console.log('📅 檢查頻率：每分鐘');
      console.log('🕐 時區：', process.env.TIMEZONE || 'Asia/Taipei');

    } catch (error) {
      console.error('❌ 排程服務啟動失敗:', error);
    }
  }

  // 停止排程服務
  stopScheduler() {
    if (!this.isRunning) {
      console.log('⚠️ 排程服務未在運行');
      return;
    }

    try {
      // 停止所有 cron 作業
      this.cronJobs.forEach((job, name) => {
        job.destroy();
        console.log(`⏹️ 停止排程作業: ${name}`);
      });

      this.cronJobs.clear();
      this.isRunning = false;
      console.log('✅ 排程服務已停止');

    } catch (error) {
      console.error('❌ 停止排程服務失敗:', error);
    }
  }

  // 檢查待觸發的提醒
  async checkPendingReminders() {
    if (!this.reminderService) {
      return;
    }

    try {
      const now = new Date();
      const pendingReminders = await this.reminderService.getPendingReminders(now);

      if (pendingReminders.length === 0) {
        return; // 沒有待觸發的提醒
      }

      console.log(`🔔 發現 ${pendingReminders.length} 個待觸發提醒`);

      // 處理每個待觸發的提醒
      for (const reminder of pendingReminders) {
        await this.processReminderTrigger(reminder);
      }

    } catch (error) {
      console.error('檢查待觸發提醒時發生錯誤:', error);
    }
  }

  // 處理提醒觸發
  async processReminderTrigger(reminder) {
    try {
      // 發送提醒訊息
      await this.sendReminderMessage(reminder);
      
      // 更新提醒狀態
      await this.reminderService.updateNextTrigger(reminder);
      
      // 記錄觸發日誌
      await this.logReminderTrigger(reminder);

      console.log(`✅ 提醒觸發成功: ${reminder.id} - ${reminder.title}`);

    } catch (error) {
      console.error(`❌ 處理提醒觸發失敗: ${reminder.id}`, error);
    }
  }

  // 發送提醒訊息
  async sendReminderMessage(reminder) {
    try {
      // 構建提醒訊息
      const message = this.buildReminderMessage(reminder);
      
      // 如果沒有指定用戶ID，使用廣播（需要LINE Messaging API進階功能）
      // 這裡假設我們有用戶ID或群組ID
      const targetId = reminder.user_id || process.env.DEFAULT_USER_ID;
      
      if (!targetId || targetId === 'default') {
        console.log('⚠️ 無法發送提醒：缺少目標用戶ID');
        return;
      }

      // 發送訊息
      await this.client.pushMessage(targetId, message);
      
      console.log(`📤 提醒訊息已發送: ${reminder.title}`);

    } catch (error) {
      console.error('發送提醒訊息失敗:', error);
      throw error;
    }
  }

  // 構建提醒訊息
  buildReminderMessage(reminder) {
    const language = reminder.language || 'zh';
    const currentTime = new Date().toLocaleString(
      language === 'ja' ? 'ja-JP' : 'zh-TW',
      { timeZone: 'Asia/Taipei' }
    );

    // 基本文字訊息
    let messageText = '';
    
    if (language === 'ja') {
      messageText = `🔔 リマインダー\n\n`;
      messageText += `📋 ${reminder.title}\n`;
      
      if (reminder.description) {
        messageText += `📝 ${reminder.description}\n`;
      }
      
      if (reminder.location) {
        messageText += `📍 場所: ${reminder.location}\n`;
      }
      
      messageText += `\n⏰ 時刻: ${currentTime}`;
      
      // 重複提醒的說明
      if (reminder.type !== 'once') {
        const typeLabels = {
          daily: '毎日',
          weekly: '毎週',
          monthly: '毎月',
          custom: 'カスタム間隔'
        };
        messageText += `\n🔄 繰り返し: ${typeLabels[reminder.type] || reminder.type}`;
      }
      
    } else {
      messageText = `🔔 提醒通知\n\n`;
      messageText += `📋 ${reminder.title}\n`;
      
      if (reminder.description) {
        messageText += `📝 ${reminder.description}\n`;
      }
      
      if (reminder.location) {
        messageText += `📍 地點: ${reminder.location}\n`;
      }
      
      messageText += `\n⏰ 時間: ${currentTime}`;
      
      // 重複提醒的說明
      if (reminder.type !== 'once') {
        const typeLabels = {
          daily: '每日',
          weekly: '每週',
          monthly: '每月',
          custom: '自定義間隔'
        };
        messageText += `\n🔄 重複: ${typeLabels[reminder.type] || reminder.type}`;
      }
    }

    // 如果是進階版，可以使用 Flex Message
    if (process.env.USE_FLEX_MESSAGES === 'true') {
      return this.buildFlexReminderMessage(reminder, messageText);
    }

    // 基本文字訊息
    return {
      type: 'text',
      text: messageText
    };
  }

  // 構建 Flex Message（進階版）
  buildFlexReminderMessage(reminder, fallbackText) {
    const language = reminder.language || 'zh';
    
    const flexMessage = {
      type: 'flex',
      altText: fallbackText,
      contents: {
        type: 'bubble',
        hero: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '🔔',
              size: 'xxl',
              align: 'center'
            },
            {
              type: 'text',
              text: language === 'ja' ? 'リマインダー' : '提醒通知',
              weight: 'bold',
              size: 'xl',
              align: 'center',
              margin: 'sm'
            }
          ],
          backgroundColor: '#4A90E2',
          paddingAll: 'lg'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: reminder.title,
              weight: 'bold',
              size: 'lg',
              wrap: true
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: new Date().toLocaleString(
                language === 'ja' ? 'ja-JP' : 'zh-TW',
                { timeZone: 'Asia/Taipei' }
              ),
              size: 'sm',
              color: '#888888',
              align: 'center'
            }
          ]
        }
      }
    };

    // 添加描述
    if (reminder.description) {
      flexMessage.contents.body.contents.push({
        type: 'text',
        text: reminder.description,
        size: 'sm',
        wrap: true,
        margin: 'md'
      });
    }

    // 添加位置資訊
    if (reminder.location) {
      flexMessage.contents.body.contents.push({
        type: 'text',
        text: `📍 ${reminder.location}`,
        size: 'sm',
        margin: 'md'
      });
    }

    return flexMessage;
  }

  // 記錄提醒觸發日誌
  async logReminderTrigger(reminder) {
    try {
      // 這裡可以將觸發記錄寫入 Google Sheets 或其他日誌系統
      const logEntry = {
        reminder_id: reminder.id,
        trigger_time: new Date().toISOString(),
        title: reminder.title,
        type: reminder.type,
        status: 'sent'
      };

      console.log('📊 提醒觸發日誌:', logEntry);
      
      // TODO: 實作日誌記錄到 Google Sheets 的 ReminderLogs 工作表

    } catch (error) {
      console.error('記錄提醒觸發日誌失敗:', error);
    }
  }

  // 每小時清理任務
  async performHourlyCleanup() {
    try {
      console.log('🧹 執行每小時清理任務');
      
      // 清理記憶體中的過期資料
      // TODO: 實作清理邏輯
      
    } catch (error) {
      console.error('每小時清理任務失敗:', error);
    }
  }

  // 每日維護任務
  async performDailyMaintenance() {
    try {
      console.log('🔧 執行每日維護任務');
      
      // 清理舊的提醒記錄
      if (this.reminderService) {
        const result = await this.reminderService.cleanupOldReminders(30);
        console.log(`🗑️ 清理了 ${result.deletedCount || 0} 個舊提醒`);
      }
      
      // 生成統計報告
      await this.generateDailyStats();
      
    } catch (error) {
      console.error('每日維護任務失敗:', error);
    }
  }

  // 生成每日統計
  async generateDailyStats() {
    try {
      if (!this.reminderService) return;

      const stats = await this.reminderService.getReminderStats();
      
      if (stats) {
        console.log('📊 每日提醒統計:');
        console.log(`  總計: ${stats.total}`);
        console.log(`  活躍: ${stats.active}`);
        console.log(`  已完成: ${stats.completed}`);
        console.log(`  已刪除: ${stats.deleted}`);
        console.log('  類型分布:', stats.byType);
      }

    } catch (error) {
      console.error('生成每日統計失敗:', error);
    }
  }

  // 手動觸發提醒檢查（用於測試）
  async manualCheck() {
    console.log('🔧 手動觸發提醒檢查');
    await this.checkPendingReminders();
  }

  // 獲取排程服務狀態
  getStatus() {
    return {
      isRunning: this.isRunning,
      cronJobs: Array.from(this.cronJobs.keys()),
      reminderServiceLoaded: !!this.reminderService,
      timezone: process.env.TIMEZONE || 'Asia/Taipei',
      cronEnabled: process.env.CRON_ENABLED !== 'false'
    };
  }

  // 重啟排程服務
  restart() {
    console.log('🔄 重啟排程服務');
    this.stopScheduler();
    setTimeout(() => {
      this.startScheduler();
    }, 1000);
  }

  // 添加自定義排程任務
  addCustomJob(name, cronExpression, taskFunction) {
    try {
      if (this.cronJobs.has(name)) {
        console.log(`⚠️ 排程任務 ${name} 已存在，將替換`);
        this.cronJobs.get(name).destroy();
      }

      const job = cron.schedule(cronExpression, taskFunction, {
        scheduled: true,
        timezone: process.env.TIMEZONE || 'Asia/Taipei'
      });

      this.cronJobs.set(name, job);
      console.log(`✅ 自定義排程任務 ${name} 已添加`);

    } catch (error) {
      console.error(`❌ 添加自定義排程任務 ${name} 失敗:`, error);
    }
  }

  // 移除自定義排程任務
  removeCustomJob(name) {
    try {
      if (this.cronJobs.has(name)) {
        this.cronJobs.get(name).destroy();
        this.cronJobs.delete(name);
        console.log(`✅ 自定義排程任務 ${name} 已移除`);
      } else {
        console.log(`⚠️ 找不到排程任務: ${name}`);
      }

    } catch (error) {
      console.error(`❌ 移除排程任務 ${name} 失敗:`, error);
    }
  }
}

module.exports = SchedulerService;
