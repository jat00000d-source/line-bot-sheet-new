class Todo {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.title = data.title || '';
        this.description = data.description || '';
        this.userId = data.userId || '';
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
        this.completed = data.completed || false;
        this.completedAt = data.completedAt || null;
        this.priority = data.priority || 'medium'; // low, medium, high
        this.tags = data.tags || [];
        this.location = data.location || null;
        
        // 提醒相關
        this.hasReminder = data.hasReminder || false;
        this.reminderIds = data.reminderIds || [];
        
        // 語言識別
        this.language = data.language || 'zh'; // zh, ja
    }

    generateId() {
        return 'todo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 轉換為 Google Sheets 格式
    toSheetRow() {
        return [
            this.id,
            this.title,
            this.description,
            this.userId,
            this.createdAt,
            this.updatedAt,
            this.completed,
            this.completedAt,
            this.priority,
            this.tags.join(','),
            this.location,
            this.hasReminder,
            this.reminderIds.join(','),
            this.language
        ];
    }

    // 從 Google Sheets 行數據創建
    static fromSheetRow(row) {
        return new Todo({
            id: row[0],
            title: row[1],
            description: row[2],
            userId: row[3],
            createdAt: row[4],
            updatedAt: row[5],
            completed: row[6] === 'true' || row[6] === true,
            completedAt: row[7] || null,
            priority: row[8] || 'medium',
            tags: row[9] ? row[9].split(',').filter(tag => tag.trim()) : [],
            location: row[10] || null,
            hasReminder: row[11] === 'true' || row[11] === true,
            reminderIds: row[12] ? row[12].split(',').filter(id => id.trim()) : [],
            language: row[13] || 'zh'
        });
    }

    // 標記為完成
    markComplete() {
        this.completed = true;
        this.completedAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
    }

    // 取消完成
    markIncomplete() {
        this.completed = false;
        this.completedAt = null;
        this.updatedAt = new Date().toISOString();
    }

    // 更新內容
    update(updates) {
        const allowedFields = ['title', 'description', 'priority', 'tags', 'location', 'language'];
        
        allowedFields.forEach(field => {
            if (updates.hasOwnProperty(field)) {
                this[field] = updates[field];
            }
        });
        
        this.updatedAt = new Date().toISOString();
    }

    // 添加提醒 ID
    addReminder(reminderId) {
        if (!this.reminderIds.includes(reminderId)) {
            this.reminderIds.push(reminderId);
            this.hasReminder = true;
            this.updatedAt = new Date().toISOString();
        }
    }

    // 移除提醒 ID
    removeReminder(reminderId) {
        this.reminderIds = this.reminderIds.filter(id => id !== reminderId);
        this.hasReminder = this.reminderIds.length > 0;
        this.updatedAt = new Date().toISOString();
    }

    // 驗證必填欄位
    validate() {
        const errors = [];
        
        if (!this.title || this.title.trim().length === 0) {
            errors.push('標題不能為空');
        }
        
        if (!this.userId || this.userId.trim().length === 0) {
            errors.push('用戶 ID 不能為空');
        }
        
        if (!['low', 'medium', 'high'].includes(this.priority)) {
            errors.push('優先級必須是 low、medium 或 high');
        }
        
        if (!['zh', 'ja'].includes(this.language)) {
            errors.push('語言必須是 zh 或 ja');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // 轉換為 LINE Flex Message 格式
    toFlexMessage() {
        const priorityColor = {
            high: '#FF5551',
            medium: '#FFA500', 
            low: '#00C851'
        };

        const statusIcon = this.completed ? '✅' : '⏳';
        const priorityText = {
            high: this.language === 'ja' ? '高' : '高',
            medium: this.language === 'ja' ? '中' : '中',
            low: this.language === 'ja' ? '低' : '低'
        };

        return {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: `${statusIcon} ${this.title}`,
                        weight: "bold",
                        size: "lg",
                        wrap: true
                    }
                ]
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: this.description || (this.language === 'ja' ? '説明なし' : '無描述'),
                        wrap: true,
                        color: "#666666",
                        size: "sm"
                    },
                    {
                        type: "separator",
                        margin: "md"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "md",
                        spacing: "sm",
                        contents: [
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    {
                                        type: "text",
                                        text: this.language === 'ja' ? '優先度:' : '優先級:',
                                        color: "#aaaaaa",
                                        size: "sm",
                                        flex: 2
                                    },
                                    {
                                        type: "text",
                                        text: priorityText[this.priority],
                                        wrap: true,
                                        size: "sm",
                                        color: priorityColor[this.priority],
                                        flex: 3
                                    }
                                ]
                            },
                            ...(this.hasReminder ? [{
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    {
                                        type: "text",
                                        text: this.language === 'ja' ? 'リマインダー:' : '提醒:',
                                        color: "#aaaaaa",
                                        size: "sm",
                                        flex: 2
                                    },
                                    {
                                        type: "text",
                                        text: "🔔",
                                        wrap: true,
                                        size: "sm",
                                        flex: 3
                                    }
                                ]
                            }] : [])
                        ]
                    }
                ]
            }
        };
    }
}

module.exports = Todo;
