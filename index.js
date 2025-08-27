require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const cron = require('node-cron');
const moment = require('moment-timezone');

// 設定預設時區為日本時間
moment.tz.setDefault('Asia/Tokyo');

// 檢查必要的環境變數
function validateEnvironment() {
  const required = ['CHANNEL_ACCESS_TOKEN', 'CHANNEL_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ 缺少必要的環境變數:', missing.join(', '));
    process.exit(1);
  }
}

// 基本的 Controller 類別 (如果外部檔案無法載入)
class BasicExpenseController {
  constructor() {
    this.expenses = [];
  }

  async handleExpense(event, command) {
    try {
      // 基本記帳邏輯
      const expense = {
        id: Date.now(),
        category: command.category || '其他',
        amount: command.amount || 0,
        description: command.description || '',
        date: moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss'),
        userId: event.source.userId
      };
      
      this.expenses.push(expense);
      
      return {
        type: 'text',
        text: `✅ 已記錄支出\n類別: ${expense.category}\n金額: ${expense.amount}元\n說明: ${expense.description}`
      };
    } catch (error) {
      console.error('記帳處理錯誤:', error);
      return {
        type: 'text',
        text: '記帳處理時發生錯誤，請稍後再試。'
      };
    }
  }

  async handleExpenseQuery(event, command, language) {
    try {
      const userExpenses = this.expenses.filter(exp => exp.userId === event.source.userId);
      const total = userExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      
      const message = language === 'ja' ? 
        `📊 支出統計\n總計: ${total}円\n記錄數: ${userExpenses.length}件` :
        `📊 支出統計\n總計: ${total}元\n記錄數: ${userExpenses.length}筆`;
      
      return {
        type: 'text',
        text: message
      };
    } catch (error) {
      console.error('查詢支出錯誤:', error);
      return {
        type: 'text',
        text: '查詢支出時發生錯誤。'
      };
    }
  }
}

class BasicTodoController {
  constructor() {
    this.reminders = [];
  }

  async handleTodo(event, command, language) {
    try {
      const reminder = {
        id: Date.now(),
        userId: event.source.userId,
        text: command.text || '提醒',
        time: command.time || moment().add(1, 'hour').format('YYYY-MM-DD HH:mm'),
        recurring: command.recurring || false,
        active: true
      };
      
      this.reminders.push(reminder);
      
      const message = language === 'ja' ? 
        `⏰ リマインダーを設定しました\n内容: ${reminder.text}\n時間: ${reminder.time}` :
        `⏰ 已設定提醒\n內容: ${reminder.text}\n時間: ${reminder.time}`;
      
      return {
        type: 'text',
        text: message
      };
    } catch (error) {
      console.error('提醒處理錯誤:', error);
      return {
        type: 'text',
        text: '設定提醒時發生錯誤。'
      };
    }
  }

  async handleQueryReminders(event, language) {
    try {
      const userReminders = this.reminders.filter(r => r.userId === event.source.userId && r.active);
      
      if (userReminders.length === 0) {
        const message = language === 'ja' ? 'リマインダーがありません。' : '目前沒有提醒事項。';
        return {
          type: 'text',
          text: message
        };
      }
      
      const reminderList = userReminders.map((r, index) => `${index + 1}. ${r.text} - ${r.time}`).join('\n');
      const message = language === 'ja' ? 
        `📋 リマインダー一覧:\n${reminderList}` :
        `📋 提醒列表:\n${reminderList}`;
      
      return {
        type: 'text',
        text: message
      };
    } catch (error) {
      console.error('查詢提醒錯誤:', error);
      return {
        type: 'text',
        text: '查詢提醒時發生錯誤。'
      };
    }
  }

  async handleDeleteReminder(event, command, language) {
    try {
      const index = parseInt(command.index) - 1;
      const userReminders = this.reminders.filter(r => r.userId === event.source.userId && r.active);
      
      if (index >= 0 && index < userReminders.length) {
        userReminders[index].active = false;
        const message = language === 'ja' ? 
          'リマインダーを削除しました。' :
          '已刪除提醒。';
        
        return {
          type: 'text',
          text: message
        };
      } else {
        const message = language === 'ja' ? 
          '指定されたリマインダーが見つかりません。' :
          '找不到指定的提醒。';
        
        return {
          type: 'text',
          text: message
        };
      }
    } catch (error) {
      console.error('刪除提醒錯誤:', error);
      return {
        type: 'text',
        text: '刪除提醒時發生錯誤。'
      };
    }
  }
}

// 基本的命令解析器
class BasicCommandParser {
  parseCommand(text, language = 'zh') {
    const lowerText = text.toLowerCase();
    
    // 記帳相關命令
    if (lowerText.includes('支出') || lowerText.includes('查看') || lowerText.includes('統計')) {
      return { type: 'query_expenses' };
    }
    
    // 提醒相關命令
    if (lowerText.includes('提醒') || lowerText.includes('リマインダー')) {
      if (lowerText.includes('查看') || lowerText.includes('列表') || lowerText.includes('一覧')) {
        return { type: 'query_reminders' };
      }
      if (lowerText.includes('刪除') || lowerText.includes('削除')) {
        const match = text.match(/(\d+)/);
        return { 
          type: 'delete_reminder',
          index: match ? match[1] : '1'
        };
      }
      return { 
        type: 'reminder',
        text: text,
        time: moment().add(1, 'hour').format('YYYY-MM-DD HH:mm')
      };
    }
    
    // 基本記帳命令 (包含數字的訊息)
    const amountMatch = text.match(/(\d+)/);
    if (amountMatch) {
      return {
        type: 'expense',
        amount: parseInt(amountMatch[1]),
        category: '其他',
        description: text
      };
    }
    
    return { type: 'unknown' };
  }
}

class BasicLanguageDetector {
  detect(text) {
    // 簡單的語言檢測
    const japaneseChars = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    return japaneseChars.test(text) ? 'ja' : 'zh';
  }
}

class LineBotApp {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    
    // 驗證環境變數
    validateEnvironment();
    
    // LINE Bot 配置
    this.config = {
      channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
      channelSecret: process.env.CHANNEL_SECRET,
    };
    
    this.client = new line.Client(this.config);
    
    // 初始化控制器（使用基本版本，避免外部依賴問題）
    this.initializeControllers();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.startScheduler();
  }

  initializeControllers() {
    try {
      // 嘗試載入外部控制器
      const { ExpenseController, TodoController } = require('./controllers/expenseController');
      this.expenseController = new ExpenseController();
      this.todoController = new TodoController();
      
      // 初始化服務
      try {
        const ReminderScheduler = require('./services/reminderScheduler');
        const NotificationService = require('./services/notificationService');
        
        this.reminderScheduler = new ReminderScheduler(this.client);
        this.notificationService = new NotificationService(this.client);
        
        // 讓 ReminderScheduler 可以存取提醒資料
        this.reminderScheduler.setReminders(this.todoController.reminders);
        console.log('✅ 成功載入服務模組');
      } catch (serviceError) {
        console.log('⚠️ 服務模組載入失敗:', serviceError.message);
      }
      
      console.log('✅ 成功載入外部控制器');
    } catch (error) {
      // 如果外部控制器載入失敗，使用基本版本
      console.log('⚠️ 外部控制器載入失敗，使用基本版本:', error.message);
      this.expenseController = new BasicExpenseController();
      this.todoController = new BasicTodoController();
    }
    
    try {
      // 嘗試載入外部工具類
      const { CommandParser, LanguageDetector } = require('./utils/commandParser');
      this.commandParser = new CommandParser();
      this.languageDetector = new LanguageDetector();
      console.log('✅ 成功載入外部工具類');
    } catch (error) {
      // 如果外部工具類載入失敗，使用基本版本
      console.log('⚠️ 外部工具類載入失敗，使用基本版本:', error.message);
      this.commandParser = new BasicCommandParser();
      this.languageDetector = new BasicLanguageDetector();
    }
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // 請求記錄中介軟體
    this.app.use((req, res, next) => {
      const now = moment().tz('Asia/Tokyo');
      console.log(`📝 [${now.format('YYYY-MM-DD HH:mm:ss JST')}] ${req.method} ${req.path}`);
      next();
    });
    
    // 錯誤處理中介軟體
    this.app.use((err, req, res, next) => {
      console.error('❌ 中介軟體錯誤:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
    
    // 健康檢查端點
    this.app.get('/health', (req, res) => {
      const now = moment().tz('Asia/Tokyo');
      
      res.status(200).json({ 
        status: 'OK', 
        timestamp: now.toISOString(),
        localTime: now.format('YYYY-MM-DD HH:mm:ss JST'),
        timezone: 'Asia/Tokyo',
        services: {
          'expense-tracking': '✅ 運行中 (記憶體儲存)',
          'reminders': '✅ 運行中'
        },
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // 根目錄端點
    this.app.get('/', (req, res) => {
      res.status(200).json({
        message: 'LINE Bot 記帳提醒系統',
        status: 'Running',
        timezone: 'JST (UTC+9)',
        features: ['記帳功能', '提醒功能', '多語言支援 (繁體中文/日語)']
      });
    });
  }

  setupRoutes() {
    // 測試專用的 Webhook 端點（不需要驗證）
    this.app.post('/webhook-test', async (req, res) => {
      console.log('🧪 測試 Webhook 端點被調用');
      console.log('請求標頭:', req.headers);
      console.log('請求內容:', JSON.stringify(req.body, null, 2));
      
      res.status(200).json({ 
        message: 'Test webhook OK',
        timestamp: moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss JST')
      });
    });

    // LINE Webhook
    this.app.post('/webhook', async (req, res) => {
      try {
        console.log('📨 收到 Webhook 請求');
        console.log('請求標頭:', JSON.stringify(req.headers, null, 2));
        console.log('請求內容:', JSON.stringify(req.body, null, 2));
        
        // 先回應 200 狀態碼，避免超時
        res.status(200).json({ message: 'OK' });
        
        if (!req.body || !req.body.events) {
          console.log('⚠️ 無效的請求內容');
          return;
        }

        // 異步處理事件，避免阻塞回應
        setImmediate(async () => {
          try {
            const results = await Promise.allSettled(
              req.body.events.map(event => this.handleEvent(event))
            );
            
            // 檢查是否有失敗的事件處理
            const failed = results.filter(r => r.status === 'rejected');
            if (failed.length > 0) {
              console.error('❌ 部分事件處理失敗:', failed.map(f => f.reason));
            }
            
            console.log('✅ Webhook 處理完成:', results.length, '個事件');
          } catch (asyncErr) {
            console.error('❌ 異步事件處理錯誤:', asyncErr);
          }
        });
        
      } catch (err) {
        console.error('❌ Webhook 錯誤:', err);
        console.error('錯誤堆疊:', err.stack);
        
        if (!res.headersSent) {
          res.status(200).json({ message: 'Error handled' });
        }
      }
    });

    // 測試端點
    this.app.get('/test', (req, res) => {
      res.status(200).json({
        message: '測試端點正常運作',
        timestamp: moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss JST'),
        controllers: {
          expense: !!this.expenseController,
          todo: !!this.todoController,
          parser: !!this.commandParser,
          detector: !!this.languageDetector
        }
      });
    });

    // 模擬 LINE 事件的測試端點
    this.app.post('/test-event', async (req, res) => {
      try {
        const testEvent = {
          type: 'message',
          message: {
            type: 'text',
            text: req.body.message || '測試訊息'
          },
          source: {
            userId: 'test-user-id'
          },
          replyToken: 'test-reply-token'
        };

        console.log('🧪 處理測試事件:', testEvent);
        
        const result = await this.handleEvent(testEvent);
        
        res.status(200).json({
          success: true,
          message: '測試事件處理完成',
          result: result,
          timestamp: moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss JST')
        });
        
      } catch (error) {
        console.error('❌ 測試事件處理錯誤:', error);
        res.status(200).json({
          success: false,
          error: error.message,
          timestamp: moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss JST')
        });
      }
    });
  }

  async handleEvent(event) {
    try {
      console.log('🎯 處理事件類型:', event.type);
      console.log('🎯 完整事件內容:', JSON.stringify(event, null, 2));
      
      if (event.type !== 'message' || event.message.type !== 'text') {
        console.log('⏭️ 跳過非文字訊息事件');
        return null;
      }

      const userId = event.source.userId;
      const messageText = event.message.text.trim();
      
      console.log(`👤 用戶 ID: ${userId}`);
      console.log(`💬 訊息內容: "${messageText}"`);
      
      // 檢測語言
      const language = this.languageDetector.detect(messageText);
      console.log(`🌐 檢測到的語言: ${language}`);
      
      // 解析指令
      const command = this.commandParser.parseCommand(messageText, language);
      console.log(`🔧 解析的指令:`, JSON.stringify(command, null, 2));
      
      let response;
      
      // 根據指令類型分發到對應的控制器
      switch (command.type) {
        case 'expense':
          console.log('💰 處理記帳指令');
          response = await this.expenseController.handleExpense(event, command);
          break;
        
        case 'reminder':
          console.log('⏰ 處理提醒指令');
          response = await this.todoController.handleTodo(event, command, language);
          break;
        
        case 'query_reminders':
          console.log('📋 查詢提醒列表');
          response = await this.todoController.handleQueryReminders(event, language);
          break;
        
        case 'query_expenses':
          console.log('💰 查詢支出記錄');
          response = await this.expenseController.handleExpenseQuery(event, command, language);
          break;
        
        case 'delete_reminder':
          console.log('🗑️ 刪除提醒');
          response = await this.todoController.handleDeleteReminder(event, command, language);
          break;
        
        default:
          console.log('❓ 處理預設回應');
          response = await this.handleDefault(event, language);
          break;
      }

      console.log('📤 準備回應:', JSON.stringify(response, null, 2));

      // 如果是測試事件，不要真的發送訊息
      if (event.replyToken === 'test-reply-token') {
        console.log('🧪 這是測試事件，跳過實際發送');
        return response;
      }

      if (response && event.replyToken) {
        try {
          await this.client.replyMessage(event.replyToken, response);
          console.log('✅ 成功傳送回應');
        } catch (replyError) {
          console.error('❌ 傳送回應失敗:', replyError);
          console.error('回應內容:', JSON.stringify(response, null, 2));
        }
        return response;
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ 處理事件時發生錯誤:', error);
      console.error('錯誤堆疊:', error.stack);
      console.error('事件內容:', JSON.stringify(event, null, 2));
      
      // 嘗試傳送錯誤訊息
      if (event.replyToken && event.replyToken !== 'test-reply-token') {
        try {
          const errorMessage = {
            type: 'text',
            text: '處理訊息時發生錯誤，請稍後再試。'
          };
          
          await this.client.replyMessage(event.replyToken, errorMessage);
          console.log('✅ 成功傳送錯誤訊息');
        } catch (replyError) {
          console.error('❌ 傳送錯誤訊息失敗:', replyError);
        }
      }
      
      throw error; // 重新拋出錯誤以便記錄
    }
  }

  async handleDefault(event, language) {
    const helpMessage = language === 'ja' ? 
      'こんにちは！家計簿とリマインダー機能をご利用いただけます。\n\n💰 家計簿機能:\n「食費 500円 昼食」\n「交通費 200円」\n「支出確認」\n\n⏰ リマインダー機能:\n「明日8時に薬を飲む」\n「毎日19時に運動」\n「毎週月曜日に会議」\n\n📋 管理機能:\n「リマインダー一覧」\n「リマインダー削除 [番号]」' :
      '您好！我是記帳和提醒助手。\n\n💰 記帳功能:\n「食物 50元 午餐」\n「交通 30元」\n「查看支出」\n\n⏰ 提醒功能:\n「明天8點吃藥」\n「每天晚上7點運動」\n「每週一開會」\n\n📋 管理功能:\n「查看提醒」\n「刪除提醒 [編號]」';
    
    return {
      type: 'text',
      text: helpMessage
    };
  }

  startScheduler() {
    try {
      // 設定日本時間的 cron job，每分鐘檢查提醒
      cron.schedule('* * * * *', async () => {
        try {
          const now = moment().tz('Asia/Tokyo');
          console.log(`⏰ [${now.format('YYYY-MM-DD HH:mm:ss JST')}] 檢查提醒中...`);
          
          // 如果有 reminderScheduler，執行檢查
          if (this.reminderScheduler && typeof this.reminderScheduler.checkAndSendReminders === 'function') {
            await this.reminderScheduler.checkAndSendReminders();
          } else {
            console.log('⏰ ReminderScheduler 不可用，跳過提醒檢查');
          }
        } catch (error) {
          console.error('❌ 排程器錯誤:', error);
        }
      }, {
        timezone: 'Asia/Tokyo'
      });
      
      console.log('⏰ 提醒排程器已啟動 (JST 時區)');
      console.log(`🕐 目前 JST 時間: ${moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss JST')}`);
    } catch (error) {
      console.error('❌ 排程器啟動失敗:', error);
    }
  }

  start() {
    this.app.listen(this.port, () => {
      const startTime = moment().tz('Asia/Tokyo');
      console.log('\n🚀 =================================');
      console.log(`   LINE Bot 伺服器啟動成功`);
      console.log('🚀 =================================');
      console.log(`📍 Port: ${this.port}`);
      console.log(`🕐 啟動時間: ${startTime.format('YYYY-MM-DD HH:mm:ss JST')}`);
      console.log(`🌏 時區: Asia/Tokyo (JST, UTC+9)`);
      console.log(`💰 記帳功能: ✅ 已啟用 (記憶體儲存)`);
      console.log(`⏰ 提醒功能: ✅ 已啟用`);
      console.log(`🌐 多語言支援: ✅ 繁體中文/日語`);
      
      console.log('\n🔧 環境變數狀態:');
      console.log(`   CHANNEL_ACCESS_TOKEN: ${process.env.CHANNEL_ACCESS_TOKEN ? '✅ 已設定' : '❌ 未設定'}`);
      console.log(`   CHANNEL_SECRET: ${process.env.CHANNEL_SECRET ? '✅ 已設定' : '❌ 未設定'}`);
      console.log(`   GOOGLE_SHEET_ID: ${process.env.GOOGLE_SHEET_ID ? '✅ 已設定' : '❌ 未設定'}`);
      console.log(`   REMINDERS_SHEET_ID: ${process.env.REMINDERS_SHEET_ID ? '✅ 已設定' : '❌ 未設定'}`);
      
      console.log('\n🔧 控制器狀態:');
      console.log(`   ExpenseController: ${this.expenseController.constructor.name}`);
      console.log(`   TodoController: ${this.todoController.constructor.name}`);
      console.log(`   CommandParser: ${this.commandParser.constructor.name}`);
      console.log(`   LanguageDetector: ${this.languageDetector.constructor.name}`);
      
      console.log('\n✅ 伺服器準備就緒，等待請求...\n');
    });
  }
}

// 全域錯誤處理
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕獲的例外:', error);
  console.error('應用程式將繼續運行...');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未處理的 Promise 拒絕:', reason);
  console.error('位置:', promise);
});

// 啟動應用程式
const app = new LineBotApp();
app.start();

module.exports = LineBotApp;
