// 逐步添加功能的 index.js
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

// 嘗試導入代辦功能模組（如果存在的話）
let todoController = null;
try {
  todoController = require('./controllers/todoController');
  console.log('✅ todoController 載入成功');
} catch (error) {
  console.log('⚠️ todoController 載入失敗:', error.message);
}

let todoMessages = null;
try {
  todoMessages = require('./constants/todoMessages');
  console.log('✅ todoMessages 載入成功');
} catch (error) {
  console.log('⚠️ todoMessages 載入失敗:', error.message);
}

// 基本路由
app.get('/', (req, res) => {
  res.send('LINE Bot 運作中！代辦功能開發中...');
});

// Webhook 路由
app.post('/webhook', line.middleware(config), (req, res) => {
  console.log('=== 收到 Webhook 請求 ===');
  console.log('請求時間:', new Date().toISOString());
  
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => {
      console.log('處理完成');
      res.json(result);
    })
    .catch((err) => {
      console.error('處理錯誤:', err);
      res.status(500).end();
    });
});

// 事件處理函數
async function handleEvent(event) {
  if (event.type !== 'message' || event.message?.type !== 'text') {
    return Promise.resolve(null);
  }

  const userMessage = event.message.text.trim();
  console.log('用戶訊息:', userMessage);

  try {
    let replyMessage = '';

    // 測試指令
    if (userMessage === '測試' || userMessage === 'test') {
      replyMessage = '✅ LINE Bot 運作正常！\n代辦功能狀態:\n';
      replyMessage += todoController ? '✅ todoController 已載入\n' : '❌ todoController 未載入\n';
      replyMessage += todoMessages ? '✅ todoMessages 已載入' : '❌ todoMessages 未載入';
    }
    // 系統狀態檢查
    else if (userMessage === '狀態' || userMessage === 'status') {
      replyMessage = `🔧 系統狀態檢查：
📁 檔案狀態:
- todoController: ${todoController ? '✅ 已載入' : '❌ 未載入'}
- todoMessages: ${todoMessages ? '✅ 已載入' : '❌ 未載入'}

🕒 伺服器時間: ${new Date().toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}`;
    }
    // 代辦功能 - 如果模組存在就使用，否則顯示錯誤訊息
    else if (isTodoCommand(userMessage)) {
      console.log('識別為代辦指令');
      
      if (todoController) {
        try {
          console.log('使用 todoController 處理');
          return await todoController.handleCommand(event, userMessage);
        } catch (error) {
          console.error('todoController 處理錯誤:', error);
          replyMessage = `❌ 代辦功能處理失敗：${error.message}`;
        }
      } else {
        replyMessage = `❌ 代辦功能尚未完整載入
缺少檔案：controllers/todoController.js
請確認所有必要檔案都已部署`;
      }
    }
    // 記帳功能（保持簡化版本）
    else if (isAccountingCommand(userMessage)) {
      replyMessage = `💰 記帳功能識別成功
輸入內容：${userMessage}
注意：完整記帳功能需要整合`;
    }
    // 幫助指令
    else if (userMessage === 'help' || userMessage === '幫助') {
      replyMessage = `📋 可用指令：

🔧 系統指令：
• 測試 - 測試連接狀態
• 狀態 - 檢查系統狀態  
• help - 顯示幫助

📝 代辦指令：
• 新增 [內容] - 新增代辦事項
• 查看代辦 - 查看所有代辦
• 完成 [編號] - 完成代辦事項
• 刪除 [編號] - 刪除代辦事項

💰 記帳指令：
• 收入 [金額] [項目] - 記錄收入
• 支出 [金額] [項目] - 記錄支出`;
    }
    // 預設回應
    else {
      replyMessage = `❓ 未識別的指令：${userMessage}

請輸入 "help" 查看可用指令
或輸入 "狀態" 檢查系統狀態`;
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
      text: `⚠️ 系統錯誤：${error.message}`
    });
  }
}

// 代辦指令檢測函數
function isTodoCommand(message) {
  const todoKeywords = [
    // 中文關鍵字
    '新增', '代辦', '提醒', '查看', '完成', '刪除', 
    '待辦', 'todo', '任務', '事項',
    // 日文關鍵字  
    'タスク', '追加', '確認', '完了', '削除'
  ];
  
  const isMatch = todoKeywords.some(keyword => message.includes(keyword));
  console.log('代辦關鍵字檢測:', message, '結果:', isMatch);
  return isMatch;
}

// 記帳指令檢測函數
function isAccountingCommand(message) {
  const accountingKeywords = ['收入', '支出', '花費', '賺', '買', '花', '付'];
  
  const isMatch = accountingKeywords.some(keyword => message.includes(keyword));
  console.log('記帳關鍵字檢測:', message, '結果:', isMatch);
  return isMatch;
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
  
  // 模組載入狀態
  console.log('=== 模組載入狀態 ===');
  console.log('todoController:', todoController ? '✅ 已載入' : '❌ 未載入');
  console.log('todoMessages:', todoMessages ? '✅ 已載入' : '❌ 未載入');
});

// 全域錯誤處理
process.on('uncaughtException', (err) => {
  console.error('未捕獲的異常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未處理的 Promise 拒絕:', reason);
});
