const { getGoogleSheetsService } = require('./googleSheetsService');
const { parseDateTime } = require('../utils/dateTimeParser');
const { generateId } = require('../utils/helpers');

class ReminderService {
    constructor() {
        this.googleService = getGoogleSheetsService();
    }

    // 新增提醒
    async createReminder(userId, content, dateTimeStr, options = {}) {
        try {
            const {
                repeatType = 'once',  // once, daily, weekly, monthly, custom
                language = 'zh',      // zh, ja
                location = '',        // 位置相關提醒
                customInterval = 0    // 自訂間隔（天）
            } = options;

            // 解析時間
            const parsedDateTime = parseDateTime(dateTimeStr, language);
            if (!parsedDateTime.isValid) {
                throw new Error(`無法解析時間: ${dateTimeStr}`);
            }

            // 生成唯一ID
            const id = generateId();

            // 準備資料
            const reminderData = [
                id,                                    // ID
                userId,                               // 用戶ID
                content,                              // 提醒內容
                parsedDateTime.isoString,             // 提醒時間 (ISO格式)
                repeatType,                           // 重複類型
                '啟用',                               // 狀態
                new Date().toISOString(),             // 創建時間
                location,                             // 位置
                language,                             // 語言
                customInterval.toString()             // 自訂間隔
            ];

            await this.googleService.addReminder(reminderData);

            return {
                success: true,
                id: id,
                reminder: {
                    content,
                    dateTime: parsedDateTime.readable,
                    repeatType,
                    language
                }
            };

        } catch (error) {
            console.error('❌ Failed to create reminder:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 獲取用戶的所有提醒
    async getUserReminders(userId) {
        try {
            const reminders = await this.googleService.searchReminders(userId);
            
            return reminders
                .filter(reminder => reminder.length >= 6 && reminder[5] === '啟用') // 過濾啟用的提醒
                .map((reminder, index) => {
                    const [id, uid, content, dateTime, repeatType, status, createTime, location, language] = reminder;
                    
                    return {
                        index: index + 2, // Google Sheets 行號 (考慮標題行)
                        id,
                        content,
                        dateTime: this.formatDateTime(dateTime),
                        repeatType: this.translateRepeatType(repeatType, language),
                        location,
                        language,
                        createTime: this.formatDateTime(createTime)
                    };
                });

        } catch (error) {
            console.error('❌ Failed to get user reminders:', error.message);
            return [];
        }
    }

    // 刪除提醒
    async deleteReminder(userId, reminderId) {
        try {
            const userReminders = await this.getUserReminders(userId);
            const reminder = userReminders.find(r => r.id === reminderId);

            if (!reminder) {
                return { success: false, error: '找不到指定的提醒' };
            }

            // 更新狀態為停用而不是真正刪除
            const updatedData = [
                reminder.id,
                userId,
                reminder.content,
                reminder.dateTime,
                reminder.repeatType,
                '停用', // 狀態改為停用
                reminder.createTime,
                reminder.location || '',
                reminder.language || 'zh',
                ''
            ];

            await this.googleService.updateReminder(reminder.index, updatedData);

            return { success: true, message: '提醒已刪除' };

        } catch (error) {
            console.error('❌ Failed to delete reminder:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 搜尋提醒
    async searchReminders(userId, query) {
        try {
            const allReminders = await this.getUserReminders(userId);
            
            return allReminders.filter(reminder => 
                reminder.content.includes(query) || 
                reminder.dateTime.includes(query)
            );

        } catch (error) {
            console.error('❌ Failed to search reminders:', error.message);
            return [];
        }
    }

    // 獲取即將到期的提醒
    async getUpcomingReminders(timeframe = 60) {
        try {
            return await this.googleService.getUpcomingReminders(timeframe);
        } catch (error) {
            console.error('❌ Failed to get upcoming reminders:', error.message);
            return [];
        }
    }

    // 計算下次提醒時間（用於重複提醒）
    calculateNextReminder(dateTime, repeatType, customInterval = 0) {
        const date = new Date(dateTime);
        
        switch (repeatType) {
            case 'daily':
                date.setDate(date.getDate() + 1);
                break;
            case 'weekly':
                date.setDate(date.getDate() + 7);
                break;
            case 'monthly':
                date.setMonth(date.getMonth() + 1);
                break;
            case 'custom':
                if (customInterval > 0) {
                    date.setDate(date.getDate() + customInterval);
                }
                break;
            default:
                return null; // 一次性提醒
        }

        return date.toISOString();
    }

    // 工具函數：格式化時間顯示
    formatDateTime(isoString) {
        try {
            const date = new Date(isoString);
            return date.toLocaleString('zh-TW', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        } catch (error) {
            return isoString;
        }
    }

    // 工具函數：翻譯重複類型
    translateRepeatType(type, language = 'zh') {
        const translations = {
            zh: {
                'once': '一次性',
                'daily': '每日',
                'weekly': '每週',
                'monthly': '每月',
                'custom': '自訂'
            },
            ja: {
                'once': '一回のみ',
                'daily': '毎日',
                'weekly': '毎週',
                'monthly': '毎月',
                'custom': 'カスタム'
            }
        };

        return translations[language]?.[type] || type;
    }

    // 驗證提醒資料
    validateReminderData(content, dateTimeStr) {
        const errors = [];

        if (!content || content.trim().length === 0) {
            errors.push('提醒內容不能為空');
        }

        if (!dateTimeStr || dateTimeStr.trim().length === 0) {
            errors.push('請指定提醒時間');
        }

        if (content && content.length > 200) {
            errors.push('提醒內容不能超過200字元');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = { ReminderService };
