const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const Reminder = require('../models/Reminder');
const { REMINDER_MESSAGES } = require('../constants/todoMessages');

class ReminderService {
    constructor() {
        this.doc = null;
        this.reminderSheet = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            const serviceAccountAuth = new JWT({
                email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });

            this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
            await this.doc.loadInfo();

            // 查找或創建 Reminders sheet
            this.reminderSheet = this.doc.sheetsByTitle['Reminders'];
            if (!this.reminderSheet) {
                this.reminderSheet = await this.doc.addSheet({
                    title: 'Reminders',
                    headerValues: [
                        'id', 'userId', 'title', 'description', 'reminderType',
                        'scheduledTime', 'nextRun', 'frequency', 'weekdays',
                        'monthDay', 'interval', 'location', 'isActive',
                        'createdAt', 'updatedAt'
                    ]
                });
            }

            this.initialized = true;
        } catch (error) {
            console.error('初始化 ReminderService 失敗:', error);
            throw error;
        }
    }

    /**
     * 創建新提醒
     */
    async createReminder(reminderData) {
        await this.initialize();

        try {
            const reminder = new Reminder(reminderData);
            
            // 計算下次執行時間
            reminder.calculateNextRun();

            // 保存到 Google Sheets
            await this.reminderSheet.addRow({
                id: reminder.id,
                userId: reminder.userId,
                title: reminder.title,
                description: reminder.description,
                reminderType: reminder.reminderType,
                scheduledTime: reminder.scheduledTime?.toISOString(),
                nextRun: reminder.nextRun?.toISOString(),
                frequency: reminder.frequency,
                weekdays: JSON.stringify(reminder.weekdays),
                monthDay: reminder.monthDay,
                interval: reminder.interval,
                location: reminder.location,
                isActive: reminder.isActive,
                createdAt: reminder.createdAt.toISOString(),
                updatedAt: reminder.updatedAt.toISOString()
            });

            return reminder;
        } catch (error) {
            console.error('創建提醒失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取用戶的所有提醒
     */
    async getUserReminders(userId, language = 'zh') {
        await this.initialize();

        try {
            const rows = await this.reminderSheet.getRows();
            const userReminders = rows
                .filter(row => row.get('userId') === userId && row.get('isActive') === 'true')
                .map(row => this.rowToReminder(row))
                .sort((a, b) => new Date(a.nextRun) - new Date(b.nextRun));

            return userReminders;
        } catch (error) {
            console.error('獲取用戶提醒失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取需要執行的提醒
     */
    async getPendingReminders() {
        await this.initialize();

        try {
            const rows = await this.reminderSheet.getRows();
            const now = new Date();
            
            const pendingReminders = rows
                .filter(row => {
                    const isActive = row.get('isActive') === 'true';
                    const nextRun = new Date(row.get('nextRun'));
                    return isActive && nextRun <= now;
                })
                .map(row => this.rowToReminder(row));

            return pendingReminders;
        } catch (error) {
            console.error('獲取待執行提醒失敗:', error);
            throw error;
        }
    }

    /**
     * 更新提醒的下次執行時間
     */
    async updateReminderNextRun(reminderId) {
        await this.initialize();

        try {
            const rows = await this.reminderSheet.getRows();
            const reminderRow = rows.find(row => row.get('id') === reminderId);
            
            if (!reminderRow) {
                throw new Error(`找不到提醒 ID: ${reminderId}`);
            }

            const reminder = this.rowToReminder(reminderRow);
            
            // 重新計算下次執行時間
            reminder.calculateNextRun();
            
            // 如果是一次性提醒，則停用
            if (reminder.reminderType === 'once') {
                reminder.isActive = false;
            }

            // 更新資料
            reminderRow.set('nextRun', reminder.nextRun?.toISOString() || '');
            reminderRow.set('isActive', reminder.isActive);
            reminderRow.set('updatedAt', new Date().toISOString());
            
            await reminderRow.save();

            return reminder;
        } catch (error) {
            console.error('更新提醒執行時間失敗:', error);
            throw error;
        }
    }

    /**
     * 刪除提醒
     */
    async deleteReminder(userId, reminderId, language = 'zh') {
        await this.initialize();

        try {
            const rows = await this.reminderSheet.getRows();
            const reminderRow = rows.find(row => 
                row.get('id') === reminderId && row.get('userId') === userId
            );

            if (!reminderRow) {
                return {
                    success: false,
                    message: REMINDER_MESSAGES[language].REMINDER_NOT_FOUND
                };
            }

            await reminderRow.delete();

            return {
                success: true,
                message: REMINDER_MESSAGES[language].REMINDER_DELETED
            };
        } catch (error) {
            console.error('刪除提醒失敗:', error);
            throw error;
        }
    }

    /**
     * 切換提醒狀態（啟用/停用）
     */
    async toggleReminderStatus(userId, reminderId, language = 'zh') {
        await this.initialize();

        try {
            const rows = await this.reminderSheet.getRows();
            const reminderRow = rows.find(row => 
                row.get('id') === reminderId && row.get('userId') === userId
            );

            if (!reminderRow) {
                return {
                    success: false,
                    message: REMINDER_MESSAGES[language].REMINDER_NOT_FOUND
                };
            }

            const currentStatus = reminderRow.get('isActive') === 'true';
            const newStatus = !currentStatus;

            reminderRow.set('isActive', newStatus);
            reminderRow.set('updatedAt', new Date().toISOString());
            await reminderRow.save();

            return {
                success: true,
                message: newStatus ? 
                    REMINDER_MESSAGES[language].REMINDER_ACTIVATED : 
                    REMINDER_MESSAGES[language].REMINDER_DEACTIVATED,
                isActive: newStatus
            };
        } catch (error) {
            console.error('切換提醒狀態失敗:', error);
            throw error;
        }
    }

    /**
     * 搜索提醒
     */
    async searchReminders(userId, keyword, language = 'zh') {
        await this.initialize();

        try {
            const userReminders = await this.getUserReminders(userId, language);
            const filteredReminders = userReminders.filter(reminder => 
                reminder.title.toLowerCase().includes(keyword.toLowerCase()) ||
                reminder.description.toLowerCase().includes(keyword.toLowerCase())
            );

            return filteredReminders;
        } catch (error) {
            console.error('搜索提醒失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取提醒統計
     */
    async getReminderStats(userId, language = 'zh') {
        await this.initialize();

        try {
            const reminders = await this.getUserReminders(userId, language);
            
            const stats = {
                total: reminders.length,
                active: reminders.filter(r => r.isActive).length,
                inactive: reminders.filter(r => !r.isActive).length,
                byType: {
                    once: reminders.filter(r => r.reminderType === 'once').length,
                    daily: reminders.filter(r => r.reminderType === 'daily').length,
                    weekly: reminders.filter(r => r.reminderType === 'weekly').length,
                    monthly: reminders.filter(r => r.reminderType === 'monthly').length,
                    custom: reminders.filter(r => r.reminderType === 'custom').length
                },
                upcoming: reminders
                    .filter(r => r.isActive && new Date(r.nextRun) > new Date())
                    .slice(0, 5)
            };

            return stats;
        } catch (error) {
            console.error('獲取提醒統計失敗:', error);
            throw error;
        }
    }

    /**
     * 將 Google Sheets 行轉換為 Reminder 物件
     */
    rowToReminder(row) {
        return new Reminder({
            id: row.get('id'),
            userId: row.get('userId'),
            title: row.get('title'),
            description: row.get('description'),
            reminderType: row.get('reminderType'),
            scheduledTime: row.get('scheduledTime') ? new Date(row.get('scheduledTime')) : null,
            nextRun: row.get('nextRun') ? new Date(row.get('nextRun')) : null,
            frequency: row.get('frequency'),
            weekdays: row.get('weekdays') ? JSON.parse(row.get('weekdays')) : [],
            monthDay: row.get('monthDay') ? parseInt(row.get('monthDay')) : null,
            interval: row.get('interval') ? parseInt(row.get('interval')) : null,
            location: row.get('location'),
            isActive: row.get('isActive') === 'true',
            createdAt: new Date(row.get('createdAt')),
            updatedAt: new Date(row.get('updatedAt'))
        });
    }
}

module.exports = new ReminderService();
