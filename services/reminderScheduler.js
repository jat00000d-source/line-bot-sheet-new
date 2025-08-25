const cron = require('node-cron');
const reminderService = require('./reminderService');
const notificationService = require('./notificationService');

class ReminderScheduler {
    constructor() {
        this.scheduledTasks = new Map();
        this.isRunning = false;
    }

    /**
     * 啟動排程器
     */
    start() {
        if (this.isRunning) {
            console.log('排程器已經在運行中');
            return;
        }

        console.log('啟動提醒排程器...');
        
        // 每分鐘檢查一次待執行的提醒
        this.mainTask = cron.schedule('* * * * *', async () => {
            await this.checkAndExecuteReminders();
        }, {
            scheduled: false,
            timezone: 'Asia/Taipei'
        });

        this.mainTask.start();
        this.isRunning = true;
        
        console.log('提醒排程器已啟動');
    }

    /**
     * 停止排程器
     */
    stop() {
        if (!this.isRunning) {
            console.log('排程器沒有在運行');
            return;
        }

        console.log('停止提醒排程器...');
        
        if (this.mainTask) {
            this.mainTask.destroy();
        }

        // 停止所有個別排程任務
        this.scheduledTasks.forEach((task) => {
            task.destroy();
        });
        this.scheduledTasks.clear();

        this.isRunning = false;
        console.log('提醒排程器已停止');
    }

    /**
     * 重啟排程器
     */
    restart() {
        this.stop();
        setTimeout(() => {
            this.start();
        }, 1000);
    }

    /**
     * 檢查並執行待執行的提醒
     */
    async checkAndExecuteReminders() {
        try {
            const pendingReminders = await reminderService.getPendingReminders();
            
            if (pendingReminders.length === 0) {
                return;
            }

            console.log(`找到 ${pendingReminders.length} 個待執行的提醒`);

            for (const reminder of pendingReminders) {
                await this.executeReminder(reminder);
            }
        } catch (error) {
            console.error('檢查待執行提醒時發生錯誤:', error);
        }
    }

    /**
     * 執行單個提醒
     */
    async executeReminder(reminder) {
        try {
            console.log(`執行提醒: ${reminder.title} (ID: ${reminder.id})`);

            // 發送通知
            await notificationService.sendReminderNotification(reminder);

            // 更新下次執行時間
            await reminderService.updateReminderNextRun(reminder.id);

            console.log(`提醒執行完成: ${reminder.title}`);
        } catch (error) {
            console.error(`執行提醒失敗 (ID: ${reminder.id}):`, error);
        }
    }

    /**
     * 添加特定時間的排程任務
     */
    scheduleSpecificReminder(reminder) {
        if (reminder.reminderType !== 'once') {
            return; // 只處理一次性提醒的精確排程
        }

        const scheduleTime = new Date(reminder.scheduledTime);
        const now = new Date();

        if (scheduleTime <= now) {
            return; // 時間已過，由主排程器處理
        }

        const taskId = `reminder_${reminder.id}`;
        
        // 如果已存在，先移除舊任務
        if (this.scheduledTasks.has(taskId)) {
            this.scheduledTasks.get(taskId).destroy();
        }

        // 計算 cron 表達式
        const minute = scheduleTime.getMinutes();
        const hour = scheduleTime.getHours();
        const day = scheduleTime.getDate();
        const month = scheduleTime.getMonth() + 1;
        const cronExpression = `${minute} ${hour} ${day} ${month} *`;

        // 創建新任務
        const task = cron.schedule(cronExpression, async () => {
            await this.executeReminder(reminder);
            // 執行後移除任務
            this.scheduledTasks.delete(taskId);
        }, {
            scheduled: true,
            timezone: 'Asia/Taipei'
        });

        this.scheduledTasks.set(taskId, task);
        console.log(`已排程提醒: ${reminder.title} 於 ${scheduleTime.toLocaleString()}`);
    }

    /**
     * 取消特定提醒的排程
     */
    cancelScheduledReminder(reminderId) {
        const taskId = `reminder_${reminderId}`;
        
        if (this.scheduledTasks.has(taskId)) {
            this.scheduledTasks.get(taskId).destroy();
            this.scheduledTasks.delete(taskId);
            console.log(`已取消提醒排程: ${reminderId}`);
            return true;
        }
        
        return false;
    }

    /**
     * 獲取排程器狀態
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            scheduledTasksCount: this.scheduledTasks.size,
            scheduledTasks: Array.from(this.scheduledTasks.keys())
        };
    }

    /**
     * 手動觸發檢查
     */
    async manualCheck() {
        console.log('手動觸發提醒檢查...');
        await this.checkAndExecuteReminders();
    }

    /**
     * 批量添加提醒到排程器
     */
    async loadAllReminders() {
        try {
            console.log('載入所有提醒到排程器...');
            
            // 這裡可以實作載入所有未來的一次性提醒
            // 由於我們主要依賴主排程器，這個方法用於優化性能
            
            console.log('提醒載入完成');
        } catch (error) {
            console.error('載入提醒失敗:', error);
        }
    }

    /**
     * 清理過期的排程任務
     */
    cleanupExpiredTasks() {
        const now = new Date();
        let cleanedCount = 0;

        this.scheduledTasks.forEach((task, taskId) => {
            // 這裡可以實作更複雜的過期檢查邏輯
            // 目前由 cron 任務自動處理
        });

        if (cleanedCount > 0) {
            console.log(`清理了 ${cleanedCount} 個過期的排程任務`);
        }
    }

    /**
     * 獲取下一次執行時間
     */
    getNextExecutionTime(cronExpression) {
        try {
            const task = cron.schedule(cronExpression, () => {}, { scheduled: false });
            // 這是一個簡化的實作，實際可能需要更複雜的邏輯
            task.destroy();
            return null;
        } catch (error) {
            console.error('計算下次執行時間失敗:', error);
            return null;
        }
    }

    /**
     * 驗證 cron 表達式
     */
    validateCronExpression(cronExpression) {
        try {
            const task = cron.schedule(cronExpression, () => {}, { scheduled: false });
            task.destroy();
            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = new ReminderScheduler();
