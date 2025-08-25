// index.js - 主要程式檔案（重構版）
const express = require('express');
const line = require('@line/bot-sdk');
require('dotenv').config();

// 導入服務模組
const ExpenseService = require('./services/expenseService');
const TodoService = require('./services/todoService');
const { detectLanguage, parseCommand } = require('./utils/commandParser');

const app = express();
const port = process.env.PORT || 3000;

// LINE Bot 設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

// 初始化服務
const expenseService = new ExpenseService();
const todoService = new TodoService();

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

// 處理訊息事件 - 主要路由分發器
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const messageText = event.message.text.trim();

  try {
    // 使用統一的指令解析器
    const parsed = parseCommand(messageText);
    
    if (!parsed.success) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: parsed.error
      });
    }

    const { commandType, language, category } = parsed;
    
    // 根據指令類型分發到不同的服務
    let response;
    
    if (category === 'expense') {
      // 記帳相關指令
      response = await handleExpenseCommand(parsed);
    } else if (category === 'todo') {
      // 代辦相關指令
      response = await handleTodoCommand(parsed);
    } else {
      // 未知指令
      const errorMsg = language === 'ja' ? 
        '未対応のコマンドです' : 
        '不支援的指令';
      response = { type: 'text', text: errorMsg };
    }

    return client.replyMessage(event.replyToken, response);
    
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

// 處理記帳相關指令
async function handleExpenseCommand(parsed) {
  const { commandType, language } = parsed;
  
  switch (commandType) {
    case 'summary':
      const summary = await expenseService.getMonthlyExpenseSummary(language);
      return { type: 'text', text: summary };
      
    case 'expense':
      const result = await expenseService.addExpenseRecordFromParsed(parsed.parsedData, language);
      return { type: 'text', text: result };
      
    case 'set_budget':
      const budgetResult = await expenseService.setBudget(parsed.originalMessage, language);
      return { type: 'text', text: budgetResult };
      
    case 'budget':
    case 'remaining':
      const budgetInfo = await expenseService.getBudgetInfo(language);
      return { type: 'text', text: budgetInfo };
      
    case 'help':
      const helpText = expenseService.getHelpMessage(language);
      return { type: 'text', text: helpText };
      
    default:
      const errorMsg = language === 'ja' ? 
        '未対応の記帳コマンドです' : 
        '不支援的記帳指令';
      return { type: 'text', text: errorMsg };
  }
}

// 處理代辦相關指令
async function handleTodoCommand(parsed) {
  const { commandType, language } = parsed;
  
  switch (commandType) {
    case 'add_todo':
      const addResult = await todoService.addTodo(parsed.parsedData, language);
      return addResult;
      
    case 'list_todos':
      const listResult = await todoService.listTodos(language);
      return listResult;
      
    case 'complete_todo':
      const completeResult = await todoService.completeTodo(parsed.parsedData, language);
      return completeResult;
      
    case 'delete_todo':
      const deleteResult = await todoService.deleteTodo(parsed.parsedData, language);
      return deleteResult;
      
    case 'add_reminder':
      const reminderResult = await todoService.addReminder(parsed.parsedData, language);
      return reminderResult;
      
    case 'list_reminders':
      const remindersResult = await todoService.listReminders(language);
      return remindersResult;
      
    case 'delete_reminder':
      const deleteReminderResult = await todoService.deleteReminder(parsed.parsedData, language);
      return deleteReminderResult;
      
    case 'todo_help':
      const helpText = todoService.getHelpMessage(language);
      return { type: 'text', text: helpText };
      
    default:
      const errorMsg = language === 'ja' ? 
        '未対応の代辫コマンドです' : 
        '不支援的代辦指令';
      return { type: 'text', text: errorMsg };
  }
}

// 健康檢查路由
app.get('/', (req, res) => {
  res.json({
    status: 'LINE記帳機器人運行中（模組化版本）',
    timestamp: new Date().toISOString(),
    version: '5.0.0',
    modules: {
      expense: {
        features: [
          '月度預算設定',
          '剩餘金額計算',
          '預算使用率監控',
          '每日可用金額',
          '預算警告提醒',
          '全形空格支援',
          '自然語言處理',
          '智能日期識別',
          '中日雙語支援'
        ]
      },
      todo: {
        features: [
          '代辦事項管理',
          '提醒功能',
          '一次性提醒',
          '重複性提醒',
          '位置提醒',
          '自然語言日期解析',
          '中日雙語支援',
          'Flex Message顯示'
        ]
      }
    }
  });
});

// 啟動伺服器
app.listen(port, () => {
  console.log(`LINE記帳機器人服務器運行在埠口 ${port}`);
  console.log('模組化架構：');
  console.log('- 記帳功能（ExpenseService）');
  console.log('- 代辦提醒功能（TodoService）');
  console.log('- 統一指令解析（CommandParser）');
  console.log('- 清晰的路由分發');
});
