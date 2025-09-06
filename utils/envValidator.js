# 工具模組

## utils/envValidator.js
```javascript
const { JWT } = require('google-auth-library');

function validateEnvironment() {
  const required = ['CHANNEL_ACCESS_TOKEN', 'CHANNEL_SECRET', 'GOOGLE_SPREADSHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ 缺少必要的環境變數:', missing.join(', '));
    process.exit(1);
  }
}

function createServiceAccountAuth() {
  return new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

module.exports = {
  validateEnvironment,
  createServiceAccountAuth
};
```

## utils/languageDetector.js
```javascript
class BasicLanguageDetector {
  detect(text) {
    const japaneseChars = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    return japaneseChars.test(text) ? 'ja' : 'zh';
  }
}

module.exports = BasicLanguageDetector;
```

## services/helpService.js
```javascript
class HelpService {
  static getHelpMessage(language = 'zh') {
    if (language === 'ja') {
      return `📝 記帳ボット使用説明 - 改良版\n\n` +
             `💡 記帳形式：\n` +
             `【従来形式】\n` +
             `項目　金額　[備考]（全角スペース対応）\n` +
             `項目 金額 [備考]（半角スペース対応）\n\n` +
             `【自然言語形式】\n` +
             `• 昨日ランチ100円食べた\n` +
             `• 今日コーヒー85円\n` +
             `• 交通費150\n` +
             `• 午餐100元（中国語もOK）\n\n` +
             `💰 予算管理：\n` +
             `• 予算設定 50000 （月度予算設定）\n` +
             `• 予算 （予算状況確認）\n` +
             `• 残り （残額確認）\n\n` +
             `⏰ リマインダー機能（NEW！）：\n` +
             `【時間指定】\n` +
             `• 明日8時に薬を飲む\n` +
             `• 今日15:30に会議\n` +
             `• 30分後に買い物\n` +
             `• 2時間後に電話をかける\n\n` +
             `【繰り返し設定】\n` +
             `• 毎日19時に運動\n` +
             `• 毎週月曜日9時に会議\n` +
             `• 毎月1日に家賃を払う\n\n` +
             `【管理機能】\n` +
             `• リマインダー一覧 （全ての提醒確認）\n` +
             `• リマインダー削除 2 （2番目を削除）\n\n` +
             `✨ 改良点：\n` +
             `• Google Sheets 完全統合\n` +
             `• 自動リマインダー送信\n` +
             `• 繰り返し機能完備\n` +
             `• 自然言語理解向上\n` +
             `• 中国語・日本語完全対応\n` +
             `• データ永続化`;
    } else {
      return `📝 記帳機器人使用說明 - 改良版\n\n` +
             `💡 記帳格式：\n` +
             `【傳統格式】\n` +
             `項目　金額　[備註]（支援全形空格）\n` +
             `項目 金額 [備註]（支援半形空格）\n\n` +
             `【自然語言格式】\n` +
             `• 昨天午餐吃了100元\n` +
             `• 今天咖啡85円\n` +
             `• 交通費150\n` +
             `• ランチ200（日文也可以）\n\n` +
             `💰 預算管理：\n` +
             `• 設定預算 50000 （設定月度預算）\n` +
             `• 預算 （查看預算狀況）\n` +
             `• 剩餘 （查看剩餘金額）\n\n` +
             `⏰ 提醒功能（全新！）：\n` +
             `【時間指定】\n` +
             `• 明天8點吃藥\n` +
             `• 今天下午3點半開會\n` +
             `• 30分鐘後買東西\n` +
             `• 2小時後打電話\n\n` +
             `【重複設定】\n` +
             `• 每天晚上7點運動\n` +
             `• 每週一早上9點開會\n` +
             `• 每月1號繳房租\n\n` +
             `【管理功能】\n` +
             `• 查看提醒 （查看所有提醒）\n` +
             `• 刪除提醒 2 （刪除第2個提醒）\n\n` +
             `✨ 改良特色：\n` +
             `• Google Sheets 完全整合\n` +
             `• 自動提醒發送\n` +
             `• 重複功能完善\n` +
             `• 自然語言理解增強\n` +
             `• 支援中日雙語\n` +
             `• 資料永久保存`;
    }
  }
}

module.exports = HelpService;
```

## services/defaultService.js
```javascript
class DefaultService {
  static getDefaultResponse(language) {
    const helpMessage = language === 'ja' ? 
      'こんにちは！改良版家計簿とリマインダー機能をご利用いただけます。\n\n💰 家計簿機能:\n「食費 500円 昼食」\n「交通費 200円」\n「支出確認」または「集計」\n「予算設定 50000」\n\n⏰ リマインダー機能（NEW！）:\n「明日8時に薬を飲む」\n「毎日19時に運動」\n「毎週月曜日に会議」\n「30分後に買い物」\n\n📋 管理機能:\n「リマインダー一覧」\n「リマインダー削除 [番号]」\n\n✨ 新機能:\n• Google Sheets 自動保存\n• 自動リマインダー送信\n• 繰り返し設定対応\n• 自然言語理解向上\n\n「説明」で詳細な使用方法をご確認ください。' :
      '您好！我是改良版記帳和提醒助手。\n\n💰 記帳功能:\n「食物 50元 午餐」\n「交通 30元」\n「查看支出」或「總結」\n「設定預算 50000」\n\n⏰ 提醒功能（全新！）:\n「明天8點吃藥」\n「每天晚上7點運動」\n「每週一開會」\n「30分鐘後買東西」\n\n📋 管理功能:\n「查看提醒」\n「刪除提醒 [編號]」\n\n✨ 新功能:\n• Google Sheets 自動儲存\n• 自動提醒發送\n• 支援重複設定\n• 自然語言理解增強\n\n請輸入「說明」查看詳細使用方法。';
    
    return {
      type: 'text',
      text: helpMessage
    };
  }
}

module.exports = DefaultService;
```

## services/schedulerService.js
```javascript
const cron = require('node-cron');
const moment = require('moment-timezone');

class SchedulerService {
  static start(todoController) {
    try {
      // 每分鐘檢查提醒
      cron.schedule('* * * * *', async () => {
        try {
          const now = moment().tz('Asia/Tokyo');
          console.log(`⏰ [${now.format('YYYY-MM-DD HH:mm:ss JST')}] 檢查提醒中...`);
          
          await todoController.checkAndSendReminders();
          
        } catch (error) {
          console.error('❌ 排程器錯誤:', error);
        }
      }, {
        timezone: 'Asia/Tokyo'
      });

      // 每小時執行一次系統狀態報告
      cron.schedule('0 * * * *', () => {
        const now = moment().tz('Asia/Tokyo');
        console.log(`📊 [${now.format('YYYY-MM-DD HH:mm:ss JST')}] 系統狀態正常 - 提醒系統運行中`);
      }, {
        timezone: 'Asia/Tokyo'
      });
      
      console.log('⏰ 提醒排程器已啟動 (JST 時區)');
      console.log(`🕐 目前 JST 時間: ${moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss JST')}`);
      console.log('📅 排程設定:');
      console.log('   - 每分鐘檢查提醒');
      console.log('   - 每小時系統狀態報告');
      
    } catch (error) {
      console.error('❌ 排程器啟動失敗:', error);
    }
  }
}

module.exports = SchedulerService;
```

## routes/testRoutes.js
```javascript
const moment = require('moment-timezone');

module.exports = (app, todoController, mainApp) => {
  // 測試端點
  app.get('/test', (req, res) => {
    res.status(200).json({
      message: '測試端點正常運作 - 改良版',
      timestamp: moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss JST'),
      controllers: {
        expense: !!mainApp.expenseController,
        reminder: !!mainApp.todoController,
        parser: !!mainApp.commandParser,
        detector: !!mainApp.languageDetector
      },
      googleSheets: {
        configured: !!(process.env.GOOGLE_SPREADSHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL),
        features: ['記帳功能', '提醒功能', '自動排程']
      }
    });
  });

  // 手動觸發提醒檢查的測試端點
  app.post('/test-reminders', async (req, res) => {
    try {
      console.log('🧪 手動觸發提醒檢查');
      await todoController.checkAndSendReminders();
      
      res.status(200).json({
        success: true,
        message: '提醒檢查已執行',
        timestamp: moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss JST')
      });
      
    } catch (error) {
      console.error('❌ 測試提醒檢查錯誤:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss JST')
      });
    }
  });

  // 模擬 LINE 事件的測試端點
  app.post('/test-event', async (req, res) => {
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
      
      const result = await mainApp.handleEvent(testEvent);
      
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
};
```
