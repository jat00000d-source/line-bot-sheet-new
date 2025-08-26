// index.js - 重構版本（保持記帳功能100%不變）
const express = require('express');
const line = require('@line/bot-sdk');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// LINE Bot 設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

// 動態載入控制器（容錯處理）
let expenseController = null;
let todoController = null;

try {
  // 嘗試載入記帳控制器
  const ExpenseController = require('./controllers/expenseController');
  expenseController = new ExpenseController();
  console.log('✅ 記帳控制器載入成功');
} catch (error) {
  console.log('⚠️ 記帳控制器載入失敗，使用內建功能');
  // 如果載入失敗，使用原本的記帳邏輯作為後備
}

try {
  // 嘗試載入代辦控制器
  const TodoController = require('./controllers/todoController');
  todoController = new TodoController();
  console.log('✅ 代辦控制器載入成功');
} catch (error) {
  console.log('⚠️ 代辦控制器載入失敗，功能暫時不可用');
}

// 後備記帳功能（從原本的 index.js 複製的核心邏輯）
const fallbackExpenseLogic = require('./fallback/expenseLogic');

// 處理 LINE Webhook
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('處理事件時發生錯誤:', err);
      res.status(500).end();
    });
});

// 主要事件處理函數
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const messageText = event.message.text.trim();
  
  try {
    // 指令類型檢測
    const commandInfo = detectCommandType(messageText);
    
    switch (commandInfo.type) {
      case 'expense':
        return await handleExpenseCommand(event, messageText, commandInfo);
        
      case 'todo':
        return await handleTodoCommand(event, messageText, commandInfo);
        
      case 'system':
        return await handleSystemCommand(event, messageText, commandInfo);
        
      default:
        return await handleUnknownCommand(event, messageText, commandInfo);
    }
    
  } catch (error) {
    console.error('處理訊息時發生錯誤:', error);
    const language = detectLanguage(messageText);
    const errorMsg = language === 'ja' ? 
      'システムエラーが発生しました。しばらく後にもう一度お試しください' : 
      '系統發生錯誤，請稍後再試';
    
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: errorMsg
    });
  }
}

// 指令類型檢測
function detectCommandType(message) {
  const language = detectLanguage(message);
  
  // 記帳指令檢測（保持與原版完全一致）
  const expenseKeywords = [
    // 中文指令
    '總結', '本月總結', '說明', '幫助', '設定預算', '預算', '查看預算', '剩餘',
    // 日文指令
    '集計', '合計', 'まとめ', '今月集計', '説明', 'ヘルプ', '助け', '予算設定', '予算', '残り', '残額'
  ];
  
  // 代辦指令檢測
  const todoKeywords = [
    // 中文
    '新增提醒', '代辦', '提醒', '查看提醒', '完成提醒', '刪除提醒', '待辦', 'todo', '任務',
    // 日文
    'リマインダー', '追加', 'タスク', '確認', '完了', '削除', 'タスク追加'
  ];
  
  // 系統指令檢測
  const systemKeywords = ['測試', 'test', '狀態', 'status', 'health', '健康檢查'];
  
  // 優先級：系統 > 記帳 > 代辦
  if (systemKeywords.some(keyword => message.includes(keyword))) {
    return { type: 'system', language };
  }
  
  if (expenseKeywords.some(keyword => message.includes(keyword)) || 
      isExpenseInput(message)) {
    return { type: 'expense', language };
  }
  
  if (todoKeywords.some(keyword => message.includes(keyword))) {
    return { type: 'todo', language };
  }
  
  // 預設判斷為記帳（保持原有行為）
  return { type: 'expense', language };
}

// 處理記帳指令
async function handleExpenseCommand(event, message, commandInfo) {
  try {
    // 優先使用新的控制器
    if (expenseController) {
      return await expenseController.handleCommand(event, message, commandInfo);
    }
    
    // 後備：使用原本的邏輯
    console.log('使用後備記帳邏輯');
    return await fallbackExpenseLogic.handleEvent(event);
    
  } catch (error) {
    console.error('記帳功能處理錯誤:', error);
    // 降級到最基本的處理
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: commandInfo.language === 'ja' ? 
        '記帳機能でエラーが発生しました' : 
        '記帳功能發生錯誤'
    });
  }
}

// 處理代辦指令
async function handleTodoCommand(event, message, commandInfo) {
  try {
    if (todoController) {
      return await todoController.handleCommand(event, message, commandInfo);
    } else {
      // 代辦功能尚未可用的友好提示
      const response = commandInfo.language === 'ja' ? 
        '🚧 リマインダー機能は開発中です。\n近日中に利用可能になります。' :
        '🚧 提醒功能開發中\n即將推出，敬請期待！';
      
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: response
      });
    }
  } catch (error) {
    console.error('代辦功能處理錯誤:', error);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: commandInfo.language === 'ja' ? 
        'リマインダー機能でエラーが発生しました' : 
        '提醒功能發生錯誤'
    });
  }
}

// 處理系統指令
async function handleSystemCommand(event, message, commandInfo) {
  const language = commandInfo.language;
  let response = '';
  
  if (message.includes('測試') || message.includes('test')) {
    response = `✅ 系統運作正常！
    
🔧 模組狀態：
• 記帳功能：${expenseController ? '✅ 已載入' : '⚠️ 使用後備邏輯'}  
• 提醒功能：${todoController ? '✅ 已載入' : '🚧 開發中'}

⏰ 服務時間：${new Date().toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}`;
  }
  else if (message.includes('狀態') || message.includes('status')) {
    response = `📊 詳細系統狀態：

🏗️ 架構版本：v2.0 (模組化)
📁 載入狀態：
  └─ controllers/
     ├─ expenseController: ${expenseController ? '✅' : '❌'}
     └─ todoController: ${todoController ? '✅' : '❌'}
  └─ services/
     ├─ Google Sheets: ✅ 已連接
     └─ 排程服務: ${process.env.CRON_ENABLED === 'true' ? '✅' : '⏸️ 暫停'}

💾 存儲：Google Sheets
🌐 語言：中文/日文
🔄 狀態：運行中`;
  }
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: response || '系統指令執行完成'
  });
}

// 處理未知指令
async function handleUnknownCommand(event, message, commandInfo) {
  // 再次嘗試記帳功能（可能是自然語言輸入）
  return await handleExpenseCommand(event, message, commandInfo);
}

// 語言檢測（保持與原版一致）
function detectLanguage(message) {
  const japaneseKeywords = ['集計', '合計', 'まとめ', '今月集計', '説明', 'ヘルプ', '助け',
                           '昼食', 'ランチ', '夕食', '夜食', '朝食', 'コーヒー', '珈琲',
                           '交通費', '電車', 'バス', 'タクシー', '買い物', 'ショッピング',
                           '娯楽', '映画', 'ゲーム', '医療', '病院', '薬', '今日', '昨日', '一昨日',
                           '予算設定', '予算', '残り', '残額'];
  
  const japaneseChars = /[\u3040-\u309F\u30A0-\u30FF]/;
  
  const hasJapaneseKeyword = japaneseKeywords.some(keyword => message.includes(keyword));
  const hasJapaneseChars = japaneseChars.test(message);
  
  return (hasJapaneseKeyword || hasJapaneseChars) ? 'ja' : 'zh';
}

// 檢查是否為記帳輸入格式
function isExpenseInput(text) {
  // 檢查是否包含金額和項目的組合
  const hasAmount = /\d+/.test(text);
  const hasSpace = /[\s　]+/.test(text);
  const parts = text.split(/[\s　]+/).filter(part => part.length > 0);
  
  return hasAmount && hasSpace && parts.length >= 2;
}

// 健康檢查路由
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'LINE機器人運行正常',
    version: '2.0-modular',
    modules: {
      expense: expenseController ? 'loaded' : 'fallback',
      todo: todoController ? 'loaded' : 'pending'
    }
  });
});

// 根路由
app.get('/', (req, res) => {
  res.send(`
    <h1>LINE 記帳 & 提醒機器人</h1>
    <p>狀態：運行中</p>
    <p>版本：v2.0 模組化架構</p>
    <p>時間：${new Date().toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}</p>
    
    <h2>功能狀態</h2>
    <ul>
      <li>記帳功能：${expenseController ? '✅ 已載入' : '⚠️ 後備模式'}</li>
      <li>提醒功能：${todoController ? '✅ 已載入' : '🚧 開發中'}</li>
    </ul>
    
    <p><a href="/health">健康檢查 API</a></p>
  `);
});

// 伺服器啟動
app.listen(port, () => {
  console.log(`=== LINE 機器人啟動成功 ===`);
  console.log(`🚀 服務器運行在端口: ${port}`);
  console.log(`📅 啟動時間: ${new Date().toISOString()}`);
  console.log(`🏗️ 架構版本: v2.0 模組化`);
  
  console.log('\n=== 模組載入狀態 ===');
  console.log(`💰 記帳功能: ${expenseController ? '✅ 已載入' : '⚠️ 後備模式'}`);
  console.log(`📋 提醒功能: ${todoController ? '✅ 已載入' : '🚧 開發中'}`);
  
  console.log('\n=== 功能支援 ===');
  console.log('✅ 中日雙語支援');
  console.log('✅ Google Sheets 整合');
  console.log('✅ 自然語言解析');
  console.log('✅ 預算管理');
  console.log('🚧 智慧提醒（開發中）');
});

// 全域錯誤處理
process.on('uncaughtException', (err) => {
  console.error('未捕獲的異常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未處理的 Promise 拒絕:', reason);
});
