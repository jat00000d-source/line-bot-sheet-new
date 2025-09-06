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
