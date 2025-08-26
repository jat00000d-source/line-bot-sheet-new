// services/notificationService.js - 修復版
const moment = require('moment-timezone');

class NotificationService {
  constructor(lineClient) {
    if (!lineClient) {
      throw new Error('NotificationService 需要 LINE client');
    }
    this.client = lineClient;
    console.log('📢 NotificationService 初始化完成');
  }

  /**
   * 發送文字訊息
   */
  async sendText(userId, message) {
    if (!userId || !message) {
      throw new Error('sendText 需要 userId 與 message');
    }

    try {
      await this.client.pushMessage(userId, {
        type: 'text',
        text: message
      });
      console.log(`✅ 已發送訊息給 ${userId}: ${message}`);
    } catch (err) {
      console.error('❌ 發送訊息失敗:', err);
      throw err;
    }
  }

  /**
   * 發送多筆訊息
   */
  async sendMessages(userId, messages = []) {
    if (!userId || messages.length === 0) {
      throw new Error('sendMessages 需要 userId 與至少一筆訊息');
    }

    try {
      await this.client.pushMessage(userId, messages);
      console.log(`✅ 已發送 ${messages.length} 則訊息給 ${userId}`);
    } catch (err) {
      console.error('❌ 發送多筆訊息失敗:', err);
      throw err;
    }
  }

  /**
   * 發送通知訊息
   */
  async sendNotification(userId, message, type = 'info') {
    try {
      const icons = {
        'info': 'ℹ️',
        'success': '✅',
        'warning': '⚠️',
        'error': '❌',
        'reminder': '⏰'
      };

      const formattedMessage = {
        type: 'text',
        text: `${icons[type]} ${message}\n\n🕐 ${moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss JST')}`
      };

      const result = await this.client.pushMessage(userId, formattedMessage);
      console.log(`📨 通知已發送給用戶 ${userId}:`, message);
      return result;

    } catch (error) {
      console.error(`❌ 發送通知失敗 (用戶: ${userId}):`, error);
      throw error;
    }
  }

  /**
   * 批量發送通知
   */
  async sendBulkNotification(userIds, message, type = 'info') {
    const promises = userIds.map(userId => 
      this.sendNotification(userId, message, type)
    );

    try {
      const results = await Promise.allSettled(promises);
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      console.log(`📊 批量通知結果: ${successful} 成功, ${failed} 失敗`);
      return { successful, failed };

    } catch (error) {
      console.error('❌ 批量發送通知時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 發送支出總覽
   */
  async sendExpenseSummary(userId, expenses, language = 'zh') {
    try {
      if (expenses.length === 0) {
        const noExpenseMsg = language === 'ja' ? 
          '今日の支出記録はありません。' :
          '今天沒有支出記錄。';
        
        return await this.sendNotification(userId, noExpenseMsg, 'info');
      }

      const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const title = language === 'ja' ? '📊 今日の支出サマリー' : '📊 今日支出總覽';
      
      let summaryText = `${title}\n\n💰 總計: ${total}元\n📝 筆數: ${expenses.length}筆\n\n`;
      
      // 按類別分組
      const categoryTotals = expenses.reduce((acc, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
        return acc;
      }, {});

      summaryText += '📋 分類明細:\n';
      Object.entries(categoryTotals).forEach(([category, amount]) => {
        summaryText += `• ${category}: ${amount}元\n`;
      });

      return await this.sendNotification(userId, summaryText, 'info');

    } catch (error) {
      console.error('❌ 發送支出總覽失敗:', error);
      throw error;
    }
  }

  /**
   * 發送提醒列表
   */
  async sendReminderList(userId, reminders, language = 'zh') {
    try {
      if (reminders.length === 0) {
        const noReminderMsg = language === 'ja' ? 
          '設定されているリマインダーはありません。' :
          '沒有設定任何提醒。';
        
        return await this.sendNotification(userId, noReminderMsg, 'info');
      }

      const title = language === 'ja' ? '📋 リマインダー一覧' : '📋 提醒列表';
      let listText = `${title}\n\n`;

      reminders.forEach((reminder, index) => {
        listText += `${index + 1}. ${reminder.title}\n`;
        listText += `   ⏰ ${reminder.reminderTime}\n`;
        listText += `   📅 ${this.getTypeText(reminder.type, language)}\n\n`;
      });

      return await this.sendNotification(userId, listText, 'info');

    } catch (error) {
      console.error('❌ 發送提醒列表失敗:', error);
      throw error;
    }
  }

  /**
   * 取得類型文字
   */
  getTypeText(type, language) {
    const types = {
      'once': { ja: '一回のみ', zh: '單次' },
      'daily': { ja: '毎日', zh: '每天' },
      'weekly': { ja: '毎週', zh: '每週' },
      'monthly': { ja: '毎月', zh: '每月' }
    };
    
    return types[type] ? types[type][language] : type;
  }

  /**
   * 發送系統狀態通知
   */
  async sendSystemStatus(userId, status, details = '') {
    const statusTexts = {
      'startup': '🚀 系統已啟動',
      'shutdown': '🔴 系統正在關閉',
      'error': '❌ 系統發生錯誤',
      'maintenance': '🔧 系統維護中'
    };

    const message = statusTexts[status] || status;
    const fullMessage = details ? `${message}\n\n${details}` : message;

    return await this.sendNotification(userId, fullMessage, 'info');
  }
}

module.exports = NotificationService;
