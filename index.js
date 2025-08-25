// 簡化版 index.js 用於測試 LINE Bot 連接
const line = require('@line/bot-sdk');
const express = require('express');

// LINE Bot 設定
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);
const app = express();
const PORT = process.env.PORT || 3000;

// 基本路由
app.get('/', (req, res) => {
  res.send('LINE Bot 運作中！');
});

// Webhook 路由 - 添加詳細日誌
app.post('/webhook', line.middleware(config), (req, res) => {
  console.log('=== 收到 Webhook 請求 ===');
  console.log('請求時間:', new Date().toISOString());
  console.log('請求內容:', JSON.stringify(req.body, null, 2));
  
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => {
      console.log('處理完成:', result);
      res.json(result);
    })
    .catch((err) => {
      console.error('處理錯誤:', err);
      res.status(500).end();
    });
});

// 簡化的事件處理函數
async function handleEvent(event) {
  console.log('=== 處理事件 ===');
  console.log('事件類型:', event.type);
  console.log('訊息類型:', event.message?.type);
  
  // 只處理文字訊息
  if (event.type !== 'message' || event.message?.type !== 'text') {
    console.log('非文字訊息，略過');
    return Promise.resolve(null);
  }

  const userMessage = event.message.text.trim();
  console.log('用戶訊息:', userMessage);

  try {
    let replyMessage = '';

    // 測試指令
    if (userMessage === '測試' || userMessage === 'test') {
      replyMessage = '✅ LINE Bot 運作正常！';
    }
    // 代辦功能關鍵字檢測
    else if (userMessage.includes('新增') || userMessage.includes('代辦') || userMessage.includes('提醒')) {
      replyMessage = '🔧 代辦功能開發中...\n你輸入了：' + userMessage;
    }
    // 記帳功能關鍵字檢測
    else if (userMessage.includes('收入') || userMessage.includes('支出') || userMessage.includes('花費')) {
      replyMessage = '💰 記帳功能識別成功\n你輸入了：' + userMessage;
    }
    // 幫助指令
    else if (userMessage === 'help' || userMessage === '幫助') {
      replyMessage = `📋 可用指令：
測試 - 測試 bot 連接
新增 xxx - 代辦功能 (開發中)
收入 100 午餐 - 記帳功能 (開發中)
help - 顯示此幫助`;
    }
    // 預設回應
    else {
      replyMessage = `❓ 未識別的指令：${userMessage}\n\n請輸入 "help" 查看可用指令`;
    }

    console.log('準備回覆:', replyMessage);

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: replyMessage
    });

  } catch (error) {
    console.error('處理訊息時發生錯誤:', error);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '⚠️ 系統發生錯誤，請稍後再試'
    });
  }
}

// 錯誤處理
app.use((err, req, res, next) => {
  console.error('應用程式錯誤:', err);
  if (err instanceof line.SignatureValidationFailed) {
    res.status(401).send(err.signature);
    return;
  }
  if (err instanceof line.JSONParseError) {
    res.status(400).send(err.raw);
    return;
  }
  next(err);
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`=== LINE Bot 啟動成功 ===`);
  console.log(`伺服器運行在 Port: ${PORT}`);
  console.log(`時間: ${new Date().toISOString()}`);
  console.log(`Webhook URL: /webhook`);
  
  // 檢查環境變數
  console.log('環境變數檢查:');
  console.log('CHANNEL_ACCESS_TOKEN:', process.env.CHANNEL_ACCESS_TOKEN ? '✅ 已設定' : '❌ 未設定');
  console.log('CHANNEL_SECRET:', process.env.CHANNEL_SECRET ? '✅ 已設定' : '❌ 未設定');
});

// 處理未捕獲的錯誤
process.on('uncaughtException', (err) => {
  console.error('未捕獲的異常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未處理的 Promise 拒絕:', reason);
});
