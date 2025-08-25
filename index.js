const express = require('express');
const { middleware } = require('@line/bot-sdk');

const app = express();

// LINE Bot 配置
const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET,
};

// 中間件設定
app.use('/webhook', middleware(config));

// 健康檢查端點（重要！）
app.get('/', (req, res) => {
    res.status(200).json({ 
        status: 'LINE Bot is running!', 
        timestamp: new Date().toISOString() 
    });
});

// 健康檢查端點
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'LINE Bot Accounting' });
});

// LINE Webhook 處理
app.post('/webhook', (req, res) => {
    try {
        const events = req.body.events;
        
        if (!events) {
            console.log('No events received');
            return res.status(200).send('OK');
        }

        // 處理每個事件
        events.forEach(event => {
            console.log('Received event:', event);
            
            if (event.type === 'message' && event.message.type === 'text') {
                handleTextMessage(event);
            }
        });

        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 處理文字訊息（你原有的記帳邏輯）
function handleTextMessage(event) {
    const userMessage = event.message.text;
    const userId = event.source.userId;
    
    console.log(`User ${userId} sent: ${userMessage}`);
    
    // 這裡放你原有的記帳處理邏輯
    // TODO: 處理記帳指令
    
    // 暫時回應（確保 bot 有回應）
    replyToUser(event.replyToken, '收到您的訊息：' + userMessage);
}

// 回覆訊息函數
function replyToUser(replyToken, message) {
    // 這裡放你原有的 LINE API 回覆邏輯
    console.log(`Reply to ${replyToken}: ${message}`);
    // TODO: 實際的 LINE API 呼叫
}

// **關鍵修復：正確的 PORT 設定**
const PORT = process.env.PORT || 10000;  // Render 預設使用 10000

// **重要：綁定到 0.0.0.0，不是 localhost**
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 LINE Bot Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Server started at: ${new Date().toISOString()}`);
});

// 優雅關閉處理
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// 未處理的錯誤捕獲
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});
