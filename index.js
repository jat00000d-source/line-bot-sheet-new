// 在你現有的 index.js 中添加這些導入
const reminderScheduler = require('./services/reminderScheduler');
const notificationService = require('./services/notificationService');
const todoController = require('./controllers/todoController');

// 在應用程式啟動時啟動排程器
const express = require('express');
const app = express();

// 現有的中間件設定...
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 啟動提醒排程器
reminderScheduler.start();

// 現有的 LINE webhook 處理
app.post('/webhook', line.middleware(config), async (req, res) => {
    try {
        const events = req.body.events;
        
        for (const event of events) {
            if (event.type === 'message' && event.message.type === 'text') {
                const userMessage = event.message.text;
                const userId = event.source.userId;
                
                // 檢查是否為代辦相關指令
                if (userMessage.includes('提醒') || userMessage.includes('代辦') || 
                    userMessage.includes('reminder') || userMessage.includes('todo')) {
                    
                    // 使用 todoController 處理
                    const response = await todoController.handleMessage(userId, userMessage);
                    
                    if (response) {
                        await client.replyMessage(event.replyToken, response);
                        continue;
                    }
                }
                
                // 現有的記帳邏輯...
                // 你的現有程式碼保持不變
            }
            
            // 處理 postback 事件（提醒按鈕回調）
            if (event.type === 'postback') {
                const data = event.postback.data;
                const userId = event.source.userId;
                
                if (data.startsWith('action=')) {
                    const params = new URLSearchParams(data);
                    const action = params.get('action');
                    const reminderId = params.get('id');
                    
                    const response = await notificationService.handleReminderAction(
                        userId, action, reminderId
                    );
                    
                    if (response) {
                        await client.replyMessage(event.replyToken, response);
                    }
                }
            }
        }
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook 處理錯誤:', error);
        res.status(500).send('Error');
    }
});

// 健康檢查端點（可選）
app.get('/health', (req, res) => {
    const schedulerStatus = reminderScheduler.getStatus();
    res.json({
        status: 'ok',
        scheduler: schedulerStatus,
        timestamp: new Date().toISOString()
    });
});

// 手動觸發提醒檢查（開發用）
app.post('/trigger-reminders', async (req, res) => {
    try {
        await reminderScheduler.manualCheck();
        res.json({ success: true, message: '手動檢查已觸發' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 應用程式關閉時優雅停止排程器
process.on('SIGINT', () => {
    console.log('收到停止信號，正在關閉...');
    reminderScheduler.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('收到終止信號，正在關閉...');
    reminderScheduler.stop();
    process.exit(0);
});

// 現有的 PORT 設定和 app.listen...
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`伺服器運行在 port ${PORT}`);
    console.log('提醒系統已啟動');
});
