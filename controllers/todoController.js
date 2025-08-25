const TodoService = require('../services/todoService');
const { TODO_MESSAGES, COMMAND_KEYWORDS, QUICK_REPLY_BUTTONS } = require('../constants/todoMessages');

class TodoController {
    constructor(googleSheetsService, languageParser, lineClient) {
        this.todoService = new TodoService(googleSheetsService);
        this.languageParser = languageParser;
        this.lineClient = lineClient;
    }

    // 處理代辦相關指令
    async handleTodoCommand(event) {
        try {
            const userId = event.source.userId;
            const messageText = event.message.text.trim();
            
            // 識別語言
            const language = this.languageParser.detectLanguage(messageText);
            
            // 解析指令
            const commandInfo = this.parseCommand(messageText, language);
            
            switch (commandInfo.action) {
                case 'add':
                    return await this.handleAddTodo(userId, commandInfo, language);
                    
                case 'list':
                    return await this.handleListTodos(userId, commandInfo, language);
                    
                case 'complete':
                    return await this.handleCompleteTodo(userId, commandInfo, language);
                    
                case 'delete':
                    return await this.handleDeleteTodo(userId, commandInfo, language);
                    
                case 'search':
                    return await this.handleSearchTodos(userId, commandInfo, language);
                    
                case 'stats':
                    return await this.handleGetStats(userId, language);
                    
                case 'help':
                    return await this.handleHelp(userId, language);
                    
                default:
                    return await this.handleUnknownCommand(userId, language);
            }
        } catch (error) {
            console.error('Error handling todo command:', error);
            return await this.sendErrorMessage(event.source.userId, error.message);
        }
    }

    // 解析指令
    parseCommand(text, language) {
        const keywords = COMMAND_KEYWORDS[language];
        const lowerText = text.toLowerCase();
        
        // 新增代辦
        if (keywords.addTodo.some(keyword => lowerText.includes(keyword))) {
            const title = this.extractTodoTitle(text, keywords.addTodo);
            const priority = this.extractPriority(text, language);
            
            return {
                action: 'add',
                title,
                priority,
                originalText: text
            };
        }
        
        // 完成代辦
        if (keywords.completeTodo.some(keyword => lowerText.includes(keyword))) {
            const todoId = this.extractTodoId(text);
            return {
                action: 'complete',
                todoId,
                originalText: text
            };
        }
        
        // 刪除代辦
        if (keywords.deleteTodo.some(keyword => lowerText.includes(keyword))) {
            const todoId = this.extractTodoId(text);
            return {
                action: 'delete',
                todoId,
                originalText: text
            };
        }
        
        // 查看列表
        if (keywords.listTodos.some(keyword => lowerText.includes(keyword))) {
            const filter = this.extractListFilter(text, language);
            return {
                action: 'list',
                filter,
                originalText: text
            };
        }
        
        // 搜尋
        if (lowerText.includes('搜尋') || lowerText.includes('搜索') || lowerText.includes('検索')) {
            const searchTerm = this.extractSearchTerm(text);
            return {
                action: 'search',
                searchTerm,
                originalText: text
            };
        }
        
        // 統計
        if (lowerText.includes('統計') || lowerText.includes('stats') || lowerText.includes('統計')) {
            return {
                action: 'stats',
                originalText: text
            };
        }
        
        // 說明
        if (keywords.help.some(keyword => lowerText.includes(keyword))) {
            return {
                action: 'help',
                originalText: text
            };
        }
        
        // 預設為新增代辦（如果包含代辦關鍵字）
        if (keywords.addTodo.some(keyword => lowerText.includes(keyword))) {
            return {
                action: 'add',
                title: text,
                originalText: text
            };
        }
        
        return {
            action: 'unknown',
            originalText: text
        };
    }

    // 處理新增代辦
    async handleAddTodo(userId, commandInfo, language) {
        try {
            if (!commandInfo.title || commandInfo.title.trim().length === 0) {
                return await this.sendMessage(userId, {
                    type: 'text',
                    text: TODO_MESSAGES[language].titleRequired,
                    quickReply: {
                        items: QUICK_REPLY_BUTTONS[language]
                    }
                });
            }

            const result = await this.todoService.addTodo(userId, commandInfo.title, {
                priority: commandInfo.priority,
                language: language
            });

            if (result.success) {
                const flexMessage = this.createTodoFlexMessage(result.todo, language);
                
                return await this.sendMessage(userId, {
                    type: 'flex',
                    altText: result.message,
                    contents: flexMessage,
                    quickReply: {
                        items: QUICK_REPLY_BUTTONS[language]
                    }
                });
            } else {
                return await this.sendMessage(userId, {
                    type: 'text',
                    text: `❌ ${result.error}`,
                    quickReply: {
                        items: QUICK_REPLY_BUTTONS[language]
                    }
                });
            }
        } catch (error) {
            console.error('Error in handleAddTodo:', error);
            return await this.sendErrorMessage(userId, error.message);
        }
    }

    // 處理查看代辦列表
    async handleListTodos(userId, commandInfo, language) {
        try {
            const filter = commandInfo.filter || {};
            const result = await this.todoService.getTodosByUser(userId, filter);

            if (!result.success) {
                return await this.sendMessage(userId, {
                    type: 'text',
                    text: `❌ ${result.error}`
                });
            }

            if (result.todos.length === 0) {
                return await this.sendMessage(userId, {
                    type: 'text',
                    text: TODO_MESSAGES[language].noTodos,
                    quickReply: {
                        items: QUICK_REPLY_BUTTONS[language]
                    }
                });
            }

            // 創建 Flex Carousel
            const carouselContents = result.todos.slice(0, 10).map(todo => 
                this.createTodoFlexBubble(todo, language)
            );

            const flexMessage = {
                type: 'carousel',
                contents: carouselContents
            };

            const altText = language === 'ja' ? 
                `📋 タスクリスト (${result.count}件)` : 
                `📋 代辦列表 (${result.count}項)`;

            return await this.sendMessage(userId, {
                type: 'flex',
                altText: altText,
                contents: flexMessage,
                quickReply: {
                    items: QUICK_REPLY_BUTTONS[language]
                }
            });
        } catch (error) {
            console.error('Error in handleListTodos:', error);
            return await this.sendErrorMessage(userId, error.message);
        }
    }

    // 處理完成代辦
    async handleCompleteTodo(userId, commandInfo, language) {
        try {
            if (!commandInfo.todoId) {
                return await this.sendMessage(userId, {
                    type: 'text',
                    text: TODO_MESSAGES[language].invalidCommand,
                    quickReply: {
                        items: QUICK_REPLY_BUTTONS[language]
                    }
                });
            }

            const result = await this.todoService.completeTodo(userId, commandInfo.todoId);

            if (result.success) {
                const flexMessage = this.createTodoFlexMessage(result.todo, language, true);
                
                return await this.sendMessage(userId, {
                    type: 'flex',
                    altText: result.message,
                    contents: flexMessage,
                    quickReply: {
                        items: QUICK_REPLY_BUTTONS[language]
                    }
                });
            } else {
                return await this.sendMessage(userId, {
                    type: 'text',
                    text: result.error === 'Todo not found' ? 
                        TODO_MESSAGES[language].todoNotFound : 
                        `❌ ${result.error}`
                });
            }
        } catch (error) {
            console.error('Error in handleCompleteTodo:', error);
            return await this.sendErrorMessage(userId, error.message);
        }
    }

    // 處理刪除代辦
    async handleDeleteTodo(userId, commandInfo, language) {
        try {
            if (!commandInfo.todoId) {
                return await this.sendMessage(userId, {
                    type: 'text',
                    text: TODO_MESSAGES[language].invalidCommand
                });
            }

            const result = await this.todoService.deleteTodo(userId, commandInfo.todoId);

            if (result.success) {
                return await this.sendMessage(userId, {
                    type: 'text',
                    text: result.message,
                    quickReply: {
                        items: QUICK_REPLY_BUTTONS[language]
                    }
                });
            } else {
                return await this.sendMessage(userId, {
                    type: 'text',
                    text: result.error === 'Todo not found' ? 
                        TODO_MESSAGES[language].todoNotFound : 
                        `❌ ${result.error}`
                });
            }
        } catch (error) {
            console.error('Error in handleDeleteTodo:', error);
            return await this.sendErrorMessage(userId, error.message);
        }
    }

    // 處理搜尋代辦
    async handleSearchTodos(userId, commandInfo, language) {
        try {
            if (!commandInfo.searchTerm) {
                return await this.sendMessage(userId, {
                    type: 'text',
                    text: TODO_MESSAGES[language].invalidCommand
                });
            }

            const result = await this.todoService.searchTodos(userId, commandInfo.searchTerm);

            if (!result.success) {
                return await this.sendMessage(userId, {
                    type: 'text',
                    text: `❌ ${result.error}`
                });
            }

            if (result.todos.length === 0) {
                const noResultText = language === 'ja' ? 
                    `🔍 "${commandInfo.searchTerm}" の検索結果が見つかりませんでした` :
                    `🔍 找不到包含「${commandInfo.searchTerm}」的代辦事項`;
                    
                return await this.sendMessage(userId, {
                    type: 'text',
                    text: noResultText,
                    quickReply: {
                        items: QUICK_REPLY_BUTTONS[language]
                    }
                });
            }

            // 創建搜尋結果 Flex Message
            const carouselContents = result.todos.slice(0, 10).map(todo => 
                this.createTodoFlexBubble(todo, language)
            );

            const flexMessage = {
                type: 'carousel',
                contents: carouselContents
            };

            const altText = language === 'ja' ? 
                `🔍 検索結果 (${result.count}件)` : 
                `🔍 搜尋結果 (${result.count}項)`;

            return await this.sendMessage(userId, {
                type: 'flex',
                altText: altText,
                contents: flexMessage,
                quickReply: {
                    items: QUICK_REPLY_BUTTONS[language]
                }
            });
        } catch (error) {
            console.error('Error in handleSearchTodos:', error);
            return await this.sendErrorMessage(userId, error.message);
        }
    }

    // 處理統計資訊
    async handleGetStats(userId, language) {
        try {
            const result = await this.todoService.getStats(userId);

            if (!result.success) {
                return await this.sendMessage(userId, {
                    type: 'text',
                    text: `❌ ${result.error}`
                });
            }

            const stats = result.stats;
            const completionRate = stats.total > 0 ? 
                Math.round((stats.completed / stats.total) * 100) : 0;

            const statsMessage = language === 'ja' ? 
                `📊 タスク統計\n\n` +
                `📝 総数: ${stats.total}\n` +
                `✅ 完了: ${stats.completed}\n` +
                `⏳ 未完了: ${stats.pending}\n` +
                `🔔 リマインダー付き: ${stats.withReminders}\n` +
                `📈 完了率: ${completionRate}%\n\n` +
                `📌 優先度別:\n` +
                `🔴 高: ${stats.byPriority.high}\n` +
                `🟡 中: ${stats.byPriority.medium}\n` +
                `🟢 低: ${stats.byPriority.low}` :
                
                `📊 代辦統計\n\n` +
                `📝 總數: ${stats.total}\n` +
                `✅ 已完成: ${stats.completed}\n` +
                `⏳ 待辦: ${stats.pending}\n` +
                `🔔 有提醒: ${stats.withReminders}\n` +
                `📈 完成率: ${completionRate}%\n\n` +
                `📌 優先級分佈:\n` +
                `🔴 高: ${stats.byPriority.high}\n` +
                `🟡 中: ${stats.byPriority.medium}\n` +
                `🟢 低: ${stats.byPriority.low}`;

            return await this.sendMessage(userId, {
                type: 'text',
                text: statsMessage,
                quickReply: {
                    items: QUICK_REPLY_BUTTONS[language]
                }
            });
        } catch (error) {
            console.error('Error in handleGetStats:', error);
            return await this.sendErrorMessage(userId, error.message);
        }
    }

    // 處理說明
    async handleHelp(userId, language) {
        try {
            const helpMessage = TODO_MESSAGES[language].help;
            const commandList = helpMessage.commands.join('\n');
            
            const fullHelpText = `${helpMessage.title}\n\n${commandList}`;

            return await this.sendMessage(userId, {
                type: 'text',
                text: fullHelpText,
                quickReply: {
                    items: QUICK_REPLY_BUTTONS[language]
                }
            });
        } catch (error) {
            console.error('Error in handleHelp:', error);
            return await this.sendErrorMessage(userId, error.message);
        }
    }

    // 處理未知指令
    async handleUnknownCommand(userId, language) {
        return await this.sendMessage(userId, {
            type: 'text',
            text: TODO_MESSAGES[language].invalidCommand,
            quickReply: {
                items: QUICK_REPLY_BUTTONS[language]
            }
        });
    }

    // 創建代辦事項 Flex Message
    createTodoFlexMessage(todo, language, showCompleted = false) {
        return {
            type: 'bubble',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: showCompleted ? '🎉 任務完成！' : '📝 代辦事項',
                        weight: 'bold',
                        size: 'md',
                        color: showCompleted ? '#00C851' : '#1DB446'
                    }
                ]
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: todo.title,
                        weight: 'bold',
                        size: 'lg',
                        wrap: true
                    },
                    {
                        type: 'separator',
                        margin: 'md'
                    },
                    {
                        type: 'box',
                        layout: 'vertical',
                        margin: 'md',
                        spacing: 'sm',
                        contents: [
                            {
                                type: 'box',
                                layout: 'baseline',
                                spacing: 'sm',
                                contents: [
                                    {
                                        type: 'text',
                                        text: language === 'ja' ? 'ID:' : 'ID:',
                                        color: '#aaaaaa',
                                        size: 'sm',
                                        flex: 2
                                    },
                                    {
                                        type: 'text',
                                        text: todo.id.split('_')[1] || todo.id.substring(0, 8),
                                        wrap: true,
                                        size: 'sm',
                                        flex: 3
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
                                        text: language === 'ja' ? '優先度:' : '優先級:',
                                        color: '#aaaaaa',
                                        size: 'sm',
                                        flex: 2
                                    },
                                    {
                                        type: 'text',
                                        text: TODO_MESSAGES[language].priority[todo.priority],
                                        wrap: true,
                                        size: 'sm',
                                        color: this.getPriorityColor(todo.priority),
                                        flex: 3
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        };
    }

    // 創建代辦事項 Flex Bubble（用於列表）
    createTodoFlexBubble(todo, language) {
        const statusIcon = todo.completed ? '✅' : '⏳';
        const priorityColor = this.getPriorityColor(todo.priority);
        const shortId = todo.id.split('_')[1] || todo.id.substring(0, 8);

        return {
            type: 'bubble',
            size: 'micro',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: `${statusIcon} ${todo.title}`,
                        weight: 'bold',
                        size: 'sm',
                        wrap: true,
                        maxLines: 2
                    }
                ],
                backgroundColor: todo.completed ? '#f8f9fa' : '#ffffff'
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'box',
                        layout: 'baseline',
                        contents: [
                            {
                                type: 'text',
                                text: 'ID:',
                                color: '#aaaaaa',
                                size: 'xs',
                                flex: 1
                            },
                            {
                                type: 'text',
                                text: shortId,
                                size: 'xs',
                                flex: 2
                            }
                        ]
                    },
                    {
                        type: 'box',
                        layout: 'baseline',
                        margin: 'sm',
                        contents: [
                            {
                                type: 'text',
                                text: language === 'ja' ? '優先:' : '優先:',
                                color: '#aaaaaa',
                                size: 'xs',
                                flex: 1
                            },
                            {
                                type: 'text',
                                text: TODO_MESSAGES[language].priority[todo.priority],
                                size: 'xs',
                                color: priorityColor,
                                flex: 2
                            }
                        ]
                    }
                ]
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'button',
                        style: todo.completed ? 'secondary' : 'primary',
                        height: 'sm',
                        action: {
                            type: 'message',
                            label: todo.completed ? 
                                (language === 'ja' ? '完了済み' : '已完成') :
                                (language === 'ja' ? '完了' : '完成'),
                            text: todo.completed ? 
                                `查看 ${shortId}` : 
                                `完成 ${shortId}`
                        }
                    }
                ]
            }
        };
    }

    // 取得優先級顏色
    getPriorityColor(priority) {
        const colors = {
            high: '#FF5551',
            medium: '#FFA500',
            low: '#00C851'
        };
        return colors[priority] || colors.medium;
    }

    // 發送訊息
    async sendMessage(userId, message) {
        try {
            return await this.lineClient.replyMessage(userId, message);
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    // 發送錯誤訊息
    async sendErrorMessage(userId, errorMessage) {
        return await this.sendMessage(userId, {
            type: 'text',
            text: `❌ 發生錯誤: ${errorMessage}`
        });
    }

    // 輔助方法：提取代辦標題
    extractTodoTitle(text, keywords) {
        let title = text;
        
        // 移除指令關鍵字
        keywords.forEach(keyword => {
            const regex = new RegExp(keyword, 'gi');
            title = title.replace(regex, '').trim();
        });
        
        // 移除優先級關鍵字
        title = title.replace(/[高中低]/g, '').trim();
        
        return title;
    }

    // 輔助方法：提取代辦 ID
    extractTodoId(text) {
        // 尋找數字或 ID 格式
        const matches = text.match(/(\d+)|todo_(\d+)/);
        return matches ? (matches[1] || matches[2]) : null;
    }

    // 輔助方法：提取優先級
    extractPriority(text, language) {
        const priorities = TODO_MESSAGES[language].priority;
        
        if (text.includes(priorities.high)) return 'high';
        if (text.includes(priorities.medium)) return 'medium';
        if (text.includes(priorities.low)) return 'low';
        
        return 'medium'; // 預設
    }

    // 輔助方法：提取列表篩選條件
    extractListFilter(text, language) {
        const filter = {};
        
        if (text.includes('已完成') || text.includes('完了')) {
            filter.completed = true;
        } else if (text.includes('待辦') || text.includes('未完了')) {
            filter.completed = false;
        }
        
        if (text.includes('高')) filter.priority = 'high';
        if (text.includes('中')) filter.priority = 'medium';
        if (text.includes('低')) filter.priority = 'low';
        
        return filter;
    }

    // 輔助方法：提取搜尋關鍵字
    extractSearchTerm(text) {
        // 移除搜尋指令關鍵字
        let searchTerm = text
            .replace(/搜尋|搜索|検索|search/gi, '')
            .trim();
            
        return searchTerm;
    }
}

module.exports = TodoController;
