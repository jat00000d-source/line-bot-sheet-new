// controllers/expenseController.js (更新版)
const ExpenseSheetService = require('../services/expenseSheetService');
const ExpenseParser = require('../parsers/expenseParser');
const DateParser = require('../parsers/dateParser');

class ExpenseController {
  constructor() {
    this.expenseService = new ExpenseSheetService();
    this.expenseParser = new ExpenseParser();
    this.dateParser = new DateParser();
  }

  /**
   * 處理記帳相關指令
   */
  async handleExpense(parsedCommand) {
    try {
      switch (parsedCommand.commandType) {
        case 'expense':
          return await this.addExpense(parsedCommand);
        case 'expense_summary':
          return await this.getExpenseSummary(parsedCommand);
        case 'set_budget':
          return await this.setBudget(parsedCommand);
        case 'budget':
          return await this.getBudgetStatus(parsedCommand);
        case 'remaining':
          return await this.getRemainingBudget(parsedCommand);
        default:
          return '不支援的記帳指令';
      }
    } catch (error) {
      console.error('記帳處理錯誤:', error);
      return '記帳處理失敗，請稍後再試';
    }
  }

  /**
   * 新增記帳記錄
   */
  async addExpense(parsedCommand) {
    const expenseData = {
      date: parsedCommand.date || new Date().toISOString().split('T')[0],
      amount: parsedCommand.amount,
      category: parsedCommand.category,
      description: parsedCommand.description || '',
      userId: parsedCommand.userId
    };

    await this.expenseService.addExpense(expenseData);
    
    return `✅ 記帳成功！\n💰 金額: ${expenseData.amount} 元\n📁 分類: ${expenseData.category}\n📅 日期: ${expenseData.date}${expenseData.description ? `\n📝 備註: ${expenseData.description}` : ''}`;
  }

  /**
   * 取得記帳摘要
   */
  async getExpenseSummary(parsedCommand) {
    const startDate = parsedCommand.startDate;
    const endDate = parsedCommand.endDate;
    
    const expenses = await this.expenseService.getUserExpenses(
      parsedCommand.userId, 
      startDate, 
      endDate
    );

    if (expenses.length === 0) {
      return '📊 查無記帳記錄';
    }

    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const categoryTotals = expenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    }, {});

    let summary = `📊 記帳摘要\n總支出: ${totalAmount} 元\n記錄數: ${expenses.length} 筆\n\n📁 分類支出:\n`;
    
    for (const [category, amount] of Object.entries(categoryTotals)) {
      summary += `• ${category}: ${amount} 元\n`;
    }

    return summary;
  }

  // ... 其他記帳方法保持不變

  /**
   * 取得幫助訊息
   */
  getHelpMessage(language = 'zh-tw') {
    if (language === 'ja') {
      return `📚 家計簿機能ヘルプ\n\n💰 支出記録:\n• 金額 カテゴリ [説明]\n例: 150 食費 昼食\n\n📊 支出確認:\n• 今日の支出\n• 今週の支出\n• 今月の支出\n\n💳 予算管理:\n• 予算設定 金額\n例: 予算設定 30000`;
    }
    
    return `📚 記帳功能說明\n\n💰 記帳格式:\n• 金額 分類 [備註]\n例: 150 午餐 便當\n\n📊 查詢支出:\n• 今日支出\n• 本週支出\n• 本月支出\n\n💳 預算管理:\n• 設定預算 金額\n例: 設定預算 30000`;
  }
}

module.exports = ExpenseController;

// controllers/todoController.js (更新版)
const TodoSheetService = require('../services/todoSheetService');
const ReminderSheetService = require('../services/reminderSheetService');


class TodoController {
  constructor() {
    this.todoService = new TodoSheetService();
    this.reminderService = new ReminderSheetService();
    this.dateParser = new DateParser();
  }

  /**
   * 處理待辦相關指令
   */
  async handleTodo(parsedCommand) {
    try {
      switch (parsedCommand.commandType) {
        case 'todo_add':
          return await this.addTodo(parsedCommand);
        case 'todo_list':
          return await this.listTodos(parsedCommand);
        case 'todo_complete':
          return await this.completeTodo(parsedCommand);
        case 'todo_delete':
          return await this.deleteTodo(parsedCommand);
        case 'reminder_add':
          return await this.addReminder(parsedCommand);
        case 'reminder_list':
          return await this.listReminders(parsedCommand);
        case 'reminder_delete':
          return await this.deleteReminder(parsedCommand);
        default:
          return parsedCommand.language === 'ja' ? 
            '未対応のToDoコマンドです' : 
            '不支援的待辦指令';
      }
    } catch (error) {
      console.error('待辦處理錯誤:', error);
      return parsedCommand.language === 'ja' ? 
        'ToDoの処理に失敗しました' : 
        '待辦處理失敗，請稍後再試';
    }
  }

  /**
   * 新增待辦事項
   */
  async addTodo(parsedCommand) {
    const todoData = {
      userId: parsedCommand.userId,
      title: parsedCommand.title,
      description: parsedCommand.description || '',
      priority: parsedCommand.priority || 'medium',
      dueDate: parsedCommand.dueDate || '',
      status: 'pending'
    };

    const newTodo = await this.todoService.addTodo(todoData);
    
    const isJapanese = parsedCommand.language === 'ja';
    let response = isJapanese ? 
      `✅ ToDoを追加しました！\n📝 タイトル: ${newTodo.title}` :
      `✅ 待辦事項已新增！\n📝 標題: ${newTodo.title}`;
    
    if (newTodo.description) {
      response += isJapanese ? 
        `\n📄 説明: ${newTodo.description}` :
        `\n📄 說明: ${newTodo.description}`;
    }
    
    if (newTodo.dueDate) {
      response += isJapanese ?
        `\n⏰ 期限: ${newTodo.dueDate}` :
        `\n⏰ 截止日期: ${newTodo.dueDate}`;
    }
    
    response += isJapanese ?
      `\n🎯 優先度: ${this.getPriorityEmoji(newTodo.priority)} ${newTodo.priority}` :
      `\n🎯 優先級: ${this.getPriorityEmoji(newTodo.priority)} ${newTodo.priority}`;

    return response;
  }

  /**
   * 列出待辦事項
   */
  async listTodos(parsedCommand) {
    const status = parsedCommand.status || null;
    const todos = await this.todoService.getUserTodos(parsedCommand.userId, status);
    
    const isJapanese = parsedCommand.language === 'ja';
    
    if (todos.length === 0) {
      return isJapanese ? 
        '📋 ToDoリストは空です' : 
        '📋 目前沒有待辦事項';
    }

    const statusFilter = status ? (isJapanese ? 
      `（${status === 'pending' ? '未完了' : status === 'completed' ? '完了' : status}のみ）` :
      `（僅顯示${status === 'pending' ? '待處理' : status === 'completed' ? '已完成' : status}）`) : '';
    
    let response = isJapanese ? 
      `📋 ToDoリスト${statusFilter}\n\n` :
      `📋 您的待辦事項${statusFilter}\n\n`;

    todos.forEach((todo, index) => {
      const statusEmoji = this.getStatusEmoji(todo.status);
      const priorityEmoji = this.getPriorityEmoji(todo.priority);
      
      response += `${index + 1}. ${statusEmoji} ${todo.title}\n`;
      response += `   ${priorityEmoji} ${todo.priority}`;
      
      if (todo.dueDate) {
        response += ` | ⏰ ${todo.dueDate}`;
      }
      
      response += `\n   ID: ${todo.id}\n\n`;
    });

    return response;
  }

  /**
   * 完成待辦事項
   */
  async completeTodo(parsedCommand) {
    const result = await this.todoService.updateTodoStatus(
      parsedCommand.userId, 
      parsedCommand.todoId, 
      'completed'
    );

    const isJapanese = parsedCommand.language === 'ja';
    return isJapanese ?
      `✅ ToDoを完了しました！\nID: ${result.id}` :
      `✅ 待辦事項已完成！\nID: ${result.id}`;
  }

  /**
   * 刪除待辦事項
   */
  async deleteTodo(parsedCommand) {
    const result = await this.todoService.deleteTodo(
      parsedCommand.userId, 
      parsedCommand.todoId
    );

    const isJapanese = parsedCommand.language === 'ja';
    return isJapanese ?
      `🗑️ ToDoを削除しました\nID: ${result.id}` :
      `🗑️ 待辦事項已刪除\nID: ${result.id}`;
  }

  /**
   * 新增提醒事項
   */
  async addReminder(parsedCommand) {
    const reminderData = {
      userId: parsedCommand.userId,
      title: parsedCommand.title,
      message: parsedCommand.message || '',
      reminderTime: parsedCommand.reminderTime,
      isRecurring: parsedCommand.isRecurring || false,
      recurringPattern: parsedCommand.recurringPattern || ''
    };

    const newReminder = await this.reminderService.addReminder(reminderData);
    
    const isJapanese = parsedCommand.language === 'ja';
    let response = isJapanese ?
      `⏰ リマインダーを追加しました！\n📝 タイトル: ${newReminder.title}\n🕐 時間: ${newReminder.reminderTime}` :
      `⏰ 提醒已新增！\n📝 標題: ${newReminder.title}\n🕐 時間: ${newReminder.reminderTime}`;

    if (newReminder.isRecurring) {
      response += isJapanese ?
        `\n🔄 繰り返し: ${newReminder.recurringPattern}` :
        `\n🔄 重複模式: ${newReminder.recurringPattern}`;
    }

    return response;
  }

  /**
   * 列出提醒事項
   */
  async listReminders(parsedCommand) {
    const reminders = await this.reminderService.getUserReminders(parsedCommand.userId);
    
    const isJapanese = parsedCommand.language === 'ja';
    
    if (reminders.length === 0) {
      return isJapanese ?
        '⏰ リマインダーは設定されていません' :
        '⏰ 目前沒有提醒事項';
    }

    let response = isJapanese ?
      '⏰ リマインダー一覧\n\n' :
      '⏰ 您的提醒事項\n\n';

    reminders.forEach((reminder, index) => {
      response += `${index + 1}. 📝 ${reminder.title}\n`;
      response += `   🕐 ${reminder.reminderTime}`;
      
      if (reminder.isRecurring) {
        response += isJapanese ?
          ` | 🔄 ${reminder.recurringPattern}` :
          ` | 🔄 ${reminder.recurringPattern}`;
      }
      
      response += `\n   ID: ${reminder.id}\n\n`;
    });

    return response;
  }

  /**
   * 刪除提醒事項
   */
  async deleteReminder(parsedCommand) {
    // 這個方法需要在 reminderSheetService 中實作
    const result = await this.reminderService.deleteReminder(
      parsedCommand.userId, 
      parsedCommand.reminderId
    );

    const isJapanese = parsedCommand.language === 'ja';
    return isJapanese ?
      `🗑️ リマインダーを削除しました\nID: ${result.id}` :
      `🗑️ 提醒已刪除\nID: ${result.id}`;
  }

  /**
   * 取得狀態 emoji
   */
  getStatusEmoji(status) {
    const statusEmojis = {
      'pending': '⏳',
      'in_progress': '🔄',
      'completed': '✅',
      'cancelled': '❌'
    };
    return statusEmojis[status] || '❓';
  }

  /**
   * 取得優先級 emoji
   */
  getPriorityEmoji(priority) {
    const priorityEmojis = {
      'high': '🔴',
      'medium': '🟡',
      'low': '🟢'
    };
    return priorityEmojis[priority] || '⚪';
  }

  /**
   * 取得幫助訊息
   */
  getHelpMessage(language = 'zh-tw') {
    if (language === 'ja') {
      return `📚 ToDo機能ヘルプ\n\n📝 ToDo追加:\n• Todo追加 タイトル [説明]\n例: Todo追加 買い物 牛乳とパンを買う\n\n📋 ToDo確認:\n• Todoリスト\n• 完了リスト\n• 未完了リスト\n\n✅ ToDo完了:\n• Todo完了 ID\n例: Todo完了 todo_123\n\n🗑️ ToDo削除:\n• Todo削除 ID\n例: Todo削除 todo_123\n\n⏰ リマインダー:\n• リマインダー追加 タイトル 時間\n例: リマインダー追加 会議 2024-01-15 14:00\n• リマインダーリスト\n• リマインダー削除 ID`;
    }
    
    return `📚 待辦功能說明\n\n📝 新增待辦:\n• 新增待辦 標題 [說明]\n例: 新增待辦 買菜 購買晚餐食材\n\n📋 查看待辦:\n• 待辦清單\n• 已完成清單\n• 待處理清單\n\n✅ 完成待辦:\n• 完成待辦 ID\n例: 完成待辦 todo_123\n\n🗑️ 刪除待辦:\n• 刪除待辦 ID\n例: 刪除待辦 todo_123\n\n⏰ 提醒功能:\n• 新增提醒 標題 時間\n例: 新增提醒 開會 2024-01-15 14:00\n• 提醒清單\n• 刪除提醒 ID`;
  }
}

module.exports = TodoController
