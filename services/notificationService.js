// services/notificationService.js
const line = require('@line/bot-sdk');
require('dotenv').config();

class NotificationService {
    constructor() {
        // 檢查環境變數
        const channelAccessToken = process.env.CHANNEL_ACCESS_TOKEN;
        const channelSecret = process.env.CHANNEL_SECRET;
        
        if (!channelAccessToken || !channelSecret) {
            console.error('❌ 缺少 LINE Bot 環境變數:');
            console.error('   CHANNEL_ACCESS_TOKEN:', channelAccessToken ? '✅ 已設定' : '❌ 未設定');
            console.error('   CHANNEL_SECRET:', channelSecret ? '✅ 已設定' : '❌ 未設定');
            
            // 不要拋出錯誤，改為停用通知功能
            this.enabled = false;
            this.client = null;
            return;
        }
        
        // 建立 LINE Client
        try {
            const config = {
                channelAccessToken,
                channelSecret
            };
            
            this.client = new line.Client(config);
            this.enabled = true;
            console.log('✅ LINE Bot 客戶端已初始化');
            
        } catch (error) {
            console.error('❌ LINE Bot 客戶端初始化失敗:', error.message);
            this.enabled = false;
            this.client = null;
        }
    }
    
    // 檢查服務是否可用
    isEnabled() {
        return this.enabled;
    }
    
    // 發送通知
    async sendNotification(userId, message) {
        if (!this.enabled) {
            console.log('⚠️ 通知服務已停用，跳過發送通知');
            return { success: false, reason: 'service_disabled' };
        }
        
        try {
            await this.client.pushMessage(userId, message);
            console.log(`✅ 通知已發送給用戶: ${userId}`);
            return { success: true };
        } catch (error) {
            console.error('❌ 發送通知失敗:', error.message);
            return { success: false, error: error.message };
        }
    }
    
    // 回覆訊息
    async replyMessage(replyToken, message) {
        if (!this.enabled) {
            console.log('⚠️ 通知服務已停用，跳過回覆訊息');
            return { success: false, reason: 'service_disabled' };
        }
        
        try {
            await this.client.replyMessage(replyToken, message);
            console.log('✅ 回覆訊息已發送');
            return { success: true };
        } catch (error) {
            console.error('❌ 回覆訊息失敗:', error.message);
            return { success: false, error: error.message };
        }
    }
    
    // 處理提醒操作
    async handleReminderAction(userId, action, itemId) {
        if (!this.enabled) {
            return {
                type: 'text',
                text: '⚠️ 通知服務暫時無法使用'
            };
        }
        
        try {
            let responseText = '';
            
            switch (action) {
                case 'complete_reminder':
                    responseText = '✅ 提醒已標記為完成';
                    break;
                case 'snooze_reminder':
                    responseText = '⏰ 提醒已延遲5分鐘';
                    break;
                case 'acknowledge_reminder':
                    responseText = '👌 提醒已確認';
                    break;
                default:
                    responseText = '❓ 未知操作';
            }
            
            return {
                type: 'text',
                text: responseText
            };
            
        } catch (error) {
            console.error('處理提醒操作失敗:', error);
            return {
                type: 'text',
                text: '❌ 操作失敗，請稍後再試'
            };
        }
    }
    
    // 發送每日摘要
    async sendDailySummary(userId, summary) {
        if (!this.enabled) {
            console.log('⚠️ 通知服務已停用，跳過每日摘要');
            return;
        }
        
        const message = {
            type: 'text',
            text: `📊 每日摘要\n\n${summary}`
        };
        
        return this.sendNotification(userId, message);
    }
    
    // 發送週報
    async sendWeeklyReport(userId, report) {
        if (!this.enabled) {
            console.log('⚠️ 通知服務已停用，跳過週報');
            return;
        }
        
        const message = {
            type: 'text',
            text: `📈 週報\n\n${report}`
        };
        
        return this.sendNotification(userId, message);
    }
}

// 創建單例實例
const notificationService = new NotificationService();

// 匯出實例（不要在這裡創建新的實例）
module.exports = notificationService;
