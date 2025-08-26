const Todo = require('../models/Todo');
const { TODO_MESSAGES, SHEET_CONFIG } = require('../constants/todoMessage');

class TodoService {
    constructor(googleSheetsService) {
        this.googleSheetsService = googleSheetsService;
        this.sheetName = SHEET_CONFIG.todos.name;
    }

    // 初始化工作表（如果不存在）
    async initializeSheet() {
        try {
            const sheets = await this.googleSheetsService.getWorksheetList();
            const todoSheet = sheets.find(sheet => sheet.title === this.sheetName);
            
            if (!todoSheet) {
                console.log('Creating Todos worksheet...');
                const newSheet = await this.googleSheetsService.addWorksheet({
                    title: this.sheetName,
                    headerValues: SHEET_CONFIG.todos.headers
                });
                
                // 設定標題行
                await newSheet.setHeaderRow(SHEET_CONFIG.todos.headers);
                console.log('Todos worksheet created successfully');
            }
        } catch (error) {
            console.error('Error initializing todos sheet:', error);
            throw error;
        }
    }

    // 新增代辦事項
    async addTodo(userId, title, options = {}) {
        try {
            await this.initializeSheet();
            
            const todo = new Todo({
                userId,
                title: title.trim(),
                description: options.description || '',
                priority: options.priority || 'medium',
                tags: options.tags || [],
                location: options.location || null,
                language: options.language || 'zh'
            });

            const validation = todo.validate();
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }

            // 寫入 Google Sheets
            const worksheet = await this.googleSheetsService.getWorksheet(this.sheetName);
            await worksheet.addRow(todo.toSheetRow());

            return {
                success: true,
                todo,
                message: TODO_MESSAGES[todo.language].todoAdded
            };
        } catch (error) {
            console.error('Error adding todo:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 取得用戶的所有代辦事項
    async getTodosByUser(userId, options = {}) {
        try {
            await this.initializeSheet();
            
            const worksheet = await this.googleSheetsService.getWorksheet(this.sheetName);
            const rows = await worksheet.getRows();

            let todos = rows
                .filter(row => row.UserID === userId)
                .map(row => {
                    const rowData = SHEET_CONFIG.todos.headers.map(header => row[header] || '');
                    return Todo.fromSheetRow(rowData);
                });

            // 篩選條件
            if (options.completed !== undefined) {
                todos = todos.filter(todo => todo.completed === options.completed);
            }

            if (options.priority) {
                todos = todos.filter(todo => todo.priority === options.priority);
            }

            if (options.hasReminder !== undefined) {
                todos = todos.filter(todo => todo.hasReminder === options.hasReminder);
            }

            // 排序：未完成的在前，按創建時間降序
            todos.sort((a, b) => {
                if (a.completed !== b.completed) {
                    return a.completed ? 1 : -1;
                }
                return new Date(b.createdAt) - new Date(a.createdAt);
            });

            return {
                success: true,
                todos,
                count: todos.length
            };
        } catch (error) {
            console.error('Error getting todos:', error);
            return {
                success: false,
                error: error.message,
                todos: []
            };
        }
    }

    // 根據 ID 取得代辦事項
    async getTodoById(userId, todoId) {
        try {
            const result = await this.getTodosByUser(userId);
            if (!result.success) {
                return result;
            }

            const todo = result.todos.find(t => t.id === todoId);
            if (!todo) {
                return {
                    success: false,
                    error: 'Todo not found'
                };
            }

            return {
                success: true,
                todo
            };
        } catch (error) {
            console.error('Error getting todo by ID:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 更新代辦事項
    async updateTodo(userId, todoId, updates) {
        try {
            await this.initializeSheet();
            
            const worksheet = await this.googleSheetsService.getWorksheet(this.sheetName);
            const rows = await worksheet.getRows();

            const rowIndex = rows.findIndex(row => 
                row.ID === todoId && row.UserID === userId
            );

            if (rowIndex === -1) {
                return {
                    success: false,
                    error: 'Todo not found'
                };
            }

            // 取得現有資料
            const existingRow = rows[rowIndex];
            const existingData = SHEET_CONFIG.todos.headers.map(header => existingRow[header] || '');
            const todo = Todo.fromSheetRow(existingData);

            // 更新資料
            todo.update(updates);

            const validation = todo.validate();
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }

            // 更新 Google Sheets
            const updatedData = todo.toSheetRow();
            SHEET_CONFIG.todos.headers.forEach((header, index) => {
                existingRow[header] = updatedData[index];
            });
            await existingRow.save();

            return {
                success: true,
                todo,
                message: TODO_MESSAGES[todo.language].todoUpdated
            };
        } catch (error) {
            console.error('Error updating todo:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 完成代辦事項
    async completeTodo(userId, todoId) {
        try {
            const result = await this.getTodoById(userId, todoId);
            if (!result.success) {
                return result;
            }

            const todo = result.todo;
            if (todo.completed) {
                return {
                    success: false,
                    error: 'Todo is already completed'
                };
            }

            // 標記為完成
            todo.markComplete();

            // 更新到 Google Sheets
            const updateResult = await this.updateTodoInSheet(userId, todoId, todo);
            if (!updateResult.success) {
                return updateResult;
            }

            return {
                success: true,
                todo,
                message: TODO_MESSAGES[todo.language].todoCompleted
            };
        } catch (error) {
            console.error('Error completing todo:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 取消完成代辦事項
    async uncompleteTodo(userId, todoId) {
        try {
            const result = await this.getTodoById(userId, todoId);
            if (!result.success) {
                return result;
            }

            const todo = result.todo;
            if (!todo.completed) {
                return {
                    success: false,
                    error: 'Todo is not completed'
                };
            }

            // 取消完成
            todo.markIncomplete();

            // 更新到 Google Sheets
            const updateResult = await this.updateTodoInSheet(userId, todoId, todo);
            if (!updateResult.success) {
                return updateResult;
            }

            return {
                success: true,
                todo,
                message: TODO_MESSAGES[todo.language].todoUpdated
            };
        } catch (error) {
            console.error('Error uncompleting todo:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 刪除代辦事項
    async deleteTodo(userId, todoId) {
        try {
            await this.initializeSheet();
            
            const worksheet = await this.googleSheetsService.getWorksheet(this.sheetName);
            const rows = await worksheet.getRows();

            const rowIndex = rows.findIndex(row => 
                row.ID === todoId && row.UserID === userId
            );

            if (rowIndex === -1) {
                return {
                    success: false,
                    error: 'Todo not found'
                };
            }

            // 取得要刪除的代辦事項資料
            const existingRow = rows[rowIndex];
            const existingData = SHEET_CONFIG.todos.headers.map(header => existingRow[header] || '');
            const todo = Todo.fromSheetRow(existingData);

            // 刪除行
            await existingRow.delete();

            return {
                success: true,
                deletedTodo: todo,
                message: TODO_MESSAGES[todo.language].todoDeleted
            };
        } catch (error) {
            console.error('Error deleting todo:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 搜尋代辦事項
    async searchTodos(userId, searchTerm, options = {}) {
        try {
            const result = await this.getTodosByUser(userId, options);
            if (!result.success) {
                return result;
            }

            const searchLower = searchTerm.toLowerCase();
            const filteredTodos = result.todos.filter(todo => 
                todo.title.toLowerCase().includes(searchLower) ||
                todo.description.toLowerCase().includes(searchLower) ||
                todo.tags.some(tag => tag.toLowerCase().includes(searchLower))
            );

            return {
                success: true,
                todos: filteredTodos,
                count: filteredTodos.length,
                searchTerm
            };
        } catch (error) {
            console.error('Error searching todos:', error);
            return {
                success: false,
                error: error.message,
                todos: []
            };
        }
    }

    // 取得統計資訊
    async getStats(userId) {
        try {
            const result = await this.getTodosByUser(userId);
            if (!result.success) {
                return result;
            }

            const todos = result.todos;
            const stats = {
                total: todos.length,
                completed: todos.filter(t => t.completed).length,
                pending: todos.filter(t => !t.completed).length,
                withReminders: todos.filter(t => t.hasReminder).length,
                byPriority: {
                    high: todos.filter(t => t.priority === 'high').length,
                    medium: todos.filter(t => t.priority === 'medium').length,
                    low: todos.filter(t => t.priority === 'low').length
                }
            };

            return {
                success: true,
                stats
            };
        } catch (error) {
            console.error('Error getting stats:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 更新代辦事項到 Google Sheets（內部輔助方法）
    async updateTodoInSheet(userId, todoId, todo) {
        try {
            const worksheet = await this.googleSheetsService.getWorksheet(this.sheetName);
            const rows = await worksheet.getRows();

            const rowIndex = rows.findIndex(row => 
                row.ID === todoId && row.UserID === userId
            );

            if (rowIndex === -1) {
                return {
                    success: false,
                    error: 'Todo not found'
                };
            }

            // 更新資料
            const existingRow = rows[rowIndex];
            const updatedData = todo.toSheetRow();
            
            SHEET_CONFIG.todos.headers.forEach((header, index) => {
                existingRow[header] = updatedData[index];
            });
            
            await existingRow.save();

            return {
                success: true
            };
        } catch (error) {
            console.error('Error updating todo in sheet:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 批量操作：標記多個代辦事項為完成
    async batchComplete(userId, todoIds) {
        const results = [];
        
        for (const todoId of todoIds) {
            try {
                const result = await this.completeTodo(userId, todoId);
                results.push({
                    todoId,
                    success: result.success,
                    message: result.message,
                    error: result.error
                });
            } catch (error) {
                results.push({
                    todoId,
                    success: false,
                    error: error.message
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        
        return {
            success: successCount > 0,
            results,
            successCount,
            totalCount: todoIds.length
        };
    }

    // 批量刪除
    async batchDelete(userId, todoIds) {
        const results = [];
        
        for (const todoId of todoIds) {
            try {
                const result = await this.deleteTodo(userId, todoId);
                results.push({
                    todoId,
                    success: result.success,
                    message: result.message,
                    error: result.error
                });
            } catch (error) {
                results.push({
                    todoId,
                    success: false,
                    error: error.message
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        
        return {
            success: successCount > 0,
            results,
            successCount,
            totalCount: todoIds.length
        };
    }
}

module.exports = TodoService;
