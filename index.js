require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const cron = require('node-cron');
const moment = require('moment-timezone');

// 設定默認時區為日本時間
moment.tz.setDefault('Asia/Tokyo');

// Controllers
const { ExpenseController, TodoController } = require('./controllers/expenseController');

// Services
const ReminderScheduler = require('./services/reminderScheduler');
const NotificationService = require('./services/notificationService');

// Utils
const CommandParser = require('./utils/commandParser');
const LanguageDetector = require('./utils/languageDetector');

class LineBotApp {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    
    // LINE Bot 配置
    this.config = {
      channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
      channelSecret: process.env.CHANNEL_SECRET,
    };
    
    this.client = new line.Client(this.config);
    
    // 初始化控制器
    this.expenseController = new ExpenseController();
    this.todoController = new TodoController();
    
    // 初始化服務
    this.reminderScheduler = new ReminderScheduler(this.client);
    this.notificationService = new NotificationService(this.client);
    
    // 初始化工具
    this.commandParser = new CommandParser();
    this.languageDetector = new LanguageDetector();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.startScheduler();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // 健康檢查端點
    this.app.get('/health', (req, res) => {
      const now = moment().tz('Asia/Tokyo');
      res.status(200).json({ 
        status: 'OK', 
        timestamp: now.toISOString(),
        localTime: now.format('YYYY-MM-DD HH:mm:ss JST'),
        timezone: 'Asia/Tokyo',
        services: {
          'expense-tracking': process.env.GOOGLE_SHEET_ID ? 'Connected' : 'Not configured',
          'reminders': process.env.REMINDERS_SHEET_ID ? 'Connected' : 'Not configured'
        },
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // 根目錄端點
    this.app.get('/', (req, res) => {
      res.status(200).json({
        message: 'LINE Bot 記帳提醒系統',
        status: 'Running',
        timezone: 'JST (UTC+9)'
      });
    });
  }

  setupRoutes() {
    // LINE Webhook
    this.app.post('/webhook', line.middleware(this.config), (req, res) => {
      Promise
        .all(req.body.events.map(this.handleEvent.bind(this)))
        .then((result) => res.json(result))
        .catch((err) => {
          console.error('Webhook error:', err);
          res.status(500).end();
        });
    });
  }

  async handleEvent(event) {
    if (event.type !== 'message' || event.message.type !== 'text') {
      return Promise.resolve(null);
    }

    const userId = event.source.userId;
    const messageText = event.message.text.trim();
    
    try {
      // 檢測語言
      const language = this.languageDetector.detect(messageText);
      
      // 解析指令
      const command = this.commandParser.parseCommand(messageText, language);
      
      let response;
      
      // 根據指令類型分發到對應的控制器
      switch (command.type) {
        case 'expense':
          response = await this.expenseController.handleExpense(event, command);
          break;
        
        case 'reminder':
        case 'todo':
          response = await this.todoController.handleTodo(event, command, language);
          break;
        
        case 'query_reminders':
          response = await this.todoController.handleQueryReminders(event, language);
          break;
        
        case 'delete_reminder':
          response = await this.todoController.handleDeleteReminder(event, command, language);
          break;
        
        default:
          response = await this.handleDefault(event, language);
          break;
      }

      if (response) {
        return this.client.replyMessage(event.replyToken, response);
      }
      
    } catch (error) {
      console.error('Handle event error:', error);
      const errorMessage = {
        type: 'text',
        text: '處理訊息時發生錯誤，請稍後再試。'
      };
      return this.client.replyMessage(event.replyToken, errorMessage);
    }
  }

  async handleDefault(event, language) {
    const helpMessage = language === 'ja' ? 
      'こんにちは！家計簿とリマインダー機能をご利用いただけます。\n\n📊 家計簿機能:\n「食費 500円 昼食」\n「交通費 200円」\n\n⏰ リマインダー機能:\n「明日8時に薬を飲む」\n「毎日19時に運動」\n「毎週月曜日に会議」\n\n📋 その他:\n「リマインダー一覧」\n「リマインダー削除 [番号]」' :
      '您好！我是記帳和提醒助手。\n\n📊 記帳功能:\n「食物 50元 午餐」\n「交通 30元」\n\n⏰ 提醒功能:\n「明天8點吃藥」\n「每天晚上7點運動」\n「每週一開會」\n\n📋 其他功能:\n「查看提醒」\n「刪除提醒 [編號]」';
    
    return {
      type: 'text',
      text: helpMessage
    };
  }

  startScheduler() {
    // 設定日本時間的 cron job，每分鐘檢查提醒
    // 使用 Asia/Tokyo 時區
    cron.schedule('* * * * *', async () => {
      try {
        const now = moment().tz('Asia/Tokyo');
        console.log(`⏰ [${now.format('YYYY-MM-DD HH:mm:ss JST')}] Checking reminders...`);
        await this.reminderScheduler.checkAndSendReminders();
      } catch (error) {
        console.error('Scheduler error:', error);
      }
    }, {
      timezone: 'Asia/Tokyo'
    });
    
    console.log('⏰ Reminder scheduler started (JST timezone)');
    console.log(`🕐 Current JST time: ${moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss JST')}`);
  }

  start() {
    this.app.listen(this.port, () => {
      const startTime = moment().tz('Asia/Tokyo');
      console.log(`🚀 Server is running on port ${this.port}`);
      console.log(`🕐 Started at: ${startTime.format('YYYY-MM-DD HH:mm:ss JST')}`);
      console.log(`🌏 Timezone: Asia/Tokyo (JST, UTC+9)`);
      console.log(`📊 Expense tracking: ${process.env.GOOGLE_SHEET_ID ? 'Connected ✅' : 'Not configured ❌'}`);
      console.log(`⏰ Reminders: ${process.env.REMINDERS_SHEET_ID ? 'Connected ✅' : 'Not configured ❌'}`);
      console.log(`🔗 Health check: https://your-app.onrender.com/health`);
    });
  }
}

// 啟動應用程式
const app = new LineBotApp();
app.start();

module.exports = LineBotApp;
