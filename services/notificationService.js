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
                            text: '📅 ' + messages.WEEKLY_REMINDER,
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
                                    text: messages.FREQUENCY,
                                    color: '#999999',
                                    size: 'sm',
                                    flex: 2
                                },
                                {
                                    type: 'text',
                                    text: this.formatWeekdays(reminder.weekdays, language),
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
     * 創建月度提醒訊息
     */
    createMonthlyReminderMessage(reminder, language) {
        const messages = REMINDER_MESSAGES[language];
        
        return {
            type: 'flex',
            altText: `📆 ${reminder.title}`,
            contents: {
                type: 'bubble',
                styles: {
                    header: {
                        backgroundColor: '#96CEB4'
                    }
                },
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '📆 ' + messages.MONTHLY_REMINDER,
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
                                    text: messages.MONTHLY_DATE,
                                    color: '#999999',
                                    size: 'sm',
                                    flex: 2
                                },
                                {
                                    type: 'text',
                                    text: `${reminder.monthDay}${language === 'ja' ? '日' : '號'}`,
                                    color: '#333333',
                                    size: 'sm',
                                    flex: 5,
                                    wrap: true
                                }
                            ]
                        }
                    ]
                }
            }
        };
    }

    /**
     * 創建自訂間隔提醒訊息
     */
    createCustomReminderMessage(reminder, language) {
        const messages = REMINDER_MESSAGES[language];
        
        return {
            type: 'flex',
            altText: `⚙️ ${reminder.title}`,
            contents: {
                type: 'bubble',
                styles: {
                    header: {
                        backgroundColor: '#FECA57'
                    }
                },
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '⚙️ ' + messages.CUSTOM_REMINDER,
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
                                    text: messages.INTERVAL,
                                    color: '#999999',
                                    size: 'sm',
                                    flex: 2
                                },
                                {
                                    type: 'text',
                                    text: `${reminder.interval}${language === 'ja' ? '日ごと' : '天一次'}`,
                                    color: '#333333',
                                    size: 'sm',
                                    flex: 5,
                                    wrap: true
                                }
                            ]
                        }
                    ]
                }
            }
        };
    }

    /**
     * 創建預設提醒訊息
     */
    createDefaultReminderMessage(reminder, language) {
        const messages = REMINDER_MESSAGES[language];
        
        return {
            type: 'text',
            text: `⏰ ${messages.REMINDER_NOTIFICATION}\n\n📝 ${reminder.title}\n${reminder.description ? `💭 ${reminder.description}` : ''}`
        };
    }

    /**
     * 發送延遲通知確認
     */
    async sendSnoozeConfirmation(userId, reminder, snoozeMinutes, language = 'zh') {
        const messages = REMINDER_MESSAGES[language];
        const nextTime = new Date(Date.now() + snoozeMinutes * 60000);
        
        const message = {
            type: 'text',
            text: `😴 ${messages.REMINDER_SNOOZED}\n\n📝 ${reminder.title}\n⏰ ${messages.NEXT_REMINDER}: ${this.formatDateTime(nextTime, language)}`
        };

        await this.client.pushMessage(userId, message);
    }

    /**
     * 發送完成確認
     */
    async sendCompletionConfirmation(userId, reminder, language = 'zh') {
        const messages = REMINDER_MESSAGES[language];
        
        const message = {
            type: 'text',
            text: `✅ ${messages.REMINDER_COMPLETED}\n\n📝 ${reminder.title}`
        };

        await this.client.pushMessage(userId, message);
    }

    /**
     * 發送批量提醒摘要
     */
    async sendReminderSummary(userId, reminders, language = 'zh') {
        if (reminders.length === 0) return;

        const messages = REMINDER_MESSAGES[language];
        
        const summaryMessage = {
            type: 'flex',
            altText: messages.DAILY_SUMMARY,
            contents: {
                type: 'bubble',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: `📋 ${messages.DAILY_SUMMARY}`,
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
                            text: `${messages.TODAY_REMINDERS} (${reminders.length})`,
                            weight: 'bold',
                            color: '#333333'
                        },
                        {
                            type: 'separator',
                            margin: 'md'
                        },
                        ...reminders.slice(0, 5).map((reminder, index) => ({
                            type: 'box',
                            layout: 'baseline',
                            spacing: 'sm',
                            contents: [
                                {
                                    type: 'text',
                                    text: `${index + 1}.`,
                                    color: '#999999',
                                    size: 'sm',
                                    flex: 1
                                },
                                {
                                    type: 'text',
                                    text: reminder.title,
                                    color: '#333333',
                                    size: 'sm',
                                    flex: 8,
                                    wrap: true
                                }
                            ]
                        })),
                        ...(reminders.length > 5 ? [{
                            type: 'text',
                            text: `... ${language === 'ja' ? 'その他' : '還有'} ${reminders.length - 5} ${language === 'ja' ? '件' : '項'}`,
                            color: '#999999',
                            size: 'sm',
                            align: 'center'
                        }] : [])
                    ]
                }
            }
        };

        await this.client.pushMessage(userId, summaryMessage);
    }

    /**
     * 格式化日期時間
     */
    formatDateTime(date, language) {
        if (!date) return '';
        
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };

        const locale = language === 'ja' ? 'ja-JP' : 'zh-TW';
        return date.toLocaleDateString(locale, options);
    }

    /**
     * 格式化週期
     */
    formatWeekdays(weekdays, language) {
        if (!weekdays || weekdays.length === 0) return '';
        
        const dayNames = {
            zh: ['日', '一', '二', '三', '四', '五', '六'],
            ja: ['日', '月', '火', '水', '木', '金', '土']
        };

        const names = dayNames[language] || dayNames.zh;
        return weekdays.map(day => names[day]).join(', ');
    }

    /**
     * 檢測語言
     */
    detectLanguage(text) {
        // 簡單的語言檢測邏輯
        const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF]/;
        return japaneseRegex.test(text) ? 'ja' : 'zh';
    }

    /**
     * 記錄通知歷史
     */
    async logNotification(reminder, status, error = null) {
        try {
            const logData = {
                reminderId: reminder.id,
                userId: reminder.userId,
                title: reminder.title,
                status: status, // 'sent', 'failed'
                timestamp: new Date().toISOString(),
                error: error
            };

            // 這裡可以實作將通知歷史記錄到 Google Sheets 或其他儲存系統
            console.log('通知記錄:', logData);
        } catch (error) {
            console.error('記錄通知歷史失敗:', error);
        }
    }

    /**
     * 處理提醒動作回調
     */
    async handleReminderAction(userId, action, reminderId, language = 'zh') {
        const messages = REMINDER_MESSAGES[language];
        
        switch (action) {
            case 'complete_reminder':
                // 標記提醒為完成（一次性提醒）
                return {
                    type: 'text',
                    text: messages.REMINDER_COMPLETED
                };
                
            case 'snooze_reminder':
                // 延遲提醒
                return {
                    type: 'text',
                    text: messages.SNOOZE_OPTIONS
                };
                
            case 'acknowledge_reminder':
                // 確認收到提醒
                return {
                    type: 'text',
                    text: messages.REMINDER_ACKNOWLEDGED
                };
                
            default:
                return null;
        }
    }
}

module.exports = new NotificationService();
