// 整合版 index.js - 所有功能在一個檔案中
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

// ==================== 代辦事項儲存 ====================
let todos = [];
let nextId = 1;

// ==================== 代辦功能常數 ====================
const TODO_MESSAGES = {
  COMMANDS: {
    ADD: ['新增', '添加', '加入'],
    LIST: ['查看', '列表', '清單'],
    COMPLETE: ['完成', '完成了'],
    DELETE: ['刪除', '移除'],
    STATS: ['統計', '狀況', '狀態']
  },
  
  MESSAGES: {
    ADDED: '✅ 已新增代辦事項',
    COMPLETED: '🎉 已完成代辦事項',
    DELETED: '🗑️ 已刪除代辦事項',
    NOT_FOUND: '❌ 找不到指定的代辦事項',
    EMPTY_LIST: '📋 目前沒有代辦事項',
    ERROR: '❌ 處理代辦指令時發生錯誤'
  }
};

// ==================== 代辦功能類別 ====================
class TodoController {
  
  // 新增代辦事項
  async addTodo(event, message) {
    const content = message.replace(/^(新增|添加|加入)\s+/, '').trim();
    
    if (!content) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 請提供代辦事項內容\n格式：新增 買牛奶'
      });
    }
    
    const todo = {
      id: nextId++,
      content: content,
      completed: false,
      createdAt: new Date(),
      priority: 'normal'
    };
    
    todos.push(todo);
    
    console.log('新增代辦:', todo);
    
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `✅ 已新增代辦事項：
📝 ${content}
🆔 編號：${todo.id}
📅 ${todo.createdAt.toLocaleString('zh-TW')}`
    });
  }
  
  // 查看所有代辦事項
  async listTodos(event) {
    if (todos.length === 0) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '📋 目前沒有代辦事項\n\n使用 "新增 [內容]" 來新增代辦事項'
      });
    }
    
    const activeTodos = todos.filter(todo => !todo.completed);
    const completedTodos = todos.filter(todo => todo.completed);
    
    let message = '📋 代辦事項清單\n\n';
    
    if (activeTodos.length > 0) {
      message += '🔴 未完成：\n';
      activeTodos.forEach(todo => {
        message += `${todo.id}. ${todo.content}\n`;
        message += `   📅 ${todo.createdAt.toLocaleDateString('zh-TW')}\n\n`;
      });
    }
    
    if (completedTodos.length > 0) {
      message += '✅ 已完成：\n';
      completedTodos.forEach(todo => {
        message += `${todo.id}. ~~${todo.content}~~\n`;
      });
    }
    
    message += `\n📊 總計：${todos.length} 項`;
    message += `\n🔴 未完成：${activeTodos.length} 項`;
    message += `\n✅ 已完成：${completedTodos.length} 項`;
    
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: message
    });
  }
  
  // 完成代辦事項
  async completeTodo(event, message) {
    const idStr = message.replace(/^完成\s+/, '').trim();
    const id = parseInt(idStr);
    
    if (isNaN(id)) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 請提供正確的代辦編號\n格式：完成 1'
      });
    }
    
    const todo = todos.find(t => t.id === id);
    
    if (!todo) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `❌ 找不到編號 ${id} 的代辦事項`
      });
    }
    
    if (todo.completed) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `✅ 代辦事項 ${id} 已經完成了`
      });
    }
    
    todo.completed = true;
    todo.completedAt = new Date();
    
    console.log('完成代辦:', todo);
    
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `🎉 已完成代辦事項：
📝 ${todo.content}
🆔 編號：${todo.id}
✅ ${todo.completedAt.toLocaleString('zh-TW')}`
    });
  }
  
  // 刪除代辦事項
  async deleteTodo(event, message) {
    const idStr = message.replace(/^刪除\s+/, '').trim();
    const id = parseInt(idStr);
    
    if (isNaN(id)) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '❌ 請提供正確的代辦編號\n格式：刪除 1'
      });
    }
    
    const todoIndex = todos.findIndex(t => t.id === id);
    
    if (todoIndex === -1) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `❌ 找不到編號 ${id} 的代辦事項`
      });
    }
    
    const deletedTodo = todos.splice(todoIndex, 1)[0];
    
    console.log('刪除代辦:', deletedTodo);
    
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `🗑️ 已刪除代辦事項：
📝 ${deletedTodo.content}
🆔 編號：${deletedTodo.id}`
    });
  }
  
  // 代辦統計
  async getTodoStats(event) {
    const total = todos.length;
    const completed = todos.filter(t => t.completed).length;
    const pending = total - completed;
    
    const today = new Date();
    const todayCreated = todos.filter(t => {
      const created = new Date(t.createdAt);
      return created.toDateString() === today.toDateString();
    }).length;
    
    const todayCompleted = todos.filter(t => {
      if (!t.completedAt) return false;
      const completed = new Date(t.completedAt);
      return completed.toDateString() === today.toDateString();
    }).length;
    
    const message = `📊 代辦事項統計
    
🔢 總計：${total} 項
🔴 未完成：${pending} 項  
✅ 已完成：${completed} 項
📈 完成率：${total > 0 ? Math.round((completed/total)*100) : 0}%

📅 今日統計：
➕ 新增：${todayCreated} 項
✅ 完成：${todayCompleted} 項

💾 儲存狀態：記憶體儲存`;
    
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: message
    });
  }
  
  // 主要指令處理函數
  async handleCommand(event, message) {
    console.log('處理代辦指令:', message);
    
    const userMessage = message.trim();
    
    try {
      // 新增代辦
      if (userMessage.startsWith('新增 ') || userMessage.startsWith('添加 ')) {
        return await this.addTodo(event, userMessage);
      }
      
      // 查看代辦
      else if (userMessage.includes('查看') && (userMessage.includes('代辦') || userMessage.includes('待辦'))) {
        return await this.listTodos(event);
      }
      
      // 完成代辦
      else if (userMessage.startsWith('完成 ')) {
        return await this.completeTodo(event, userMessage);
      }
      
      // 刪除代辦
      else if (userMessage.startsWith('刪除 ')) {
        return await this.deleteTodo(event, userMessage);
      }
      
      // 代辦統計
      else if (userMessage.includes('統計') || userMessage.includes('狀況')) {
        return await this.getTodoStats(event);
      }
      
      // 代辦幫助
      else {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: `📋 代辦功能說明

🔧 基本指令：
• 新增 [內容] - 新增代辦事項
• 查看代辦 - 查看所有代辦事項  
• 完成 [編號] - 完成指定代辦
• 刪除 [編號] - 刪除指定代辦
• 代辦統計 - 查看統計資訊

💡 使用範例：
• 新增 買牛奶
• 查看代辦
• 完成 1
• 刪除 2`
        });
      }
      
    } catch (error) {
      console.error('TodoController 錯誤:', error);
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `❌ 處理代辦指令時發生錯誤：${error.message}`
      });
    }
  }
}

// 創建代辦控制器實例
const todoController = new TodoController();

// ==================== 主要路由和處理函數 ====================

// 基本路由
app.get('/', (req, res) => {
  res.send(`LINE Bot 運作中！
  
🕒 伺服器時間: ${new Date().toLocaleString('zh-TW')}
📊 代辦事項: ${todos.length} 項
💾 系統狀態: 整合版運作中`);
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
      const stats = {
        total: todos.length,
        completed: todos.filter(t => t.completed).length,
        pending: todos.filter(t => !t.completed).length
      };
      
      replyMessage = `✅ LINE Bot 運作正常！

📊 代辦事項狀態：
• 總計：${stats.total} 項
• 未完成：${stats.pending} 項
• 已完成：${stats.completed} 項

💾 整合版本：所有功能已載入`;
    }
    
    // 系統狀態檢查
    else if (userMessage === '狀態' || userMessage === 'status') {
      replyMessage = `🔧 系統狀態檢查：

✅ 整合版本運作中
✅ 代辦功能已載入
✅ 記憶體儲存正常

📊 資料統計：
• 代辦事項：${todos.length} 項
• 下一個ID：${nextId}

🕒 伺服器時間：${new Date().toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}`;
    }
    
    // 代辦功能
    else if (isTodoCommand(userMessage)) {
      console.log('識別為代辦指令');
      return await todoController.handleCommand(event, userMessage);
    }
    
    // 記帳功能（保持簡化版本）
    else if (isAccountingCommand(userMessage)) {
      replyMessage = `💰 記帳功能識別成功
輸入內容：${userMessage}
（記帳功能整合開發中...）`;
    }
    
    // 幫助指令
    else if (userMessage === 'help' || userMessage === '幫助') {
      replyMessage = `📋 LINE Bot 功能說明

🔧 系統指令：
• 測試 - 測試連接狀態
• 狀態 - 檢查系統狀態  
• help - 顯示此幫助

📝 代辦指令：
• 新增 [內容] - 新增代辦事項
• 查看代辦 - 查看所有代辦
• 完成 [編號] - 完成代辦事項
• 刪除 [編號] - 刪除代辦事項
• 代辦統計 - 查看統計

💰 記帳指令：
• 收入 [金額] [項目] - 記錄收入
• 支出 [金額] [項目] - 記錄支出
（整合開發中...）`;
    }
    
    // 預設回應
    else {
      replyMessage = `❓ 未識別的指令：${userMessage}

請輸入 "help" 查看可用指令`;
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
    '新增', '代辦', '提醒', '查看', '完成', '刪除', 
    '待辦', 'todo', '任務', '事項', '統計'
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

// ==================== 伺服器啟動和錯誤處理 ====================

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
  console.log(`📡 伺服器運行在 Port: ${PORT}`);
  console.log(`🕒 啟動時間: ${new Date().toISOString()}`);
  console.log(`📋 整合版本: 代辦功能已載入`);
  console.log(`💾 儲存模式: 記憶體儲存`);
  
  // 環境變數檢查
  console.log('=== 環境變數檢查 ===');
  console.log('CHANNEL_ACCESS_TOKEN:', process.env.CHANNEL_ACCESS_TOKEN ? '✅ 已設定' : '❌ 未設定');
  console.log('CHANNEL_SECRET:', process.env.CHANNEL_SECRET ? '✅ 已設定' : '❌ 未設定');
});

// 全域錯誤處理
process.on('uncaughtException', (err) => {
  console.error('未捕獲的異常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未處理的 Promise 拒絕:', reason);
});
