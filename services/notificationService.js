// services/NotificationService.js
const line = require('@line/bot-sdk');

class NotificationService {
    /**
     * 建構子
     * @param {line.Client} client - LINE Messaging API client
     */
    constructor(client) {
        if (!client) {
            throw new Error('NotificationService 需要 LINE client');
        }
        this.client = client;
    }

    /**
     * 發送文字訊息
     * @param {string} userId - LINE 使用者 ID
     * @param {string} message - 要發送的文字
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
        }
    }

    /**
     * 發送多筆訊息
     * @param {string} userId - LINE 使用者 ID
     * @param {Array} messages - 訊息陣列
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
        }
    }
}

module.exports = NotificationService;
