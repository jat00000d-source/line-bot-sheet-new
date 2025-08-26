require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');

const app = express();
const port = process.env.PORT || 3000;

// LINE Bot 配置
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);

console.log('🔍 啟動時環境變數檢查:');
console.log(`CHANNEL_ACCESS_TOKEN: ${process.env.CHANNEL_ACCESS_TOKEN ? '已設定 ✅' : '未設定 ❌'}`);
console.log(`CHANNEL_SECRET: ${process.env.CHANNEL_SECRET ? '已設定 ✅' : '未設定 ❌'}`);

// 基本中介軟體
app.use(express.json());

// 詳細的請求記錄
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n📝 [${timestamp}] ${req.method} ${req.path}`);
  console.log('📨 Headers:', JSON.stringify(req.headers, null, 2));
  if (req.body) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// 健康檢查端點
app.get('/health', (req, res) => {
  const response = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: port,
      CHANNEL_ACCESS_TOKEN: process.env.CHANNEL_ACCESS_TOKEN ? 'Configured' : 'Missing',
      CHANNEL_SECRET: process.env.CHANNEL_SECRET ? 'Configured' : 'Missing'
    }
  };
  
  console.log('🏥 健康檢查請求:', response);
  res.status(200).json(response);
});

// 根路由
app.get('/', (req, res) => {
  const response = {
    message: 'LINE Bot 測試伺服器',
    status: 'Running',
    timestamp: new Date().toISOString()
  };
  
  console.log('🏠 根路由請求:', response);
  res.status(200).json(response);
});

// 測試端點 - 不需要 LINE 驗證
app.post('/test-webhook', (req, res) => {
  console.log('🧪 測試 Webhook 呼叫');
  console.log('📦 收到的資料:', JSON.stringify(req.body, null, 2));
  
  res.status(200).json({
    message: '測試 Webhook 成功',
    received: req.body,
    timestamp: new Date().toISOString()
  });
});

// LINE Webhook - 使用 try-catch 包裝所有操作
app.post('/webhook', (req, res) => {
  console.log('\n🎯 === LINE Webhook 開始處理 ===');
  
  try {
    // 檢查必要的環境變數
    if (!process.env.CHANNEL_ACCESS_TOKEN || !process.env.CHANNEL_SECRET) {
      console.error('❌ 缺少必要的環境變數');
      return res.status(500).json({
        error: 'Missing required environment variables'
      });
    }

    // 先不使用 line.middleware，直接處理請求
    console.log('📨 Webhook 請求內容:', JSON.stringify(req.body, null, 2));
    
    // 檢查請求格式
    if (!req.body || !req.body.events) {
      console.error('❌ 無效的請求格式');
      return res.status(400).json({
        error: 'Invalid request format'
      });
    }

    // 處理事件
    const events = req.body.events;
    console.log(`📊 收到 ${events.length} 個事件`);

    // 簡化處理 - 只處理文字訊息
    const promises = events.map(async (event) => {
      try {
        console.log('🔄 處理事件:', event.type);
        
        if (event.type !== 'message' || event.message?.type !== 'text') {
          console.log('⏭️ 跳過非文字訊息事件');
          return null;
        }

        const messageText = event.message.text;
        const userId = event.source.userId;
        
        console.log(`👤 用戶: ${userId}`);
        console.log(`💬 訊息: "${messageText}"`);

        // 簡單回應
        const replyMessage = {
          type: 'text',
          text: `✅ 收到您的訊息: "${messageText}"\n\n🕐 時間: ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`
        };

        console.log('📤 準備回應:', replyMessage);

        // 使用 LINE Client 回應
        const result = await client.replyMessage(event.replyToken, replyMessage);
        console.log('✅ 回應成功:', result);
        
        return result;
        
      } catch (eventError) {
        console.error('❌ 處理單一事件時發生錯誤:', eventError);
        console.error('錯誤詳情:', eventError.message);
        console.error('錯誤堆疊:', eventError.stack);
        
        // 即使單一事件失敗，也不要讓整個 webhook 失敗
        return null;
      }
    });

    // 等待所有事件處理完成
    Promise.all(promises)
      .then((results) => {
        console.log('✅ 所有事件處理完成:', results);
        res.status(200).json({
          message: 'Events processed successfully',
          results: results,
          timestamp: new Date().toISOString()
        });
      })
      .catch((error) => {
        console.error('❌ Promise.all 錯誤:', error);
        res.status(500).json({
          error: 'Error processing events',
          details: error.message
        });
      });

  } catch (error) {
    console.error('❌ Webhook 處理時發生嚴重錯誤:', error);
    console.error('錯誤訊息:', error.message);
    console.error('錯誤堆疊:', error.stack);
    
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
  
  console.log('🎯 === LINE Webhook 處理結束 ===\n');
});

// 錯誤處理中介軟體
app.use((error, req, res, next) => {
  console.error('🚨 應用程式錯誤:', error);
  res.status(500).json({
    error: 'Something went wrong!',
    message: error.message
  });
});

// 404 處理
app.use('*', (req, res) => {
  console.log(`❓ 404 - 找不到路由: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
    method: req.method
  });
});

// 啟動伺服器
app.listen(port, () => {
  console.log('\n🚀 =================================');
  console.log(`   LINE Bot 伺服器啟動成功`);
  console.log('🚀 =================================');
  console.log(`📍 Port: ${port}`);
  console.log(`🕐 啟動時間: ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`);
  console.log(`🔗 健康檢查: https://your-app.onrender.com/health`);
  console.log(`🔗 測試端點: https://your-app.onrender.com/test-webhook`);
  console.log(`🤖 LINE Webhook: https://your-app.onrender.com/webhook`);
  
  console.log('\n🔧 環境變數狀態:');
  console.log(`   CHANNEL_ACCESS_TOKEN: ${process.env.CHANNEL_ACCESS_TOKEN ? '✅ 已設定' : '❌ 未設定'}`);
  console.log(`   CHANNEL_SECRET: ${process.env.CHANNEL_SECRET ? '✅ 已設定' : '❌ 未設定'}`);
  
  if (!process.env.CHANNEL_ACCESS_TOKEN || !process.env.CHANNEL_SECRET) {
    console.log('\n⚠️  警告: 缺少必要的環境變數！');
    console.log('   請在 Render 設定環境變數:');
    console.log('   - CHANNEL_ACCESS_TOKEN');
    console.log('   - CHANNEL_SECRET');
  }
  
  console.log('\n✅ 伺服器準備就緒，等待請求...\n');
});

// 優雅關閉
process.on('SIGTERM', () => {
  console.log('👋 收到 SIGTERM，正在關閉伺服器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 收到 SIGINT，正在關閉伺服器...');
  process.exit(0);
});

module.exports = app;
