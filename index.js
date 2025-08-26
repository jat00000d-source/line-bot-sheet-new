require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const cron = require('node-cron');
const moment = require('moment-timezone');

// 設定預設時區為日本時間
moment.tz.setDefault('Asia/Tokyo');

// Controllers
const { ExpenseController, TodoController } = require('./controllers/expenseController');

// Services
const ReminderScheduler = require('./services/reminderScheduler');
const NotificationService = require('./services/notificationService');

// Utils
const { CommandParser, LanguageDetector } = require('./utils/commandParser');

class LineBotApp {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    
    // LINE Bot 配置
    this.config = {
      channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
      channelSecret: process.env.CHANNEL_SECRET,
    };
    
    // 檢查環境變數
    this.checkEnvironmentVariables();
    
    this.client = new line.Client(this.config);
    
    // 初始化控制器
    this.expenseController = new ExpenseController();
    this.todoController = new TodoController();
    
    // 初始化服務
    this.reminderScheduler = new ReminderScheduler(this.client);
    this.notificationService = new NotificationService(this.client);
    
    // 讓 ReminderScheduler 可以存取提醒資料
    this.reminderScheduler.setReminders(this.todoController.reminders);
    
    // 初始化工具
    this.commandParser = new CommandParser();
    this.languageDetector = new LanguageDetector();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.startScheduler();
  }

  checkEnvironmentVariables() {
    console.log('🔍 檢查環境變數...');
    console.log(`CHANNEL_ACCESS_TOKEN: ${process.env.CHANNEL_ACCESS_TOKEN ? '已設定 ✅' : '未設定 ❌'}`);
    console.log(`CHANNEL_SECRET: ${process.env.CHANNEL_SECRET ? '已設定 ✅' : '未設定 ❌'}`);
    console.log(`GOOGLE_SHEET_ID: ${process.env.GOOGLE_SHEET_ID ? '已設定 ✅' : '未設定 ❌'}`);
    console.log(`REMINDERS_SHEET_ID: ${process.env.REMINDERS_SHEET_ID ? '已設定 ✅' : '未設定 ❌'}`);
    
    if (!process.env.CHANNEL_ACCESS_TOKEN || !process.env.CHANNEL_SECRET) {
      console.error('❌ 缺少必要的環境變數！請檢查 CHANNEL_ACCESS_TOKEN 和 CHANNEL_SECRET');
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
    
    // 健康檢查端點
    this.app.get('/health', (req, res) => {
      const now = moment().tz('Asia/Tokyo');
      const activeReminders = this.reminderScheduler.getActiveReminderCount();
      
      res.status(200).json({ 
        status: 'OK', 
        timestamp: now.toISOString(),
        localTime: now.format('YYYY-MM-DD HH:mm:ss JST'),
        timezone: 'Asia/Tokyo',
        services: {
          'expense-tracking': '✅ 運行中 (記憶體儲存)',
          'reminders': `✅ 運行中 (${activeReminders} 個活躍提醒)`
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
    // LINE Webhook
    this.app.post('/webhook', line.middleware(this.config), (req, res) => {
      console.log('📨 收到 Webhook 請求');
      
      Promise
        .all(req.body.events.map(this.handleEvent.bind(this)))
        .then((result) => {
          console.log('✅ Webhook 處理完成:', result.length, '個事件');
          res.json(result);
        })
        .catch((err) => {
          console.error('❌ Webhook 錯誤:', err);
          res.status(500).end();
        });
    });

    // 測試端點
    this.app.get('/test', (req, res) => {
      res.status(200).json({
        message: '測試端點正常運作',
        timestamp: moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss JST'),
        activeReminders: this.reminderScheduler.getActiveReminderCount()
      });
    });
  }

  async handleEvent(event) {
    console.log('🎯 處理事件類型:', event.type);
    
    if (event.type !== 'message' || event.message.type !== 'text') {
      console.log('⏭️ 跳過非文字訊息事件');
      return Promise.resolve(null);
    }

    const userId = event.source.userId;
    const messageText = event.message.text.trim();
    
    console.log(`👤 用戶 ID: ${userId}`);
    console.log(`💬 訊息內容: "${messageText}"`);
    
    try {
      // 檢測語言
      const language = this.languageDetector.detect(messageText);
      console.log(`🌐 檢測到的語言: ${language}`);
      
      // 解析指令
      const command = this.commandParser.parseCommand(messageText, language);
      console.log(`🔧 解析的指令:`, command);
      
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

      console.log('📤 準備回應:', response);

      if (response) {
        const result = await this.client.replyMessage(event.replyToken, response);
        console.log('✅ 成功傳送回應');
        return result;
      }
      
    } catch (error) {
      console.error('❌ 處理事件時發生錯誤:', error);
      console.error('錯誤堆疊:', error.stack);
      
      const errorMessage = {
        type: 'text',
        text: '處理訊息時發生錯誤，請稍後再試。'
      };
      
      try {
        return await this.client.replyMessage(event.replyToken, errorMessage);
      } catch (replyError) {
        console.error('❌ 傳送錯誤訊息失敗:', replyError);
      }
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
    // 設定日本時間的 cron job，每分鐘檢查提醒
    cron.schedule('* * * * *', async () => {
      try {
        const now = moment().tz('Asia/Tokyo');
        console.log(`⏰ [${now.format('YYYY-MM-DD HH:mm:ss JST')}] 檢查提醒中...`);
        await this.reminderScheduler.checkAndSendReminders();
      } catch (error) {
        console.error('❌ 排程器錯誤:', error);
      }
    }, {
      timezone: 'Asia/Tokyo'
    });
    
    console.log('⏰ 提醒排程器已啟動 (JST 時區)');
    console.log(`🕐 目前 JST 時間: ${moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss JST')}`);
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
      console.log(`🔗 健康檢查: https://your-app.onrender.com/health`);
      console.log(`🔗 測試端點: https://your-app.onrender.com/test`);
      
      console.log('\n🔧 環境變數狀態:');
      console.log(`   CHANNEL_ACCESS_TOKEN: ${process.env.CHANNEL_ACCESS_TOKEN ? '✅ 已設定' : '❌ 未設定'}`);
      console.log(`   CHANNEL_SECRET: ${process.env.CHANNEL_SECRET ? '✅ 已設定' : '❌ 未設定'}`);
      
      console.log('\n✅ 伺服器準備就緒，等待請求...\n');
    });
  }
}

// 啟動應用程式
const app = new LineBotApp();
app.start();

module.exports = LineBotApp;
