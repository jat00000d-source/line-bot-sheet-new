require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const moment = require('moment-timezone');

// 導入模組化後的類別
const GoogleSheetsExpenseController = require('./controllers/expenseController');
const GoogleSheetsReminderController = require('./controllers/todoController');
const EnhancedCommandParser = require('./parsers/commandParser');
const BasicLanguageDetector = require('./utils/languageDetector');
const { validateEnvironment, createServiceAccountAuth } = require('./utils/envValidator');

// 設定預設時區
moment.tz.setDefault('Asia/Tokyo');

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
    
    // 初始化控制器
    this.initializeControllers();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.startScheduler();
  }

  initializeControllers() {
    this.expenseController = new GoogleSheetsExpenseController();
    this.todoController = new GoogleSheetsReminderController(this.client);
    this.commandParser = new EnhancedCommandParser();
    this.languageDetector = new BasicLanguageDetector();
    
    console.log('✅ 控制器初始化完成 (包含 Google Sheets 整合)');
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
    
    // 健康檢查端點
    this.app.get('/health', (req, res) => {
      const now = moment().tz('Asia/Tokyo');
      
      res.status(200).json({ 
        status: 'OK', 
        timestamp: now.toISOString(),
        localTime: now.format('YYYY-MM-DD HH:mm:ss JST'),
        timezone: 'Asia/Tokyo',
        services: {
          'expense-tracking': '✅ 運行中 (Google Sheets)',
          'reminders': '✅ 運行中 (Google Sheets)',
          'scheduler': '✅ 運行中'
        },
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // 根目錄端點
    this.app.get('/', (req, res) => {
      res.status(200).json({
        message: 'LINE Bot 記帳提醒系統 - 改良版',
        status: 'Running',
        timezone: 'JST (UTC+9)',
        features: [
          'Google Sheets 記帳功能', 
          'Google Sheets 提醒功能', 
          '自動提醒發送', 
          '多語言支援 (繁體中文/日語)', 
          '預算管理',
          '重複提醒支援',
          '自然語言解析'
        ]
      });
    });
  }

  setupRoutes() {
    // LINE Webhook
    this.app.post('/webhook', async (req, res) => {
      try {
        console.log('📨 收到 Webhook 請求');
        
        // 先回應 200 狀態碼
        res.status(200).json({ message: 'OK' });
        
        if (!req.body || !req.body.events) {
          console.log('⚠️ 無效的請求內容');
          return;
        }

        // 異步處理事件
        setImmediate(async () => {
          try {
            const results = await Promise.allSettled(
              req.body.events.map(event => this.handleEvent(event))
            );
            
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
        
        if (!res.headersSent) {
          res.status(200).json({ message: 'Error handled' });
        }
      }
    });

    // 測試相關端點
    require('./routes/testRoutes')(this.app, this.todoController, this);
  }

  async handleEvent(event) {
    try {
      console.log('🎯 處理事件類型:', event.type);
      
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
        
        case 'query_expenses':
          console.log('💰 查詢支出記錄');
          response = await this.expenseController.handleExpenseQuery(event, command, language);
          break;
        
        case 'set_budget':
          console.log('💰 設定預算');
          const budgetResult = await this.expenseController.setBudget(command.amount);
          response = {
            type: 'text',
            text: budgetResult
          };
          break;
        
        case 'budget':
        case 'remaining':
          console.log('💰 查看預算狀況');
          const budgetInfo = await this.expenseController.calculateBudgetRemaining();
          response = {
            type: 'text',
            text: budgetInfo.message
          };
          break;
        
        case 'reminder':
          console.log('⏰ 處理提醒指令');
          response = await this.todoController.handleTodo(event, command, language);
          break;
        
        case 'query_reminders':
          console.log('📋 查詢提醒列表');
          response = await this.todoController.handleQueryReminders(event, language);
          break;
        
        case 'delete_reminder':
          console.log('🗑️ 刪除提醒');
          response = await this.todoController.handleDeleteReminder(event, command, language);
          break;
        
        case 'help':
          console.log('❓ 顯示說明');
          const HelpService = require('./services/helpService');
          response = {
            type: 'text',
            text: HelpService.getHelpMessage(language)
          };
          break;
        
        default:
          console.log('❓ 處理預設回應');
          const DefaultService = require('./services/defaultService');
          response = DefaultService.getDefaultResponse(language);
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
        }
        return response;
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ 處理事件時發生錯誤:', error);
      
      // 嘗試傳送錯誤訊息
      if (event.replyToken && event.replyToken !== 'test-reply-token') {
        try {
          const errorMessage = {
            type: 'text',
            text: '處理訊息時發生錯誤，請稍後再試。'
          };
          
          await this.client.replyMessage(event.replyToken, errorMessage);
        } catch (replyError) {
          console.error('❌ 傳送錯誤訊息失敗:', replyError);
        }
      }
      
      throw error;
    }
  }

  startScheduler() {
    const SchedulerService = require('./services/schedulerService');
    SchedulerService.start(this.todoController);
  }

  start() {
    this.app.listen(this.port, () => {
      const startTime = moment().tz('Asia/Tokyo');
      console.log('\n🚀 =================================');
      console.log(`   LINE Bot 伺服器啟動成功 - 改良版`);
      console.log('🚀 =================================');
      console.log(`📍 Port: ${this.port}`);
      console.log(`🕐 啟動時間: ${startTime.format('YYYY-MM-DD HH:mm:ss JST')}`);
      console.log(`🌏 時區: Asia/Tokyo (JST, UTC+9)`);
      console.log(`💰 記帳功能: ✅ 已啟用 (Google Sheets)`);
      console.log(`⏰ 提醒功能: ✅ 已啟用 (Google Sheets + 自動發送)`);
      console.log(`🔄 排程系統: ✅ 已啟用 (每分鐘檢查)`);
      console.log(`🌐 多語言支援: ✅ 繁體中文/日語`);
      console.log('\n✅ 伺服器準備就緒，等待請求...\n');
    });
  }
}

// 全域錯誤處理
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕獲的例外:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未處理的 Promise 拒絕:', reason);
});

// 優雅關閉
process.on('SIGTERM', () => {
  console.log('🔄 收到 SIGTERM 信號，準備優雅關閉...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🔄 收到 SIGINT 信號，準備優雅關閉...');
  process.exit(0);
});

// 啟動應用程式
const app = new LineBotApp();
app.start();

module.exports = LineBotApp;
