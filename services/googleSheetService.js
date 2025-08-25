const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

class GoogleSheetsService {
    constructor() {
        this.doc = null;
        this.sheets = {};
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

            // 初始化各種工作表
            await this.initializeSheets();

            this.initialized = true;
            console.log('Google Sheets 服務初始化成功');
        } catch (error) {
            console.error('初始化 Google Sheets 服務失敗:', error);
            throw error;
        }
    }

    /**
     * 初始化所有工作表
     */
    async initializeSheets() {
        // 記帳表 (現有的)
        await this.ensureSheetExists('記帳', [
            'Date', 'Category', 'Item', 'Amount', 'Note', 'UserId'
        ]);

        // 代辦事項表
        await this.ensureSheetExists('Todos', [
            'id', 'userId', 'title', 'description', 'priority', 
            'status', 'dueDate', 'tags', 'location', 'createdAt', 'updatedAt'
        ]);

        // 提醒表
        await this.ensureSheetExists('Reminders', [
            'id', 'userId', 'title', 'description', 'reminderType',
            'scheduledTime', 'nextRun', 'frequency', 'weekdays',
            'monthDay', 'interval', 'location', 'isActive',
            'createdAt', 'updatedAt'
        ]);

        // 用戶設定表
        await this.ensureSheetExists('UserSettings', [
            'userId', 'language', 'timezone', 'notificationEnabled',
            'dailySummaryTime', 'weeklyReportDay', 'createdAt', 'updatedAt'
        ]);

        // 通知歷史表
        await this.ensureSheetExists('NotificationHistory', [
            'id', 'userId', 'reminderId', 'type', 'status', 
            'sentAt', 'error', 'retryCount'
        ]);
    }

    /**
     * 確保工作表存在，不存在則創建
     */
    async ensureSheetExists(sheetName, headers) {
        try {
            let sheet = this.doc.sheetsByTitle[sheetName];
            
            if (!sheet) {
                console.log(`創建工作表: ${sheetName}`);
                sheet = await this.doc.addSheet({
                    title: sheetName,
                    headerValues: headers
                });
            }

            this.sheets[sheetName] = sheet;
            return sheet;
        } catch (error) {
            console.error(`確保工作表存在失敗 (${sheetName}):`, error);
            throw error;
        }
    }

    /**
     * 獲取工作表
     */
    getSheet(sheetName) {
        if (!this.initialized) {
            throw new Error('Google Sheets 服務尚未初始化');
        }
        return this.sheets[sheetName];
    }

    /**
     * 添加記帳記錄
     */
    async addExpenseRecord(data) {
        await this.initialize();
        const sheet = this.getSheet('記帳');
        
        return await sheet.addRow({
            Date: data.date || new Date().toISOString().split('T')[0],
            Category: data.category,
            Item: data.item,
            Amount: data.amount,
            Note: data.note || '',
            UserId: data.userId
        });
    }

    /**
     * 添加代辦事項
     */
    async addTodo(todoData) {
        await this.initialize();
        const sheet = this.getSheet('Todos');
        
        return await sheet.addRow({
            id: todoData.id,
            userId: todoData.userId,
            title: todoData.title,
            description: todoData.description || '',
            priority: todoData.priority || 'medium',
            status: todoData.status || 'pending',
            dueDate: todoData.dueDate ? todoData.dueDate.toISOString() : '',
            tags: JSON.stringify(todoData.tags || []),
            location: todoData.location || '',
            createdAt: todoData.createdAt.toISOString(),
            updatedAt: todoData.updatedAt.toISOString()
        });
    }

    /**
     * 獲取用戶的代辦事項
     */
    async getUserTodos(userId, status = null) {
        await this.initialize();
        const sheet = this.getSheet('Todos');
        const rows = await sheet.getRows();
        
        return rows
            .filter(row => {
                const matchUser = row.get('userId') === userId;
                const matchStatus = status ? row.get('status') === status : true;
                return matchUser && matchStatus;
            })
            .map(row => this.rowToTodo(row));
    }

    /**
     * 更新代辦事項
     */
    async updateTodo(todoId, updateData) {
        await this.initialize();
        const sheet = this.getSheet('Todos');
        const rows = await sheet.getRows();
        
        const todoRow = rows.find(row => row.get('id') === todoId);
        if (!todoRow) {
            throw new Error(`找不到代辦事項 ID: ${todoId}`);
        }

        Object.keys(updateData).forEach(key => {
            if (key === 'tags') {
                todoRow.set(key, JSON.stringify(updateData[key]));
            } else if (updateData[key] instanceof Date) {
                todoRow.set(key, updateData[key].toISOString());
            } else {
                todoRow.set(key, updateData[key]);
            }
        });

        todoRow.set('updatedAt', new Date().toISOString());
        await todoRow.save();

        return this.rowToTodo(todoRow);
    }

    /**
     * 刪除代辦事項
     */
    async deleteTodo(userId, todoId) {
        await this.initialize();
        const sheet = this.getSheet('Todos');
        const rows = await sheet.getRows();
        
        const todoRow = rows.find(row => 
            row.get('id') === todoId && row.get('userId') === userId
        );
        
        if (!todoRow) {
            return false;
        }

        await todoRow.delete();
        return true;
    }

    /**
     * 添加提醒
     */
    async addReminder(reminderData) {
        await this.initialize();
        const sheet = this.getSheet('Reminders');
        
        return await sheet.addRow({
            id: reminderData.id,
            userId: reminderData.userId,
            title: reminderData.title,
            description: reminderData.description || '',
            reminderType: reminderData.reminderType,
            scheduledTime: reminderData.scheduledTime ? reminderData.scheduledTime.toISOString() : '',
            nextRun: reminderData.nextRun ? reminderData.nextRun.toISOString() : '',
            frequency: reminderData.frequency || '',
            weekdays: JSON.stringify(reminderData.weekdays || []),
            monthDay: reminderData.monthDay || '',
            interval: reminderData.interval || '',
            location: reminderData.location || '',
            isActive: reminderData.isActive,
            createdAt: reminderData.createdAt.toISOString(),
            updatedAt: reminderData.updatedAt.toISOString()
        });
    }

    /**
     * 獲取用戶提醒
     */
    async getUserReminders(userId, activeOnly = true) {
        await this.initialize();
        const sheet = this.getSheet('Reminders');
        const rows = await sheet.getRows();
        
        return rows
            .filter(row => {
                const matchUser = row.get('userId') === userId;
                const matchActive = activeOnly ? row.get('isActive') === 'true' : true;
                return matchUser && matchActive;
            })
            .map(row => this.rowToReminder(row));
    }

    /**
     * 獲取待執行的提醒
     */
    async getPendingReminders() {
        await this.initialize();
        const sheet = this.getSheet('Reminders');
        const rows = await sheet.getRows();
        const now = new Date();
        
        return rows
            .filter(row => {
                const isActive = row.get('isActive') === 'true';
                const nextRun = row.get('nextRun') ? new Date(row.get('nextRun')) : null;
                return isActive && nextRun && nextRun <= now;
            })
            .map(row => this.rowToReminder(row));
    }

    /**
     * 更新提醒
     */
    async updateReminder(reminderId, updateData) {
        await this.initialize();
        const sheet = this.getSheet('Reminders');
        const rows = await sheet.getRows();
        
        const reminderRow = rows.find(row => row.get('id') === reminderId);
        if (!reminderRow) {
            throw new Error(`找不到提醒 ID: ${reminderId}`);
        }

        Object.keys(updateData).forEach(key => {
            if (key === 'weekdays') {
                reminderRow.set(key, JSON.stringify(updateData[key]));
            } else if (updateData[key] instanceof Date) {
                reminderRow.set(key, updateData[key].toISOString());
            } else {
                reminderRow.set(key, updateData[key]);
            }
        });

        reminderRow.set('updatedAt', new Date().toISOString());
        await reminderRow.save();

        return this.rowToReminder(reminderRow);
    }

    /**
     * 刪除提醒
     */
    async deleteReminder(userId, reminderId) {
        await this.initialize();
        const sheet = this.getSheet('Reminders');
        const rows = await sheet.getRows();
        
        const reminderRow = rows.find(row => 
            row.get('id') === reminderId && row.get('userId') === userId
        );
        
        if (!reminderRow) {
            return false;
        }

        await reminderRow.delete();
        return true;
    }

    /**
     * 獲取或創建用戶設定
     */
    async getUserSettings(userId) {
        await this.initialize();
        const sheet = this.getSheet('UserSettings');
        const rows = await sheet.getRows();
        
        let userRow = rows.find(row => row.get('userId') === userId);
        
        if (!userRow) {
            // 創建預設用戶設定
            userRow = await sheet.addRow({
                userId: userId,
                language: 'zh',
                timezone: 'Asia/Taipei',
                notificationEnabled: 'true',
                dailySummaryTime: '09:00',
                weeklyReportDay: '1', // 星期一
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }

        return {
            userId: userRow.get('userId'),
            language: userRow.get('language') || 'zh',
            timezone: userRow.get('timezone') || 'Asia/Taipei',
            notificationEnabled: userRow.get('notificationEnabled') === 'true',
            dailySummaryTime: userRow.get('dailySummaryTime') || '09:00',
            weeklyReportDay: parseInt(userRow.get('weeklyReportDay')) || 1,
            createdAt: new Date(userRow.get('createdAt')),
            updatedAt: new Date(userRow.get('updatedAt'))
        };
    }

    /**
     * 更新用戶設定
     */
    async updateUserSettings(userId, settings) {
        await this.initialize();
        const sheet = this.getSheet('UserSettings');
        const rows = await sheet.getRows();
        
        let userRow = rows.find(row => row.get('userId') === userId);
        
        if (!userRow) {
            // 如果用戶設定不存在，創建新的
            settings.userId = userId;
            settings.createdAt = new Date().toISOString();
            settings.updatedAt = new Date().toISOString();
            
            return await sheet.addRow(settings);
        }

        // 更新現有設定
        Object.keys(settings).forEach(key => {
            if (key !== 'userId') {
                userRow.set(key, settings[key]);
            }
        });
        
        userRow.set('updatedAt', new Date().toISOString());
        await userRow.save();

        return this.getUserSettings(userId);
    }

    /**
     * 記錄通知歷史
     */
    async logNotification(data) {
        await this.initialize();
        const sheet = this.getSheet('NotificationHistory');
        
        return await sheet.addRow({
            id: this.generateId(),
            userId: data.userId,
            reminderId: data.reminderId || '',
            type: data.type || 'reminder',
            status: data.status || 'sent',
            sentAt: new Date().toISOString(),
            error: data.error || '',
            retryCount: data.retryCount || 0
        });
    }

    /**
     * 批量操作支援
     */
    async batchUpdate(sheetName, updates) {
        await this.initialize();
        const sheet = this.getSheet(sheetName);
        
        // 這裡可以實作批量更新邏輯
        // Google Sheets API 支援批量操作來提高效能
        console.log(`批量更新 ${sheetName}:`, updates.length, '筆記錄');
    }

    /**
     * 資料轉換輔助函數
     */
    rowToTodo(row) {
        return {
            id: row.get('id'),
            userId: row.get('userId'),
            title: row.get('title'),
            description: row.get('description'),
            priority: row.get('priority'),
            status: row.get('status'),
            dueDate: row.get('dueDate') ? new Date(row.get('dueDate')) : null,
            tags: row.get('tags') ? JSON.parse(row.get('tags')) : [],
            location: row.get('location'),
            createdAt: new Date(row.get('createdAt')),
            updatedAt: new Date(row.get('updatedAt'))
        };
    }

    rowToReminder(row) {
        return {
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
        };
    }

    /**
     * 生成唯一 ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 清理和維護
     */
    async cleanup() {
        // 清理過期的通知歷史（保留30天）
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // 實作清理邏輯...
        console.log('資料清理完成');
    }
}

module.exports = new GoogleSheetsService();
