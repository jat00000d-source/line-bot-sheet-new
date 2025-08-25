const { Client } = require('@line/bot-sdk');
const { REMINDER_MESSAGES } = require('../constants/todoMessages');

class NotificationService {
    constructor() {
        this.client = new Client({
            channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
        });
    }

    /**
     * 發送提醒通知
     */
    async sendReminderNotification(reminder) {
        try {
            // 根據用戶語言偏好決定語言（這裡簡化處理，可以從用戶設定中獲取）
            const language = this.detectLanguage(reminder.title) || 'zh';
            
            const message = this.createReminderMessage(reminder, language);
            
            await this.client.pushMessage(reminder.userId, message);
            
            console.log(`提醒通知已發送給用戶 ${reminder.userId}: ${reminder.title}`);
            
            // 記錄通知歷史（可選）
            await this.logNotification(reminder, 'sent');
            
        } catch (error) {
            console.error('發送提醒通知失敗:', error);
            await this.logNotification(reminder, 'failed', error.message);
            throw error;
        }
    }

    /**
     * 創建提醒訊息
     */
    createReminderMessage(reminder, language) {
        const messages = REMINDER_MESSAGES[language];
        
        // 根據提醒類型創建不同的訊息格式
        switch (reminder.reminderType) {
            case 'once':
                return this.createOnceReminderMessage(reminder, language);
            case 'daily':
                return this.createDailyReminderMessage(reminder, language);
            case 'weekly':
                return this.createWeeklyReminderMessage(reminder, language);
            case 'monthly':
                return this.createMonthlyReminderMessage(reminder, language);
            case 'custom':
                return this.createCustomReminderMessage(reminder, language);
            default:
                return this.createDefaultReminderMessage(reminder, language);
        }
    }

    /**
     * 創建一次性提醒訊息
     */
    createOnceReminderMessage(reminder, language) {
        const messages = REMINDER_MESSAGES[language];
        
        return {
            type: 'flex',
            altText: `⏰ ${reminder.title}`,
            contents: {
                type: 'bubble',
                styles: {
                    header: {
                        backgroundColor: '#FF6B6B'
                    }
                },
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '⏰ ' + messages.REMINDER_NOTIFICATION,
                            color: '#FFFFFF',
                            weight: 'bold',
                            size: 'lg'
                        }
                    ]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'md',
                    contents: [
                        {
                            type: 'text',
                            text: reminder.title,
                            weight: 'bold',
                            size: 'xl',
                            color: '#333333'
                        },
                        ...(reminder.description ? [{
                            type: 'text',
                            text: reminder.description,
                            color: '#666666',
                            wrap: true
                        }] : []),
                        {
                            type: 'separator',
                            margin: 'md'
                        },
                        {
                            type: 'box',
                            layout: 'vertical',
                            spacing: 'sm',
                            contents: [
                                {
                                    type: 'box',
                                    layout: 'baseline',
                                    spacing: 'sm',
                                    contents: [
                                        {
                                            type: 'text',
                                            text: messages.TYPE,
                                            color: '#999999',
                                            size: 'sm',
                                            flex: 2
                                        },
                                        {
                                            type: 'text',
                                            text: messages.REMINDER_TYPES.ONCE,
                                            color: '#333333',
                                            size: 'sm',
                                            flex: 5,
                                            wrap: true
                                        }
                                    ]
                                },
                                {
                                    type: 'box',
                                    layout: 'baseline',
                                    spacing: 'sm',
                                    contents: [
                                        {
                                            type: 'text',
                                            text: messages.TIME,
                                            color: '#999999',
                                            size: 'sm',
                                            flex: 2
                                        },
                                        {
                                            type: 'text',
                                            text: this.formatDateTime(reminder.scheduledTime, language),
                                            color: '#333333',
                                            size: 'sm',
                                            flex: 5,
                                            wrap: true
                                        }
                                    ]
                                },
                                ...(reminder.location ? [{
                                    type: 'box',
                                    layout: 'baseline',
                                    spacing: 'sm',
                                    contents: [
                                        {
                                            type: 'text',
                                            text: '📍 ' + messages.LOCATION,
                                            color: '#999999',
                                            size: 'sm',
                                            flex: 2
                                        },
                                        {
                                            type: 'text',
                                            text: reminder.location,
                                            color: '#333333',
                                            size: 'sm',
                                            flex: 5,
                                            wrap: true
                                        }
                                    ]
                                }] : [])
                            ]
                        }
                    ]
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'sm',
                    contents: [
                        {
                            type: 'button',
                            style: 'primary',
                            height: 'sm',
                            action: {
                                type: 'postback',
                                label: messages.MARK_COMPLETED,
                                data: `action=complete_reminder&id=${reminder.id}`
                            }
                        },
                        {
                            type: 'button',
                            style: 'secondary',
                            height: 'sm',
                            action: {
                                type: 'postback',
                                label: messages.SNOOZE_REMINDER,
                                data: `action=snooze_reminder&id=${reminder.id}`
                            }
                        }
                    ]
                }
            }
        };
    }

    /**
     * 創建每日提醒訊息
     */
    createDailyReminderMessage(reminder, language) {
        const messages = REMINDER_MESSAGES[language];
        
        return {
            type: 'flex',
            altText: `🔄 ${reminder.title}`,
            contents: {
                type: 'bubble',
                styles: {
                    header: {
                        backgroundColor: '#4ECDC4'
                    }
                },
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '🔄 ' + messages.DAILY_REMINDER,
                            color: '#FFFFFF',
                            weight: 'bold',
                            size: 'lg'
                        }
                    ]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'md',
                    contents: [
                        {
                            type: 'text',
                            text: reminder.title,
                            weight: 'bold',
                            size: 'xl',
                            color: '#333333'
                        },
                        ...(reminder.description ? [{
                            type: 'text',
                            text: reminder.description,
                            color: '#666666',
                            wrap: true
                        }] : []),
                        {
                            type: 'separator',
                            margin: 'md'
                        },
                        {
                            type: 'box',
                            layout: 'baseline',
                            spacing: 'sm',
                            contents: [
                                {
                                    type: 'text',
                                    text: messages.NEXT_REMINDER,
                                    color: '#999999',
                                    size: 'sm',
                                    flex: 2
                                },
                                {
                                    type: 'text',
                                    text: messages.TOMORROW_SAME_TIME,
                                    color: '#333333',
                                    size: 'sm',
                                    flex: 5,
                                    wrap: true
                                }
                            ]
                        }
                    ]
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'sm',
                    contents: [
                        {
                            type: 'button',
                            style: 'primary',
                            height: 'sm',
                            action: {
                                type: 'postback',
                                label: messages.ACKNOWLEDGE,
                                data: `action=acknowledge_reminder&id=${reminder.id}`
                            }
                        }
                    ]
                }
            }
        };
    }

    /**
     * 創建週期性提醒訊息
     */
    createWeeklyReminderMessage(reminder, language) {
        const messages = REMINDER_MESSAGES[language];
        
        return {
            type: 'flex',
            altText: `📅 ${reminder.title}`,
            contents: {
                type: 'bubble',
                styles: {
                    header: {
                        backgroundColor: '#45B7D1'
                    }
                },
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '📅 ' + messages
