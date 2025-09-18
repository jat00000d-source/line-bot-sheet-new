require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const moment = require('moment-timezone');

// 導入模組化後的類別
const GoogleSheetsExpenseController = require('./controllers/expenseController');
const GoogleSheetsReminderController = require('./controllers/todoController');
const GoogleSheetsPurchaseController = require('./controllers/purchaseController');
const GoogleSheetsHabitController = require('./controllers/habitController'); // 新增習慣控制器
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
    this.purchaseController = new GoogleSheetsPurchaseController();
    this.habitController = new GoogleSheetsHabitController(this.client); // 新增習慣控制器
    this.commandParser = new EnhancedCommandParser();
    this.languageDetector = new BasicLanguageDetector();
    
    console.log('✅ 控制器初始化完成 (包含 Google Sheets 整合 + 代購功能 + 習慣追蹤)');
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
          'purchase-tracking': '✅ 運行中 (Google Sheets)',
          'habit-tracking': '✅ 運行中 (Google Sheets)', // 新增習慣追蹤狀態
          'scheduler': '✅ 運行中'
        },
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // 根目錄端點
    this.app.get('/', (req, res) => {
      res.status(200).json({
        message: 'LINE Bot 記帳提醒系統 - 完整版',
        status: 'Running',
        timezone: 'JST (UTC+9)',
        features: [
          'Google Sheets 記帳功能', 
          'Google Sheets 提醒功能', 
          'Google Sheets 代購功能',
          'Google Sheets 習慣追蹤', // 新增
          '自動提醒發送', 
          '多語言支援 (繁體中文/日語)', 
          '預算管理',
          '重複提醒支援',
          '自然語言解析',
          '朋友代購記錄',
          '預付金管理',
          '習慣養成追蹤', // 新增
          '習慣統計分析' // 新增
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
        // === 習慣相關指令 === (新增)
        case 'habit_create':
          console.log('🎯 處理建立習慣指令');
          response = await this.habitController.handleHabit(event, command, language);
          break;
          
        case 'habit_record':
          console.log('✅ 處理習慣打卡指令');
          response = await this.habitController.handleHabit(event, command, language);
          break;
          
        case 'habit_status':
          console.log('📊 處理習慣狀態查詢');
          response = await this.habitController.handleHabit(event, command, language);
          break;
          
        case 'habit_list':
          console.log('📋 處理習慣列表查詢');
          response = await this.habitController.handleHabit(event, command, language);
          break;
          
        case 'habit_pause':
        case 'habit_resume':
          console.log('⏸️ 處理習慣暫停/恢復');
          response = await this.habitController.handleHabit(event, command, language);
          break;

        // === 代購相關指令 ===
        case 'purchase':
          console.log('🛍️ 處理代購指令');
          response = await this.purchaseController.handlePurchase(event, command);
          break;
        
        case 'prepayment':
          console.log('💰 處理預付金指令');
          response = await this.purchaseController.handlePrepayment(event, command);
          break;
        
        case 'query_purchases':
          console.log('📋 查詢代購記錄');
          response = await this.purchaseController.handlePurchaseQuery(event, command);
          break;
        
        // === 記帳相關指令 ===
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
        
        // === 提醒相關指令 ===
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
        
        // === 說明和預設 ===
        case 'help':
          console.log('❓ 顯示說明');
          response = {
            type: 'text',
            text: this.getExtendedHelpMessage(language)
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

  getExtendedHelpMessage(language) {
    const helpMessage = `📖 LINE Bot 使用說明

💰 記帳功能：
• 早餐 120 → 記錄消費
• 查看支出 → 查詢本月支出
• 設定預算 50000 → 設定月度預算

⏰ 提醒功能：
• 明天8點開會 → 設定提醒
• 每天9點吃藥 → 重複提醒
• 查看提醒 → 查看所有提醒

🛍️ 代購功能：
• 代購 小明 iPhone保護殼 1500 藍色
• 預付 小明 10000 → 記錄朋友預付金
• 查看代購 → 查詢所有代購記錄
• 查看代購 小明 → 查詢特定朋友記錄

🎯 習慣追蹤： (新功能！)
• 新習慣 每天運動30分鐘 → 建立新習慣
• 運動✅ → 完成打卡
• 運動❌ → 未完成打卡
• 習慣列表 → 查看所有習慣
• 習慣統計 運動 → 查看特定習慣統計
• 暫停習慣 運動 → 暫停習慣追蹤

💡 支援格式：
• 自然語言：今天花了500元買午餐
• 簡潔格式：午餐 500
• 多語言：繁體中文、日語
• 習慣打卡：[習慣名]✅ 或 [習慣名]❌

❓ 其他指令：
• 說明 → 顯示此說明
• 剩餘 → 查看預算剩餘`;

    return helpMessage;
  }

  startScheduler() {
    const SchedulerService = require('./services/schedulerService');
    SchedulerService.start(this.todoController);
  }

  start() {
    this.app.listen(this.port, () => {
      const startTime = moment().tz('Asia/Tokyo');
      console.log('\n🚀 =================================');
      console.log(`   LINE Bot 伺服器啟動成功 - 完整版`);
      console.log('🚀 =================================');
      console.log(`📍 Port: ${this.port}`);
      console.log(`🕐 啟動時間: ${startTime.format('YYYY-MM-DD HH:mm:ss JST')}`);
      console.log(`🌏 時區: Asia/Tokyo (JST, UTC+9)`);
      console.log(`💰 記帳功能: ✅ 已啟用 (Google Sheets)`);
      console.log(`⏰ 提醒功能: ✅ 已啟用 (Google Sheets + 自動發送)`);
      console.log(`🛍️ 代購功能: ✅ 已啟用 (Google Sheets + 餘額管理)`);
      console.log(`🎯 習慣追蹤: ✅ 已啟用 (Google Sheets + 統計分析)`); // 新增
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
