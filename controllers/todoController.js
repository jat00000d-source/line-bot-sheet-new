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
