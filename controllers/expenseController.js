// controllers/expenseController.js (修復版)
const moment = require('moment-timezone');

class ExpenseController {
  constructor() {
    // 使用記憶體儲存（你可以之後改成 Google Sheets）
    this.expenses = [];
    console.log('💰 ExpenseController 初始化完成');
  }

  /**
   * 處理記帳相關訊息
   */
  async handleExpense(event, command) {
    try {
      console.log('💰 處理記帳指令:', command);
      
      const userId = event.source.userId;
      const now = moment().tz('Asia/Tokyo');
      
      // 創建記帳記錄
      const expense = {
        id: Date.now(),
        userId: userId,
        category: command.category || '其他',
        amount: command.amount,
        description: command.description || '',
        timestamp: now.toISOString(),
        date: now.format('YYYY-MM-DD'),
        time: now.format('HH:mm:ss')
      };
      
      // 儲存記錄
      this.expenses.push(expense);
      
      console.log('💾 記帳記錄已儲存:', expense);
      
      // 準備回應訊息
      const responseText = `✅ 記帳成功！\n\n📊 類別: ${expense.category}\n💰 金額: ${expense.amount}元\n📝 描述: ${expense.description || '無'}\n🕐 時間: ${expense.date} ${expense.time}`;
      
      return {
        type: 'text',
        text: responseText
      };
      
    } catch (error) {
      console.error('❌ 記帳處理錯誤:', error);
      return {
        type: 'text',
        text: '記帳時發生錯誤，請稍後再試。'
      };
    }
  }

  /**
   * 處理記帳查詢
   */
  async handleExpenseQuery(event, command, language) {
    try {
      const userId = event.source.userId;
      const userExpenses = this.getUserExpenses(userId);
      
      if (userExpenses.length === 0) {
        return {
          type: 'text',
          text: language === 'ja' ? '📊 支出記録がありません' : '📊 目前沒有支出記錄'
        };
      }

      // 計算今日支出
      const todayTotal = this.getTodayTotal(userId);
      const totalExpenses = userExpenses.reduce((sum, expense) => sum + expense.amount, 0);

      let response = language === 'ja' ? 
        `📊 支出サマリー\n\n💰 今日の支出: ${todayTotal}円\n💰 総支出: ${totalExpenses}円\n📝 記録数: ${userExpenses.length}件\n\n` :
        `📊 支出總覽\n\n💰 今日支出: ${todayTotal}元\n💰 總支出: ${totalExpenses}元\n📝 記錄數: ${userExpenses.length}筆\n\n`;

      // 顯示最近5筆記錄
      const recentExpenses = userExpenses.slice(0, 5);
      response += language === 'ja' ? '📋 最近の記録:\n' : '📋 最近記錄:\n';
      
      recentExpenses.forEach((expense, index) => {
        response += `${index + 1}. ${expense.category} ${expense.amount}${language === 'ja' ? '円' : '元'}`;
        if (expense.description) {
          response += ` (${expense.description})`;
        }
        response += `\n   ${expense.date} ${expense.time}\n`;
      });

      return {
        type: 'text',
        text: response
      };

    } catch (error) {
      console.error('❌ 查詢記帳錯誤:', error);
      return {
        type: 'text',
        text: '查詢支出時發生錯誤。'
      };
    }
  }

  /**
   * 取得使用者的記帳記錄
   */
  getUserExpenses(userId, limit = 100) {
    return this.expenses
      .filter(expense => expense.userId === userId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * 取得今日總支出
   */
  getTodayTotal(userId) {
    const today = moment().tz('Asia/Tokyo').format('YYYY-MM-DD');
    return this.expenses
      .filter(expense => expense.userId === userId && expense.date === today)
      .reduce((total, expense) => total + expense.amount, 0);
  }

  /**
   * 取得幫助訊息
   */
  getHelpMessage(language = 'zh') {
    if (language === 'ja') {
      return `📚 家計簿機能ヘルプ\n\n💰 支出記録:\n• カテゴリ 金額 [メモ]\n例: 食費 500 昼食\n例: 150 交通費\n\n📊 支出確認:\n• 支出確認\n• 支出履歴`;
    }
    
    return `📚 記帳功能說明\n\n💰 記帳格式:\n• 類別 金額 [備註]\n例: 食物 150 午餐\n例: 50 交通費\n\n📊 查詢支出:\n• 查看支出\n• 支出記錄`;
  }
}

class TodoController {
  constructor() {
    // 使用記憶體儲存
    this.reminders = [];
    console.log('⏰ TodoController 初始化完成');
  }

  /**
   * 處理待辦/提醒訊息
   */
  async handleTodo(event, command, language) {
    try {
      console.log('⏰ 處理提醒指令:', command);
      
      const userId = event.source.userId;
      const now = moment().tz('Asia/Tokyo');
      
      // 創建提醒記錄
      const reminder = {
        id: Date.now(),
        userId: userId,
        title: command.title || command.description,
        description: command.description || '',
        reminderTime: command.reminderTime,
        type: command.type || 'once', // 'once', 'daily', 'weekly', etc.
        isActive: true,
        createdAt: now.toISOString()
      };
      
      this.reminders.push(reminder);
      
      console.log('📝 提醒已建立:', reminder);
      
      // 準備回應訊息
      const responseText = language === 'ja' ? 
        `✅ リマインダーを設定しました！\n\n📋 内容: ${reminder.title}\n⏰ 時間: ${reminder.reminderTime}\n📅 種類: ${this.getTypeText(reminder.type, 'ja')}` :
        `✅ 提醒設定成功！\n\n📋 內容: ${reminder.title}\n⏰ 時間: ${reminder.reminderTime}\n📅 類型: ${this.getTypeText(reminder.type, 'zh')}`;
      
      return {
        type: 'text',
        text: responseText
      };
      
    } catch (error) {
      console.error('❌ 提醒處理錯誤:', error);
      const errorMsg = language === 'ja' ? 
        'リマインダーの設定中にエラーが発生しました。' :
        '設定提醒時發生錯誤，請稍後再試。';
      
      return {
        type: 'text',
        text: errorMsg
      };
    }
  }

  async handleQueryReminders(event, language) {
    try {
      const userId = event.source.userId;
      const userReminders = this.reminders
        .filter(reminder => reminder.userId === userId && reminder.isActive)
        .sort((a, b) => new Date(a.reminderTime) - new Date(b.reminderTime));

      if (userReminders.length === 0) {
        const noRemindersMsg = language === 'ja' ? 
          '現在設定されているリマインダーはありません。' :
          '目前沒有設定任何提醒。';
        
        return {
          type: 'text',
          text: noRemindersMsg
        };
      }

      const title = language === 'ja' ? '📋 設定中のリマインダー一覧:' : '📋 目前的提醒列表:';
      let responseText = title + '\n\n';

      userReminders.forEach((reminder, index) => {
        responseText += `${index + 1}. ${reminder.title}\n`;
        responseText += `   ⏰ ${reminder.reminderTime}\n`;
        responseText += `   📅 ${this.getTypeText(reminder.type, language)}\n\n`;
      });

      const deleteInstruction = language === 'ja' ? 
        '\n削除したい場合は「リマインダー削除 [番号]」と送信してください。' :
        '\n如要刪除請輸入「刪除提醒 [編號]」';

      responseText += deleteInstruction;

      return {
        type: 'text',
        text: responseText
      };

    } catch (error) {
      console.error('❌ 查詢提醒錯誤:', error);
      return {
        type: 'text',
        text: '查詢提醒時發生錯誤。'
      };
    }
  }

  async handleDeleteReminder(event, command, language) {
    try {
      const userId = event.source.userId;
      const reminderIndex = parseInt(command.index) - 1;

      const userReminders = this.reminders
        .filter(reminder => reminder.userId === userId && reminder.isActive)
        .sort((a, b) => new Date(a.reminderTime) - new Date(b.reminderTime));

      if (reminderIndex < 0 || reminderIndex >= userReminders.length) {
        const errorMsg = language === 'ja' ? 
          '無効な番号です。リマインダー一覧を確認してください。' :
          '無效的編號，請查看提醒列表。';
        
        return {
          type: 'text',
          text: errorMsg
        };
      }

      const reminderToDelete = userReminders[reminderIndex];
      reminderToDelete.isActive = false;

      const successMsg = language === 'ja' ? 
        `✅ リマインダー「${reminderToDelete.title}」を削除しました。` :
        `✅ 已刪除提醒「${reminderToDelete.title}」`;

      return {
        type: 'text',
        text: successMsg
      };

    } catch (error) {
      console.error('❌ 刪除提醒錯誤:', error);
      return {
        type: 'text',
        text: '刪除提醒時發生錯誤。'
      };
    }
  }

  getTypeText(type, language) {
    const types = {
      'once': { ja: '一回のみ', zh: '單次' },
      'daily': { ja: '毎日', zh: '每天' },
      'weekly': { ja: '毎週', zh: '每週' },
      'monthly': { ja: '毎月', zh: '每月' }
    };
    
    return types[type] ? types[type][language] : type;
  }

  /**
   * 取得幫助訊息
   */
  getHelpMessage(language = 'zh') {
    if (language === 'ja') {
      return `📚 リマインダー機能ヘルプ\n\n⏰ リマインダー設定:\n• 明日8時に薬を飲む\n• 毎日19時に運動\n• 毎週月曜日に会議\n\n📋 リマインダー確認:\n• リマインダー一覧\n• リマインダー削除 [番号]`;
    }
    
    return `📚 提醒功能說明\n\n⏰ 提醒設定:\n• 明天8點吃藥\n• 每天晚上7點運動\n• 每週一開會\n\n📋 提醒管理:\n• 查看提醒\n• 刪除提醒 [編號]`;
  }
}

module.exports = { ExpenseController, TodoController };
