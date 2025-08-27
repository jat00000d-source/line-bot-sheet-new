// controllers/expenseController.js (Google Sheets 完整版)
const moment = require('moment-timezone');

class ExpenseController {
  constructor() {
    // 初始化數據結構
    this.expenses = [];
    this.budget = {
      monthly: 50000, // 預設月預算
      dailyRemaining: 0
    };
    
    // 模擬 Google Sheets 數據（之後可以替換成真實 API）
    this.initializeMockData();
    
    console.log('💰 ExpenseController 初始化完成（Google Sheets 版本）');
  }

  /**
   * 初始化模擬數據（模擬從 Google Sheets 載入的數據）
   */
  initializeMockData() {
    // 模擬本月已有的支出記錄
    const currentMonth = moment().tz('Asia/Tokyo').format('YYYY-MM');
    this.expenses = [
      {
        id: 1,
        userId: 'mock-user',
        category: '食費',
        amount: 1200,
        description: '午餐',
        date: `${currentMonth}-01`,
        timestamp: `${currentMonth}-01T12:00:00+09:00`
      },
      {
        id: 2,
        userId: 'mock-user',
        category: '交通費',
        amount: 800,
        description: '電車',
        date: `${currentMonth}-02`,
        timestamp: `${currentMonth}-02T08:30:00+09:00`
      }
      // 可以添加更多模擬數據
    ];
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
      
      // 儲存記錄（這裡會儲存到 Google Sheets）
      await this.saveToGoogleSheets(expense);
      this.expenses.push(expense);
      
      console.log('💾 記帳記錄已儲存:', expense);
      
      // 計算預算狀況
      const budgetInfo = await this.calculateBudgetStatus(userId);
      
      // 準備回應訊息
      const responseText = this.formatExpenseResponse(expense, budgetInfo);
      
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
   * 儲存到 Google Sheets（模擬）
   */
  async saveToGoogleSheets(expense) {
    try {
      // TODO: 這裡應該是真實的 Google Sheets API 調用
      console.log('📊 儲存到 Google Sheets:', expense);
      
      // 模擬 API 延遲
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return true;
    } catch (error) {
      console.error('❌ Google Sheets 儲存失敗:', error);
      throw error;
    }
  }

  /**
   * 計算預算狀況
   */
  async calculateBudgetStatus(userId) {
    const now = moment().tz('Asia/Tokyo');
    const currentMonth = now.format('YYYY-MM');
    const startOfMonth = moment(currentMonth + '-01').tz('Asia/Tokyo');
    const endOfMonth = startOfMonth.clone().endOf('month');
    const daysInMonth = endOfMonth.date();
    const currentDay = now.date();
    const remainingDays = Math.max(0, daysInMonth - currentDay);

    // 計算本月總支出
    const monthlyExpenses = this.expenses.filter(exp => 
      exp.userId === userId && exp.date.startsWith(currentMonth)
    );
    
    const totalSpent = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const remaining = this.budget.monthly - totalSpent;
    const spentPercentage = ((totalSpent / this.budget.monthly) * 100).toFixed(1);
    const dailyAvailable = remainingDays > 0 ? Math.floor(remaining / remainingDays) : 0;

    // 計算距離上次記帳的天數
    const lastExpense = monthlyExpenses
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    
    let daysSinceLastExpense = 0;
    if (lastExpense) {
      const lastExpenseDate = moment(lastExpense.date);
      daysSinceLastExpense = now.diff(lastExpenseDate, 'days');
    }

    return {
      budget: this.budget.monthly,
      totalSpent,
      remaining,
      spentPercentage,
      dailyAvailable,
      recordCount: monthlyExpenses.length,
      isOverBudget: totalSpent > this.budget.monthly,
      daysSinceLastExpense
    };
  }

  /**
   * 格式化記帳回應訊息
   */
  formatExpenseResponse(expense, budgetInfo) {
    const now = moment().tz('Asia/Tokyo');
    const expenseDate = moment(expense.date);
    const daysAgo = now.diff(expenseDate, 'days');
    const dateDisplay = `${expenseDate.format('MM/DD')}（${daysAgo === 0 ? '今日' : daysAgo + '天前'}）`;

    let response = `✅ 記帳成功！\n`;
    response += `日期：${dateDisplay}\n`;
    response += `項目：${expense.category}\n`;
    response += `金額：${expense.amount.toLocaleString()}円\n`;
    response += `備註：${expense.description || ''}\n`;
    
    // 預算狀況
    response += `🚨 本月預算狀況\n`;
    response += `💰 預算：${budgetInfo.budget.toLocaleString()} 円\n`;
    response += `💸 支出：${budgetInfo.totalSpent.toLocaleString()} 円 (${budgetInfo.spentPercentage}%)\n`;
    
    if (budgetInfo.isOverBudget) {
      response += `💵 剩餘：${budgetInfo.remaining.toLocaleString()} 円\n`;
      response += `📅 每日可用：${budgetInfo.dailyAvailable.toLocaleString()} 円\n`;
      response += `📊 記錄筆數：${budgetInfo.recordCount} 筆\n`;
      response += `⚠ 已超出預算！`;
    } else {
      response += `💵 剩餘：${budgetInfo.remaining.toLocaleString()} 円\n`;
      response += `📅 每日可用：${budgetInfo.dailyAvailable.toLocaleString()} 円\n`;
      response += `📊 記錄筆數：${budgetInfo.recordCount} 筆`;
    }

    return response;
  }

  /**
   * 處理記帳查詢
   */
  async handleExpenseQuery(event, command, language) {
    try {
      const userId = event.source.userId;
      const budgetInfo = await this.calculateBudgetStatus(userId);
      
      // 根據查詢類型返回不同的資訊
      if (command.queryType === 'budget' || command.queryType === 'summary') {
        return {
          type: 'text',
          text: this.formatBudgetSummary(budgetInfo, language)
        };
      }
      
      // 預設返回支出記錄
      const userExpenses = this.getUserExpenses(userId, 10);
      return {
        type: 'text',
        text: this.formatExpenseList(userExpenses, budgetInfo, language)
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
   * 格式化預算摘要
   */
  formatBudgetSummary(budgetInfo, language = 'zh') {
    const isJapanese = language === 'ja';
    
    let response = isJapanese ? '📊 予算サマリー\n\n' : '📊 預算總覽\n\n';
    response += `💰 ${isJapanese ? '月間予算' : '月預算'}: ${budgetInfo.budget.toLocaleString()} ${isJapanese ? '円' : '円'}\n`;
    response += `💸 ${isJapanese ? '支出済み' : '已支出'}: ${budgetInfo.totalSpent.toLocaleString()} ${isJapanese ? '円' : '円'} (${budgetInfo.spentPercentage}%)\n`;
    response += `💵 ${isJapanese ? '残額' : '剩餘'}: ${budgetInfo.remaining.toLocaleString()} ${isJapanese ? '円' : '円'}\n`;
    response += `📅 ${isJapanese ? '1日あたり利用可能' : '每日可用'}: ${budgetInfo.dailyAvailable.toLocaleString()} ${isJapanese ? '円' : '円'}\n`;
    response += `📊 ${isJapanese ? '記録数' : '記錄數'}: ${budgetInfo.recordCount} ${isJapanese ? '件' : '筆'}`;
    
    if (budgetInfo.isOverBudget) {
      response += `\n\n⚠️ ${isJapanese ? '予算オーバーです！' : '已超出預算！'}`;
    }
    
    return response;
  }

  /**
   * 格式化支出列表
   */
  formatExpenseList(expenses, budgetInfo, language = 'zh') {
    const isJapanese = language === 'ja';
    
    if (expenses.length === 0) {
      return isJapanese ? '📊 支出記録がありません' : '📊 目前沒有支出記錄';
    }

    let response = isJapanese ? '📋 最近の支出記録:\n\n' : '📋 最近支出記錄:\n\n';
    
    expenses.forEach((expense, index) => {
      const expenseDate = moment(expense.date);
      response += `${index + 1}. ${expense.category} ${expense.amount.toLocaleString()}${isJapanese ? '円' : '円'}`;
      if (expense.description) {
        response += ` (${expense.description})`;
      }
      response += `\n   ${expenseDate.format('MM/DD')} ${expense.time || ''}\n\n`;
    });

    // 添加預算摘要
    response += `💰 ${isJapanese ? '月間合計' : '本月總計'}: ${budgetInfo.totalSpent.toLocaleString()} ${isJapanese ? '円' : '円'} / ${budgetInfo.budget.toLocaleString()} ${isJapanese ? '円' : '円'} (${budgetInfo.spentPercentage}%)`;

    return response;
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
   * 設定月預算
   */
  async setBudget(userId, amount) {
    try {
      this.budget.monthly = amount;
      // TODO: 儲存到 Google Sheets
      console.log(`💰 用戶 ${userId} 設定月預算為: ${amount} 円`);
      return true;
    } catch (error) {
      console.error('❌ 設定預算失敗:', error);
      return false;
    }
  }

  /**
   * 取得幫助訊息
   */
  getHelpMessage(language = 'zh') {
    if (language === 'ja') {
      return `📚 家計簿機能ヘルプ\n\n💰 支出記録:\n• [カテゴリ] [金額] [メモ]\n例: 食費 500 昼食\n例: 交通費 200\n\n📊 支出確認:\n• 支出確認\n• 予算確認\n• 支出履歴\n\n⚙️ 設定:\n• 予算設定 [金額]`;
    }
    
    return `📚 記帳功能說明\n\n💰 記帳格式:\n• [類別] [金額] [備註]\n例: 食物 500 午餐\n例: 交通 200\n\n📊 查詢功能:\n• 查看支出\n• 預算確認\n• 支出記錄\n\n⚙️ 設定功能:\n• 設定預算 [金額]`;
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
