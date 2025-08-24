// index.js (重構版 - 整合待辦功能)
const express = require('express');
const line = require('@line/bot-sdk');
const config = require('./config/config');
const ExpenseController = require('./controllers/expenseController');
const TodoController = require('./controllers/todoController');
const LanguageDetector = require('./utils/languageDetector');
const { parseCommand } = require('./utils/commandParser');
const app = express();

// 初始化 LINE Bot
const client = new line.Client(config.line);

// 控制器實例
const expenseController = new ExpenseController();
const todoController = new TodoController();

// LINE Webhook 處理
app.post('/webhook', line.middleware(config.line), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(result => res.json(result))
    .catch(err => {
      console.error('處理事件時發生錯誤:', err);
      res.status(500).end();
    });
});

/**
 * 處理訊息事件
 * @param {Object} event - LINE 事件物件
 * @returns {Promise} 處理結果
 */
async function handleEvent(event) {
  // 只處理文字訊息
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const messageText = event.message.text.trim();
  const language = LanguageDetector.detectLanguage(messageText);
  const userId = event.source.userId;
  
  try {
    // 解析指令
    const parsed = parseCommand(messageText);
    
    if (!parsed.success) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: parsed.error
      });
    }
    
    let response;
    const { commandType } = parsed;
    
    // 路由到對應的控制器
    if (isExpenseCommand(commandType)) {
      response = await expenseController.handleExpense(parsed);
    } else if (commandType === 'expense_help') {
      response = expenseController.getHelpMessage(language);
    } else if (isTodoCommand(commandType)) {
      // 待辦功能路由
      response = await todoController.handleTodo({
        ...parsed,
        userId,
        language
      });
    } else if (commandType === 'todo_help') {
      response = todoController.getHelpMessage(language);
    } else {
      response = language === 'ja' ? 
        '未対応のコマンドです' : 
        '不支援的指令';
    }
    
    // 處理 Flex Message 回應
    if (typeof response === 'object' && response.type) {
      return client.replyMessage(event.replyToken, response);
    } else {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: response
      });
    }
  } catch (error) {
    console.error('處理訊息時發生錯誤:', error);
    const errorMsg = language === 'ja' ? 
      'システムエラーが発生しました。しばらく後にもう一度お試しください' : 
      '系統發生錯誤，請稍後再試';
    
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: errorMsg
    });
  }
}

/**
 * 檢查是否為記帳相關指令
 * @param {string} commandType - 指令類型
 * @returns {boolean} 是否為記帳指令
 */
function isExpenseCommand(commandType) {
  const expenseCommands = [
    'expense',
    'expense_summary', 
    'set_budget',
    'budget',
    'remaining'
  ];
  return expenseCommands.includes(commandType);
}

/**
 * 檢查是否為待辦相關指令
 * @param {string} commandType - 指令類型
 * @returns {boolean} 是否為待辦指令
 */
function isTodoCommand(commandType) {
  const todoCommands = [
    'todo_add',
    'todo_list',
    'todo_delete',
    'todo_complete',
    'reminder_add',
    'reminder_list',
    'reminder_delete'
  ];
  return todoCommands.includes(commandType);
}

// 健康檢查路由
app.get('/', (req, res) => {
  res.json({
    status: 'LINE記帳機器人運行中（模組化版本）',
    timestamp: new Date().toISOString(),
    version: '6.0.0',
    architecture: 'Modular',
    features: {
      expenseTracking: config.features.expenseTracking,
      reminderSystem: config.features.reminderSystem,
      todoSystem: true,
      debugMode: config.features.debugMode
    },
    modules: [
      'ExpenseController',
      'TodoController',
      'GoogleSheetService', 
      'TodoService',
      'ExpenseParser',
      'DateParser',
      'LanguageDetector',
      'DateHelper'
    ]
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Service is alive and modular with TODO system'
  });
});

// 啟動伺服器
app.listen(config.server.port, () => {
  console.log(`🚀 LINE記帳機器人服務器運行在埠口 ${config.server.port}`);
  console.log('🏗️  模組化架構已啟用：');
  console.log('  ✅ 記帳功能已模組化');
  console.log('  ✅ 待辦功能已模組化');
  console.log('  ✅ Google Sheets 服務獨立');
  console.log('  ✅ 待辦服務獨立');
  console.log('  ✅ 自然語言解析器獨立');
  console.log('  ✅ 日期解析器獨立');
  console.log('  ✅ 語言檢測器獨立'); 
  console.log('  ✅ 日期處理工具獨立');
  
  if (config.features.debugMode) {
    console.log('🐛 除錯模式已啟用');
  }
});

module.exports = app;
