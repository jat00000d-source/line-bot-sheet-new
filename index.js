// index.js - 主要程式檔案
const express = require('express');
const line = require('@line/bot-sdk');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// LINE Bot 設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

// Google Sheets 設定
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// 建立 Google Spreadsheet 連接
async function getGoogleSheet() {
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID, serviceAccountAuth);
  await doc.loadInfo();
  return doc;
}

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

// 處理訊息事件
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const messageText = event.message.text.trim();

  try {
    if (messageText === '總結' || messageText === '本月總結') {
      // 處理總結請求
      const summary = await getMonthlyExpenseSummary();
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: summary
      });
    } else if (isExpenseRecord(messageText)) {
      // 處理記帳輸入
      const result = await addExpenseRecord(messageText);
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: result
      });
    } else if (messageText === '說明' || messageText === '幫助') {
      // 顯示使用說明
      const helpText = getHelpMessage();
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: helpText
      });
    } else {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '請輸入正確格式的記帳資料或輸入「說明」查看使用方法'
      });
    }
  } catch (error) {
    console.error('處理訊息時發生錯誤:', error);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '系統發生錯誤，請稍後再試'
    });
  }
}

// 檢查是否為記帳格式
function isExpenseRecord(text) {
  const parts = text.split(' ');
  return parts.length >= 2 && !isNaN(parseFloat(parts[1]));
}

// 添加記帳記錄
async function addExpenseRecord(messageText) {
  try {
    const parts = messageText.split(' ');
    const item = parts[0];
    const amount = parseFloat(parts[1]);
    const note = parts.slice(2).join(' ') || '';

    if (isNaN(amount)) {
      return '金額格式錯誤，請輸入有效數字';
    }

    const doc = await getGoogleSheet();
    const now = new Date();
    const sheetName = formatDate(now, 'YYYY-MM');
    
    // 取得或建立當月工作表
    let sheet = doc.sheetsByTitle[sheetName];
    if (!sheet) {
      sheet = await createNewMonthSheet(doc, sheetName);
    }

    // 加入記帳資料
    const today = formatDate(now, 'MM/DD');
    await sheet.addRow({
      '日期': today,
      '項目': item,
      '金額': amount,
      '備註': note
    });

    return `✅ 記帳成功！\n日期：${today}\n項目：${item}\n金額：${amount.toLocaleString('zh-TW')}\n備註：${note}`;

  } catch (error) {
    console.error('添加記帳記錄時發生錯誤:', error);
    return '記帳失敗，請稍後再試或檢查格式是否正確';
  }
}

// 建立新的月份工作表
async function createNewMonthSheet(doc, sheetName) {
  const sheet = await doc.addSheet({
    title: sheetName,
    headerValues: ['日期', '項目', '金額', '備註']
  });

  // 格式化工作表
  await sheet.loadCells('A1:D1');
  
  // 設定標題列格式
  for (let i = 0; i < 4; i++) {
    const cell = sheet.getCell(0, i);
    cell.textFormat = { bold: true };
    cell.backgroundColor = { red: 0.91, green: 0.94, blue: 0.996 };
    cell.horizontalAlignment = 'CENTER';
  }

  await sheet.saveUpdatedCells();

  // 設定欄位寬度
  await sheet.resize({ columnCount: 4 });
  
  return sheet;
}

// 取得月度支出總結
async function getMonthlyExpenseSummary() {
  try {
    const doc = await getGoogleSheet();
    const now = new Date();
    const sheetName = formatDate(now, 'YYYY-MM');

    const sheet = doc.sheetsByTitle[sheetName];
    if (!sheet) {
      return `本月（${sheetName}）尚未有任何記帳記錄`;
    }

    const rows = await sheet.getRows();
    if (rows.length === 0) {
      return `本月（${sheetName}）尚未有任何記帳記錄`;
    }

    // 計算總支出
    let totalExpense = 0;
    let recordCount = 0;

    rows.forEach(row => {
      const amount = parseFloat(row.get('金額'));
      if (!isNaN(amount)) {
        totalExpense += amount;
        recordCount++;
      }
    });

    const currentDay = now.getDate();
    const avgDaily = recordCount > 0 ? Math.round(totalExpense / currentDay) : 0;

    return `📊 ${sheetName} 支出總結\n` +
           `💰 總支出：${totalExpense.toLocaleString('zh-TW')} 元\n` +
           `📝 記錄筆數：${recordCount} 筆\n` +
           `📅 平均每日：${avgDaily.toLocaleString('zh-TW')} 元`;

  } catch (error) {
    console.error('取得月總結時發生錯誤:', error);
    return '取得總結時發生錯誤，請稍後再試';
  }
}

// 格式化日期
function formatDate(date, format) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  switch (format) {
    case 'YYYY-MM':
      return `${year}-${month}`;
    case 'MM/DD':
      return `${month}/${day}`;
    default:
      return date.toISOString();
  }
}

// 取得使用說明
function getHelpMessage() {
  return `📝 記帳機器人使用說明\n\n` +
         `💡 記帳格式：\n` +
         `項目 金額 [備註]\n\n` +
         `📌 範例：\n` +
         `• 午餐 150\n` +
         `• 咖啡 85 星巴克\n` +
         `• 交通 50 捷運\n\n` +
         `📊 查看總結：\n` +
         `輸入「總結」查看本月支出\n\n` +
         `✨ 特色功能：\n` +
         `• 自動按月份分工作表\n` +
         `• 自動加入日期和標題\n` +
         `• 即時回饋記帳結果\n` +
         `• 月度支出統計分析`;
}

// 健康檢查路由
app.get('/', (req, res) => {
  res.json({
    status: 'LINE記帳機器人運行中',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 啟動伺服器
app.listen(port, () => {
  console.log(`LINE記帳機器人服務器運行在埠口 ${port}`);
});
