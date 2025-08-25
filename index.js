// 在 index.js 最上方加入
console.log('🔍 環境變數檢查:');
console.log('CHANNEL_ACCESS_TOKEN:', process.env.CHANNEL_ACCESS_TOKEN ? '✅ 已設定' : '❌ 未設定');
console.log('CHANNEL_SECRET:', process.env.CHANNEL_SECRET ? '✅ 已設定' : '❌ 未設定');
// 載入所有必要模組
const express = require('express');
const line = require('@line/bot-sdk');
require('dotenv').config();

// 導入服務和控制器
const googleSheetsService = require('./services/googleSheetsService');
const reminderScheduler = require('./services/reminderScheduler');
const notificationService = require('./services/notificationService');
const todoController = require('./controllers/todoController');
const commandParser = require('./utils/commandParser');

// LINE Bot 設定
const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);

// Express 應用程式設定
const app = express();

// 中間件
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 初始化服務
async function initializeServices() {
    try {
        console.log('初始化服務...');
        
        // 初始化 Google Sheets 服務
        await googleSheetsService.initialize();
        console.log('✓ Google Sheets 服務已初始化');
        
        // 啟動提醒排程器
        reminderScheduler.start();
        console.log('✓ 提醒排程器已啟動');
        
        console.log('所有服務初始化完成！');
    } catch (error) {
        console.error('服務初始化失敗:', error);
        process.exit(1);
    }
}

// 主要 Webhook 處理器
app.post('/webhook', line.middleware(config), async (req, res) => {
    try {
        const events = req.body.events;
        
        for (const event of events) {
            await handleEvent(event);
        }
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook 處理錯誤:', error);
        res.status(500).send('Error');
    }
});

// 事件處理函數
async function handleEvent(event) {
    const userId = event.source.userId;
    
    try {
        switch (event.type) {
            case 'message':
                if (event.message.type === 'text') {
                    await handleTextMessage(event, userId);
                }
                break;
                
            case 'postback':
                await handlePostbackEvent(event, userId);
                break;
                
            default:
                console.log('未處理的事件類型:', event.type);
        }
    } catch (error) {
        console.error('處理事件時發生錯誤:', error);
        
        // 發送錯誤訊息給用戶
        const errorMessage = {
            type: 'text',
            text: '抱歉，處理您的訊息時發生錯誤，請稍後再試。'
        };
        
        await client.replyMessage(event.replyToken, errorMessage);
    }
}

// 處理文字訊息
async function handleTextMessage(event, userId) {
    const userMessage = event.message.text;
    console.log(`收到用戶 ${userId} 的訊息: ${userMessage}`);
    
    // 解析指令
    const parseResult = commandParser.parseCommand(userMessage);
    
    if (!parseResult) {
        // 如果無法解析指令，回傳幫助訊息
        const helpMessage = generateHelpMessage();
        await client.replyMessage(event.replyToken, helpMessage);
        return;
    }

    let response = null;

    // 根據指令類型處理
    switch (parseResult.type) {
        case 'todo':
            response = await todoController.handleMessage(userId, userMessage, parseResult);
            break;
            
        case 'accounting':
            response = await handleAccountingCommand(userId, userMessage, parseResult);
            break;
            
        case 'system':
            response = await handleSystemCommand(userId, parseResult);
            break;
            
        default:
            response = {
                type: 'text',
                text: '抱歉，我不太理解您的指令。請輸入「幫助」查看可用指令。'
            };
    }

    if (response) {
        await client.replyMessage(event.replyToken, response);
    }
}

// 處理記帳指令（保持你現有的邏輯）
async function handleAccountingCommand(userId, message, parseResult) {
    // 這裡放入你現有的記帳邏輯
    // 解析金額、類別、備註等資訊
    
    try {
        // 示例：簡單的記帳解析
        const amountMatch = message.match(/[￥$€£¥]?\s*(\d+(?:\.\d{1,2})?)/);
        const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
        
        // 分類識別
        const categories = {
            '早餐': 'food', '午餐': 'food', '晚餐': 'food',
            '交通': 'transport', '購物': 'shopping',
            '娛樂': 'entertainment', '醫療': 'medical'
        };
        
        let category = 'other';
        let item = message;
        
        for (const [keyword, cat] of Object.entries(categories)) {
            if (message.includes(keyword)) {
                category = cat;
                item = keyword;
                break;
            }
        }
        
        // 保存到 Google Sheets
        await googleSheetsService.addExpenseRecord({
            userId: userId,
            date: new Date().toISOString().split('T')[0],
            category: category,
            item: item,
            amount: amount,
            note: message
        });
        
        return {
            type: 'text',
            text: `✅ 記帳成功！\n📝 項目：${item}\n💰 金額：${amount}\n📁 分類：${category}`
        };
        
    } catch (error) {
        console.error('記帳處理失敗:', error);
        return {
            type: 'text',
            text: '❌ 記帳失敗，請檢查格式後重試。'
        };
    }
}

// 處理系統指令
async function handleSystemCommand(userId, parseResult) {
    switch (parseResult.action) {
        case 'help':
            return generateHelpMessage();
            
        case 'status':
            return await generateStatusReport(userId);
            
        case 'settings':
            return generateSettingsMessage();
            
        default:
            return {
                type: 'text',
                text: '未知的系統指令。'
            };
    }
}

// 處理回調事件（提醒按鈕等）
async function handlePostbackEvent(event, userId) {
    const data = event.postback.data;
    console.log(`收到 postback: ${data}`);
    
    if (data.startsWith('action=')) {
        const params = new URLSearchParams(data);
        const action = params.get('action');
        const itemId = params.get('id');
        
        let response = null;
        
        switch (action) {
            case 'complete_reminder':
            case 'snooze_reminder':
            case 'acknowledge_reminder':
                response = await notificationService.handleReminderAction(
                    userId, action, itemId
                );
                break;
                
            case 'complete_todo':
                response = await todoController.completeTodo(userId, itemId);
                break;
                
            default:
                response = {
                    type: 'text',
                    text: '未知的操作。'
                };
        }
        
        if (response) {
            await client.replyMessage(event.replyToken, response);
        }
    }
}

// 生成幫助訊息
function generateHelpMessage() {
    return {
        type: 'flex',
        altText: '使用說明',
        contents: {
            type: 'bubble',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '🤖 使用說明',
                        color: '#FFFFFF',
                        weight: 'bold',
                        size: 'lg'
                    }
                ]
            },
            body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                contents: [
                    {
                        type: 'text',
                        text: '📝 記帳功能',
                        weight: 'bold',
                        color: '#333333'
                    },
                    {
                        type: 'text',
                        text: '例：午餐 150',
                        size: 'sm',
                        color: '#666666'
                    },
                    {
                        type: 'separator',
                        margin: 'md'
                    },
                    {
                        type: 'text',
                        text: '⏰ 提醒功能',
                        weight: 'bold',
                        color: '#333333'
                    },
                    {
                        type: 'text',
                        text: '例：提醒我明天8點開會\n例：每天9點提醒吃藥',
                        size: 'sm',
                        color: '#666666',
                        wrap: true
                    },
                    {
                        type: 'separator',
                        margin: 'md'
                    },
                    {
                        type: 'text',
                        text: '📋 代辦功能',
                        weight: 'bold',
                        color: '#333333'
                    },
                    {
                        type: 'text',
                        text: '例：新增代辦 完成報告\n例：查看代辦',
                        size: 'sm',
                        color: '#666666',
                        wrap: true
                    }
                ]
            }
        }
    };
}

// 生成狀態報告
async function generateStatusReport(userId) {
    try {
        const schedulerStatus = reminderScheduler.getStatus();
        const userSettings = await googleSheetsService.getUserSettings(userId);
        const reminderStats = await googleSheetsService.getUserReminders(userId);
        const todoStats = await googleSheetsService.getUserTodos(userId);
        
        return {
            type: 'flex',
            altText: '系統狀態',
            contents: {
                type: 'bubble',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '📊 系統狀態',
                            color: '#FFFFFF',
                            weight: 'bold',
                            size: 'lg'
                        }
                    ]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'md',
                    contents: [
                        {
                            type: 'box',
                            layout: 'baseline',
                            contents: [
                                {
                                    type: 'text',
                                    text: '提醒排程器',
                                    flex: 2,
                                    size: 'sm'
                                },
                                {
                                    type: 'text',
                                    text: schedulerStatus.isRunning ? '✅ 運行中' : '❌ 已停止',
                                    flex: 3,
                                    size: 'sm'
                                }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'baseline',
                            contents: [
                                {
                                    type: 'text',
                                    text: '活躍提醒',
                                    flex: 2,
                                    size: 'sm'
                                },
                                {
                                    type: 'text',
                                    text: `${reminderStats.length} 個`,
                                    flex: 3,
                                    size: 'sm'
                                }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'baseline',
                            contents: [
                                {
                                    type: 'text',
                                    text: '待辦事項',
                                    flex: 2,
                                    size: 'sm'
                                },
                                {
                                    type: 'text',
                                    text: `${todoStats.length} 個`,
                                    flex: 3,
                                    size: 'sm'
                                }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'baseline',
                            contents: [
                                {
                                    type: 'text',
                                    text: '偏好語言',
                                    flex: 2,
                                    size: 'sm'
                                },
                                {
                                    type: 'text',
                                    text: userSettings.language === 'ja' ? '🇯🇵 日文' : '🇹🇼 中文',
                                    flex: 3,
                                    size: 'sm'
                                }
                            ]
                        }
                    ]
                }
            }
        };
        
    } catch (error) {
        console.error('生成狀態報告失敗:', error);
        return {
            type: 'text',
            text: '無法獲取系統狀態，請稍後再試。'
        };
    }
}

// 生成設定訊息
function generateSettingsMessage() {
    return {
        type: 'text',
        text: '⚙️ 設定功能開發中，敬請期待！'
    };
}

// 健康檢查端點
app.get('/health', (req, res) => {
    const schedulerStatus = reminderScheduler.getStatus();
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            scheduler: schedulerStatus,
            sheets: googleSheetsService.initialized || false
        }
    });
});

// 手動觸發提醒檢查（開發用）
app.post('/trigger-reminders', async (req, res) => {
    try {
        await reminderScheduler.manualCheck();
        res.json({ 
            success: true, 
            message: '手動檢查已觸發',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 獲取用戶統計（開發用）
app.get('/stats/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const reminders = await googleSheetsService.getUserReminders(userId);
        const todos = await googleSheetsService.getUserTodos(userId);
        
        res.json({
            userId,
            stats: {
                reminders: reminders.length,
                todos: todos.length,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 優雅關閉處理
process.on('SIGINT', async () => {
    console.log('\n收到停止信號，正在優雅關閉...');
    
    try {
        reminderScheduler.stop();
        console.log('✓ 提醒排程器已停止');
        
        // 這裡可以添加其他清理邏輯
        console.log('✓ 清理完成');
        
        process.exit(0);
    } catch (error) {
        console.error('關閉時發生錯誤:', error);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('收到終止信號，正在關閉...');
    reminderScheduler.stop();
    process.exit(0);
});

// 錯誤處理
process.on('unhandledRejection', (reason, promise) => {
    console.error('未處理的 Promise 拒絕:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('未捕獲的異常:', error);
    process.exit(1);
});

// 啟動應用程式
async function startApp() {
    const PORT = process.env.PORT || 3000;
    
    try {
        // 初始化所有服務
        await initializeServices();
        
        // 啟動 Express 服務器
        app.listen(PORT, () => {
            console.log('🚀 應用程式啟動成功！');
            console.log(`📡 服務器運行在 port ${PORT}`);
            console.log('⏰ 提醒系統已就緒');
            console.log('📊 記帳功能已就緒');
            console.log('📋 代辦功能已就緒');
        });
        
    } catch (error) {
        console.error('應用程式啟動失敗:', error);
        process.exit(1);
    }
}

// 啟動應用程式
startApp();
