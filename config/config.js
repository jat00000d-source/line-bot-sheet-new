// config/config.js (更新版 - 支援多個 Google Sheets)
require('dotenv').config();

module.exports = {
  line: {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET
  },
  
  server: {
    port: process.env.PORT || 3000
  },
  
  // Google Sheets 配置 - 支援多個工作表
  googleSheets: {
    // 記帳用的 Google Sheets
    expense: {
      spreadsheetId: process.env.EXPENSE_SPREADSHEET_ID,
      sheetName: process.env.EXPENSE_SHEET_NAME || 'expenses',
      serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY // JSON 字串
    },
    
    // 待辦事項用的 Google Sheets
    todo: {
      spreadsheetId: process.env.TODO_SPREADSHEET_ID,
      sheetName: process.env.TODO_SHEET_NAME || 'todos',
      serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY // 共用同一個服務帳號
    },
    
    // 提醒事項用的 Google Sheets (可選，也可以跟 todo 共用)
    reminder: {
      spreadsheetId: process.env.TODO_SPREADSHEET_ID, // 與 todo 共用同一個檔案
      sheetName: process.env.REMINDER_SHEET_NAME || 'reminders',
      serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    }
  },
  
  features: {
    expenseTracking: true,
    reminderSystem: true,
    todoSystem: true,
    debugMode: process.env.DEBUG_MODE === 'true'
  },
  
  // 預設設定
  defaults: {
    currency: 'TWD',
    timezone: 'Asia/Taipei',
    language: 'zh-tw'
  }
};

// services/baseSheetService.js (基礎 Google Sheets 服務類別)
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

class BaseSheetService {
  constructor(sheetConfig) {
    this.spreadsheetId = sheetConfig.spreadsheetId;
    this.sheetName = sheetConfig.sheetName;
    this.serviceAccountKey = JSON.parse(sheetConfig.serviceAccountKey);
    this.doc = null;
    this.sheet = null;
  }

  /**
   * 初始化 Google Sheets 連接
   */
  async initialize() {
    try {
      // 創建 JWT 認證
      const serviceAccountAuth = new JWT({
        email: this.serviceAccountKey.client_email,
        key: this.serviceAccountKey.private_key,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });

      // 初始化文檔
      this.doc = new GoogleSpreadsheet(this.spreadsheetId, serviceAccountAuth);
      await this.doc.loadInfo();
      
      // 取得或創建工作表
      this.sheet = this.doc.sheetsByTitle[this.sheetName];
      if (!this.sheet) {
        this.sheet = await this.doc.addSheet({
          title: this.sheetName,
          headerValues: this.getDefaultHeaders()
        });
      }

      console.log(`✅ Google Sheets 連接成功: ${this.doc.title} - ${this.sheetName}`);
      return true;
    } catch (error) {
      console.error(`❌ Google Sheets 連接失敗 (${this.sheetName}):`, error);
      throw error;
    }
  }

  /**
   * 取得預設標題列 (子類別需要覆寫此方法)
   */
  getDefaultHeaders() {
    return ['timestamp', 'data'];
  }

  /**
   * 確保工作表已初始化
   */
  async ensureInitialized() {
    if (!this.sheet) {
      await this.initialize();
    }
  }
}

module.exports = BaseSheetService;

// services/expenseSheetService.js (記帳專用的 Google Sheets 服務)
const BaseSheetService = require('./baseSheetService');
const config = require('../config/config');

class ExpenseSheetService extends BaseSheetService {
  constructor() {
    super(config.googleSheets.expense);
  }

  /**
   * 記帳資料的標題列
   */
  getDefaultHeaders() {
    return [
      'timestamp',
      'date', 
      'amount',
      'category',
      'description',
      'userId'
    ];
  }

  /**
   * 新增記帳記錄
   */
  async addExpense(expenseData) {
    await this.ensureInitialized();
    
    const row = await this.sheet.addRow({
      timestamp: new Date().toISOString(),
      date: expenseData.date,
      amount: expenseData.amount,
      category: expenseData.category,
      description: expenseData.description || '',
      userId: expenseData.userId
    });
    
    return row;
  }

  /**
   * 查詢使用者的記帳記錄
   */
  async getUserExpenses(userId, startDate = null, endDate = null) {
    await this.ensureInitialized();
    
    const rows = await this.sheet.getRows();
    let userExpenses = rows.filter(row => row.get('userId') === userId);
    
    // 日期篩選
    if (startDate || endDate) {
      userExpenses = userExpenses.filter(row => {
        const rowDate = new Date(row.get('date'));
        if (startDate && rowDate < new Date(startDate)) return false;
        if (endDate && rowDate > new Date(endDate)) return false;
        return true;
      });
    }
    
    return userExpenses.map(row => ({
      date: row.get('date'),
      amount: parseFloat(row.get('amount')),
      category: row.get('category'),
      description: row.get('description')
    }));
  }
}

module.exports = ExpenseSheetService;

// services/todoSheetService.js (待辦事項專用的 Google Sheets 服務)
const BaseSheetService = require('./baseSheetService');
const config = require('../config/config');

class TodoSheetService extends BaseSheetService {
  constructor() {
    super(config.googleSheets.todo);
  }

  /**
   * 待辦事項的標題列
   */
  getDefaultHeaders() {
    return [
      'id',
      'userId',
      'title',
      'description',
      'status',
      'priority',
      'dueDate',
      'createdAt',
      'updatedAt',
      'completedAt'
    ];
  }

  /**
   * 新增待辦事項
   */
  async addTodo(todoData) {
    await this.ensureInitialized();
    
    const todoId = this.generateTodoId();
    const now = new Date().toISOString();
    
    const row = await this.sheet.addRow({
      id: todoId,
      userId: todoData.userId,
      title: todoData.title,
      description: todoData.description || '',
      status: todoData.status || 'pending',
      priority: todoData.priority || 'medium',
      dueDate: todoData.dueDate || '',
      createdAt: now,
      updatedAt: now,
      completedAt: ''
    });
    
    return {
      id: todoId,
      ...todoData,
      createdAt: now
    };
  }

  /**
   * 查詢使用者的待辦事項
   */
  async getUserTodos(userId, status = null) {
    await this.ensureInitialized();
    
    const rows = await this.sheet.getRows();
    let userTodos = rows.filter(row => row.get('userId') === userId);
    
    if (status) {
      userTodos = userTodos.filter(row => row.get('status') === status);
    }
    
    return userTodos.map(row => ({
      id: row.get('id'),
      title: row.get('title'),
      description: row.get('description'),
      status: row.get('status'),
      priority: row.get('priority'),
      dueDate: row.get('dueDate'),
      createdAt: row.get('createdAt'),
      updatedAt: row.get('updatedAt'),
      completedAt: row.get('completedAt')
    }));
  }

  /**
   * 更新待辦事項狀態
   */
  async updateTodoStatus(userId, todoId, newStatus) {
    await this.ensureInitialized();
    
    const rows = await this.sheet.getRows();
    const todoRow = rows.find(row => 
      row.get('userId') === userId && row.get('id') === todoId
    );
    
    if (!todoRow) {
      throw new Error('待辦事項不存在');
    }
    
    const now = new Date().toISOString();
    todoRow.set('status', newStatus);
    todoRow.set('updatedAt', now);
    
    if (newStatus === 'completed') {
      todoRow.set('completedAt', now);
    }
    
    await todoRow.save();
    
    return {
      id: todoId,
      status: newStatus,
      updatedAt: now
    };
  }

  /**
   * 刪除待辦事項
   */
  async deleteTodo(userId, todoId) {
    await this.ensureInitialized();
    
    const rows = await this.sheet.getRows();
    const todoRow = rows.find(row => 
      row.get('userId') === userId && row.get('id') === todoId
    );
    
    if (!todoRow) {
      throw new Error('待辦事項不存在');
    }
    
    await todoRow.delete();
    return { id: todoId, deleted: true };
  }

  /**
   * 生成待辦事項ID
   */
  generateTodoId() {
    return 'todo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

module.exports = TodoSheetService;

// services/reminderSheetService.js (提醒事項專用的 Google Sheets 服務)
const BaseSheetService = require('./baseSheetService');
const config = require('../config/config');

class ReminderSheetService extends BaseSheetService {
  constructor() {
    super(config.googleSheets.reminder);
  }

  /**
   * 提醒事項的標題列
   */
  getDefaultHeaders() {
    return [
      'id',
      'userId',
      'title',
      'message',
      'reminderTime',
      'isRecurring',
      'recurringPattern',
      'status',
      'createdAt',
      'lastTriggered'
    ];
  }

  /**
   * 新增提醒事項
   */
  async addReminder(reminderData) {
    await this.ensureInitialized();
    
    const reminderId = this.generateReminderId();
    const now = new Date().toISOString();
    
    const row = await this.sheet.addRow({
      id: reminderId,
      userId: reminderData.userId,
      title: reminderData.title,
      message: reminderData.message || '',
      reminderTime: reminderData.reminderTime,
      isRecurring: reminderData.isRecurring || false,
      recurringPattern: reminderData.recurringPattern || '',
      status: 'active',
      createdAt: now,
      lastTriggered: ''
    });
    
    return {
      id: reminderId,
      ...reminderData,
      createdAt: now
    };
  }

  /**
   * 查詢使用者的提醒事項
   */
  async getUserReminders(userId, status = 'active') {
    await this.ensureInitialized();
    
    const rows = await this.sheet.getRows();
    const userReminders = rows.filter(row => 
      row.get('userId') === userId && 
      (status ? row.get('status') === status : true)
    );
    
    return userReminders.map(row => ({
      id: row.get('id'),
      title: row.get('title'),
      message: row.get('message'),
      reminderTime: row.get('reminderTime'),
      isRecurring: row.get('isRecurring') === 'true',
      recurringPattern: row.get('recurringPattern'),
      status: row.get('status'),
      createdAt: row.get('createdAt'),
      lastTriggered: row.get('lastTriggered')
    }));
  }

  /**
   * 刪除提醒事項
   */
  async deleteReminder(userId, reminderId) {
    await this.ensureInitialized();
    
    const rows = await this.sheet.getRows();
    const reminderRow = rows.find(row => 
      row.get('userId') === userId && row.get('id') === reminderId
    );
    
    if (!reminderRow) {
      throw new Error('提醒事項不存在');
    }
    
    await reminderRow.delete();
    return { id: reminderId, deleted: true };
  }

  /**
   * 更新提醒狀態
   */
  async updateReminderStatus(userId, reminderId, status) {
    await this.ensureInitialized();
    
    const rows = await this.sheet.getRows();
    const reminderRow = rows.find(row => 
      row.get('userId') === userId && row.get('id') === reminderId
    );
    
    if (!reminderRow) {
      throw new Error('提醒事項不存在');
    }
    
    reminderRow.set('status', status);
    if (status === 'triggered') {
      reminderRow.set('lastTriggered', new Date().toISOString());
    }
    
    await reminderRow.save();
    return { id: reminderId, status };
  }

  /**
   * 取得需要觸發的提醒
   */
  async getPendingReminders() {
    await this.ensureInitialized();
    
    const rows = await this.sheet.getRows();
    const now = new Date();
    
    const pendingReminders = rows.filter(row => {
      if (row.get('status') !== 'active') return false;
      
      const reminderTime = new Date(row.get('reminderTime'));
      return reminderTime <= now;
    });
    
    return pendingReminders.map(row => ({
      id: row.get('id'),
      userId: row.get('userId'),
      title: row.get('title'),
      message: row.get('message'),
      reminderTime: row.get('reminderTime'),
      isRecurring: row.get('isRecurring') === 'true',
      recurringPattern: row.get('recurringPattern')
    }));
  }

  /**
   * 生成提醒事項ID
   */
  generateReminderId() {
    return 'reminder_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

module.exports = ReminderSheetService;
