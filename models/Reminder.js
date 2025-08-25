class Reminder {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.todoId = data.todoId || '';
        this.userId = data.userId || '';
        this.title = data.title || '';
        this.message = data.message || '';
        
        // 提醒類型：once, daily, weekly, monthly, custom
        this.type = data.type || 'once';
        
        // 時間設定
        this.triggerTime = data.triggerTime || null; // ISO 字串
        this.cronPattern = data.cronPattern || null; // cron 表達式
        this.timezone = data.timezone || 'Asia/Taipei';
        
        // 循環設定
        this.interval = data.interval || null; // 自定義間隔天數
        this.weekdays = data.weekdays || []; // 週幾 [1,2,3,4,5,6,0]
        this.monthDates = data.monthDates || []; // 每月幾號 [1,15]
        
        // 狀態
        this.active = data.active !== undefined ? data.active : true;
        this.completed = data.completed || false;
        
        // 元資訊
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
        this.lastTriggered = data.lastTriggered || null;
        this.nextTrigger = data.nextTrigger || null;
        
        // 位置相關
        this.location = data.location || null;
        this.locationRadius = data.locationRadius || 100; // 公尺
        
        // 語言
        this.language = data.language || 'zh';
        
        // 統計
        this.triggerCount = data.triggerCount || 0;
    }

    generateId() {
        return 'reminder_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 轉換為 Google Sheets 格式
    toSheetRow() {
        return [
            this.id,
            this.todoId,
            this.userId,
            this.title,
            this.message,
            this.type,
            this.triggerTime,
            this.cronPattern,
            this.timezone,
            this.interval,
            JSON.stringify(this.weekdays),
            JSON.stringify(this.monthDates),
            this.active,
            this.completed,
            this.createdAt,
            this.updatedAt,
            this.lastTriggered,
            this.nextTrigger,
            this.location,
            this.locationRadius,
            this.language,
            this.triggerCount
        ];
    }

    // 從 Google Sheets 行數據創建
    static fromSheetRow(row) {
        return new Reminder({
            id: row[0],
            todoId: row[1],
            userId: row[2],
            title: row[3],
            message: row[4],
            type: row[5],
            triggerTime: row[6],
            cronPattern: row[7],
            timezone: row[8] || 'Asia/Taipei',
            interval: row[9] ? parseInt(row[9]) : null,
            weekdays: row[10] ? JSON.parse(row[10]) : [],
            monthDates: row[11] ? JSON.parse(row[11]) : [],
            active: row[12] === 'true' || row[12] === true,
            completed: row[13] === 'true' || row[13] === true,
            createdAt: row[14],
            updatedAt: row[15],
            lastTriggered: row[16],
            nextTrigger: row[17],
            location: row[18],
            locationRadius: row[19] ? parseInt(row[19]) : 100,
            language: row[20] || 'zh',
            triggerCount: row[21] ? parseInt(row[21]) : 0
        });
    }

    // 生成 cron 表達式
    generateCronPattern() {
        const moment = require('moment-timezone');
        
        if (this.triggerTime) {
            const time = moment.tz(this.triggerTime, this.timezone);
            const minute = time.minute();
            const hour = time.hour();
            
            switch (this.type) {
                case 'once':
                    // 一次性提醒不需要 cron
                    return null;
                    
                case 'daily':
                    return `${minute} ${hour} * * *`;
                    
                case 'weekly':
                    if (this.weekdays.length > 0) {
                        return `${minute} ${hour} * * ${this.weekdays.join(',')}`;
                    }
                    return `${minute} ${hour} * * ${time.day()}`;
                    
                case 'monthly':
                    if (this.monthDates.length > 0) {
                        return `${minute} ${hour} ${this.monthDates.join(',')} * *`;
                    }
                    return `${minute} ${hour} ${time.date()} * *`;
                    
                case 'custom':
                    if (this.interval) {
                        // 自定義間隔使用每日檢查，由程式邏輯控制間隔
                        return `${minute} ${hour} * * *`;
                    }
                    break;
            }
        }
        
        return this.cronPattern;
    }

    // 計算下次觸發時間
    calculateNextTrigger() {
        const moment = require('moment-timezone');
        const now = moment.tz(this.timezone);
        
        switch (this.type) {
            case 'once':
                if (this.triggerTime) {
                    const triggerMoment = moment.tz(this.triggerTime, this.timezone);
                    return triggerMoment.isAfter(now) ? triggerMoment.toISOString() : null;
                }
                break;
                
            case 'daily':
                if (this.triggerTime) {
                    const time = moment.tz(this.triggerTime, this.timezone);
                    let next = now.clone().hour(time.hour()).minute(time.minute()).second(0);
                    if (next.isSameOrBefore(now)) {
                        next.add(1, 'day');
                    }
                    return next.toISOString();
                }
                break;
                
            case 'weekly':
                if (this.triggerTime && this.weekdays.length > 0) {
                    const time = moment.tz(this.triggerTime, this.timezone);
                    let nextTrigger = null;
                    
                    for (let weekday of this.weekdays) {
                        let next = now.clone().day(weekday).hour(time.hour()).minute(time.minute()).second(0);
                        if (next.isSameOrBefore(now)) {
                            next.add(1, 'week');
                        }
                        if (!nextTrigger || next.isBefore(nextTrigger)) {
                            nextTrigger = next;
                        }
                    }
                    
                    return nextTrigger ? nextTrigger.toISOString() : null;
                }
                break;
                
            case 'monthly':
                if (this.triggerTime && this.monthDates.length > 0) {
                    const time = moment.tz(this.triggerTime, this.timezone);
                    let nextTrigger = null;
                    
                    for (let date of this.monthDates) {
                        let next = now.clone().date(date).hour(time.hour()).minute(time.minute()).second(0);
                        if (next.isSameOrBefore(now)) {
                            next.add(1, 'month');
                        }
                        if (!nextTrigger || next.isBefore(nextTrigger)) {
                            nextTrigger = next;
                        }
                    }
                    
                    return nextTrigger ? nextTrigger.toISOString() : null;
                }
                break;
                
            case 'custom':
                if (this.interval && this.lastTriggered) {
                    const last = moment.tz(this.lastTriggered, this.timezone);
                    const next = last.add(this.interval, 'days');
                    return next.isAfter(now) ? next.toISOString() : null;
                } else if (this.interval) {
                    const next = now.clone().add(this.interval, 'days');
                    return next.toISOString();
                }
                break;
        }
        
        return null;
    }

    // 更新下次觸發時間
    updateNextTrigger() {
        this.nextTrigger = this.calculateNextTrigger();
        this.updatedAt = new Date().toISOString();
    }

    // 標記為已觸發
    markTriggered() {
        this.lastTriggered = new Date().toISOString();
        this.triggerCount += 1;
        this.updatedAt = new Date().toISOString();
        
        // 如果是一次性提醒，標記為完成
        if (this.type === 'once') {
            this.completed = true;
            this.active = false;
        }
        
        // 更新下次觸發時間
        this.updateNextTrigger();
    }

    // 停用提醒
    deactivate() {
        this.active = false;
        this.updatedAt = new Date().toISOString();
    }

    // 啟用提醒
    activate() {
        this.active = true;
        this.updateNextTrigger();
    }

    // 驗證提醒設定
    validate() {
        const errors = [];
        
        if (!this.userId) {
            errors.push('用戶 ID 不能為空');
        }
        
        if (!this.title) {
            errors.push('提醒標題不能為空');
        }
        
        if (!['once', 'daily', 'weekly', 'monthly', 'custom'].includes(this.type)) {
            errors.push('提醒類型無效');
        }
        
        if (this.type === 'weekly' && this.weekdays.length === 0) {
            errors.push('週提醒必須指定星期幾');
        }
        
        if (this.type === 'monthly' && this.monthDates.length === 0) {
            errors.push('月提醒必須指定日期');
        }
        
        if (this.type === 'custom' && !this.interval) {
            errors.push('自定義提醒必須指定間隔天數');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // 取得提醒類型的顯示文字
    getTypeDisplayText() {
        const typeTexts = {
            zh: {
                once: '一次性',
                daily: '每日',
                weekly: '每週',
                monthly: '每月',
                custom: '自定義'
            },
            ja: {
                once: '一度だけ',
                daily: '毎日',
                weekly: '毎週',
                monthly: '毎月',
                custom: 'カスタム'
            }
        };
        
        return typeTexts[this.language][this.type] || this.type;
    }

    // 取得提醒詳情描述
    getDetailDescription() {
        const moment = require('moment-timezone');
        
        let details = [];
        
        if (this.triggerTime) {
            const time = moment.tz(this.triggerTime, this.timezone);
            details.push(this.language === 'ja' ? 
                `時刻: ${time.format('YYYY/MM/DD HH:mm')}` : 
                `時間: ${time.format('YYYY/MM/DD HH:mm')}`);
        }
        
        if (this.type === 'weekly' && this.weekdays.length > 0) {
            const dayNames = this.language === 'ja' ? 
                ['日', '月', '火', '水', '木', '金', '土'] :
                ['日', '一', '二', '三', '四', '五', '六'];
            const days = this.weekdays.map(d => dayNames[d]).join(', ');
            details.push(this.language === 'ja' ? `曜日: ${days}` : `星期: ${days}`);
        }
        
        if (this.type === 'monthly' && this.monthDates.length > 0) {
            details.push(this.language === 'ja' ? 
                `日付: ${this.monthDates.join(', ')}日` : 
                `日期: ${this.monthDates.join(', ')}號`);
        }
        
        if (this.type === 'custom' && this.interval) {
            details.push(this.language === 'ja' ? 
                `間隔: ${this.interval}日ごと` : 
                `間隔: 每${this.interval}天`);
        }
        
        return details.join('\n');
    }
}

module.exports = Reminder;
