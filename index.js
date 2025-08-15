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

// === 新增：雙語指令支援 ===
const COMMAND_MAPPING = {
  // 中文指令
  '總結': 'summary',
  '本月總結': 'summary',
  '說明': 'help',
  '幫助': 'help',
  
  // 日文指令
  '集計': 'summary',
  '合計': 'summary', 
  'まとめ': 'summary',
  '今月集計': 'summary',
  '説明': 'help',
  'ヘルプ': 'help',
  '助け': 'help'
};

const CATEGORY_MAPPING = {
  // 中文項目保持原樣
  '午餐': '午餐',
  '晚餐': '晚餐',
  '早餐': '早餐',
  '咖啡': '咖啡',
  '交通': '交通',
  '購物': '購物',
  '娛樂': '娛樂',
  '醫療': '醫療',
  
  // 日文項目對應到中文（保持Google Sheets一致）
  '昼食': '午餐',
  'ランチ': '午餐',
  '夕食': '晚餐',
  '夜食': '晚餐',
  '朝食': '早餐',
  'コーヒー': '咖啡',
  '珈琲': '咖啡',
  '交通費': '交通',
  '電車': '交通',
  'バス': '交通',
  'タクシー': '交通',
  '買い物': '購物',
  'ショッピング': '購物',
  '娯楽': '娛樂',
  '映画': '娛樂',
  'ゲーム': '娛樂',
  '医療': '醫療',
  '病院': '醫療',
  '薬': '醫療'
};

// 語言檢測函數
function detectLanguage(message) {
  const japaneseKeywords = ['集計', '合計', 'まとめ', '今月集計', '説明', 'ヘルプ', '助け',
                           '昼食', 'ランチ', '夕食', '夜食', '朝食', 'コーヒー', '珈琲',
                           '交通費', '電車', 'バス', 'タクシー', '買い物', 'ショッピング',
                           '娯楽', '映画', 'ゲーム', '医療', '病院', '薬'];
  
  // 檢查日文平假名、片假名字符
  const japaneseChars = /[\u3040-\u309F\u30A0-\u30FF]/;
  
  const hasJapaneseKeyword = japaneseKeywords.some(keyword => message.includes(keyword));
  const hasJapaneseChars = japaneseChars.test(message);
  
  return (hasJapaneseKeyword || hasJapaneseChars) ? 'ja' : 'zh';
}

// 統一指令解析函數
function parseCommand(message) {
  const language = detectLanguage(message);
  
  // 檢查是否為特殊指令
  const commandType = COMMAND_MAPPING[message.trim()];
  if (commandType) {
    return {
      success: true,
      commandType,
      language,
      originalMessage: message
    };
  }
  
  // 檢查是否為記帳格式
  if (isExpenseRecord(message)) {
    return {
      success: true,
      commandType: 'expense',
      language,
      originalMessage: message
    };
  }
  
  // 無法識別的指令
  return {
    success: false,
    language,
    error: language === 'ja' ? 
      '正しい形式の記帳データを入力するか、「説明」で使用方法を確認してください' : 
      '請輸入正確格式的記帳資料或輸入「說明」查看使用方法'
  };
}

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

// 處理訊息事件（修改版）
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const messageText = event.message.text.trim();

  try {
    // 使用新的指令解析器
    const parsed = parseCommand(messageText);
    
    if (!parsed.success) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: parsed.error
      });
    }
    
    const { commandType, language } = parsed;
    
    switch (commandType) {
      case 'summary':
        const summary = await getMonthlyExpenseSummary(language);
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: summary
        });
        
      case 'expense':
        const result = await addExpenseRecord(messageText, language);
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: result
        });
        
      case 'help':
        const helpText = getHelpMessage(language);
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: helpText
        });
        
      default:
        const errorMsg = language === 'ja' ? 
          '未対応のコマンドです' : 
          '不支援的指令';
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: errorMsg
        });
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

// 檢查是否為記帳格式
function isExpenseRecord(text) {
  const parts = text.split(' ');
  return parts.length >= 2 && !isNaN(parseFloat(parts[1]));
}

// 添加記帳記錄（修改版，支援雙語+円）
async function addExpenseRecord(messageText, language = 'zh') {
  try {
    const parts = messageText.split(' ');
    let item = parts[0];
    const amount = parseFloat(parts[1]);
    const note = parts.slice(2).join(' ') || '';

    if (isNaN(amount)) {
      return language === 'ja' ? 
        '金額の形式が間違っています。有効な数字を入力してください' : 
        '金額格式錯誤，請輸入有效數字';
    }

    // 項目名稱統一處理（日文轉中文）
    item = CATEGORY_MAPPING[item] || item;

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

    // 雙語回應（使用円）
    if (language === 'ja') {
      return `✅ 記録完了！\n日付：${today}\n項目：${item}\n金額：${amount.toLocaleString('ja-JP')}円\n備考：${note}`;
    } else {
      return `✅ 記帳成功！\n日期：${today}\n項目：${item}\n金額：${amount.toLocaleString('zh-TW')}円\n備註：${note}`;
    }

  } catch (error) {
    console.error('添加記帳記錄時發生錯誤:', error);
    return language === 'ja' ? 
      '記録に失敗しました。しばらく後にもう一度お試しいただくか、形式を確認してください' : 
      '記帳失敗，請稍後再試或檢查格式是否正確';
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

// 取得月度支出總結（修改版，支援雙語+円）
async function getMonthlyExpenseSummary(language = 'zh') {
  try {
    const doc = await getGoogleSheet();
    const now = new Date();
    const sheetName = formatDate(now, 'YYYY-MM');

    const sheet = doc.sheetsByTitle[sheetName];
    if (!sheet) {
      return language === 'ja' ? 
        `今月（${sheetName}）はまだ記帳記録がありません` : 
        `本月（${sheetName}）尚未有任何記帳記錄`;
    }

    const rows = await sheet.getRows();
    if (rows.length === 0) {
      return language === 'ja' ? 
        `今月（${sheetName}）はまだ記帳記録がありません` : 
        `本月（${sheetName}）尚未有任何記帳記錄`;
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

    // 雙語回應（使用円）
    if (language === 'ja') {
      return `📊 ${sheetName} 支出まとめ\n` +
             `💰 総支出：${totalExpense.toLocaleString('ja-JP')}円\n` +
             `📝 記録数：${recordCount}件\n` +
             `📅 1日平均：${avgDaily.toLocaleString('ja-JP')}円`;
    } else {
      return `📊 ${sheetName} 支出總結\n` +
             `💰 總支出：${totalExpense.toLocaleString('zh-TW')}円\n` +
             `📝 記錄筆數：${recordCount} 筆\n` +
             `📅 平均每日：${avgDaily.toLocaleString('zh-TW')}円`;
    }

  } catch (error) {
    console.error('取得月總結時發生錯誤:', error);
    return language === 'ja' ? 
      'まとめ取得時にエラーが発生しました。しばらく後にもう一度お試しください' : 
      '取得總結時發生錯誤，請稍後再試';
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

// 取得使用說明（修改版，支援雙語+円）
function getHelpMessage(language = 'zh') {
  if (language === 'ja') {
    return `📝 記帳ボット使用説明\n\n` +
           `💡 記帳形式：\n` +
           `項目 金額 [備考]\n\n` +
           `📌 例：\n` +
           `• 昼食 150\n` +
           `• コーヒー 85 スターバックス\n` +
           `• 交通費 50 電車\n` +
           `• ランチ 200 定食\n\n` +
           `📊 まとめ確認：\n` +
           `「集計」で今月の支出を確認\n\n` +
           `✨ 特長：\n` +
           `• 月別ワークシート自動作成\n` +
           `• 自動で日付とタイトル追加\n` +
           `• リアルタイム記帳結果\n` +
           `• 月間支出統計分析\n` +
           `• 中国語・日本語対応`;
  } else {
    return `📝 記帳機器人使用說明\n\n` +
           `💡 記帳格式：\n` +
           `項目 金額 [備註]\n\n` +
           `📌 範例：\n` +
           `• 午餐 150\n` +
           `• 咖啡 85 星巴克\n` +
           `• 交通 50 捷運\n` +
           `• ランチ 200 定食（日文也可以）\n\n` +
           `📊 查看總結：\n` +
           `輸入「總結」查看本月支出\n\n` +
           `✨ 特色功能：\n` +
           `• 自動按月份分工作表\n` +
           `• 自動加入日期和標題\n` +
           `• 即時回饋記帳結果\n` +
           `• 月度支出統計分析\n` +
           `• 支援中日雙語指令`;
  }
}

// 健康檢查路由
app.get('/', (req, res) => {
  res.json({
    status: 'LINE記帳機器人運行中',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// 啟動伺服器
app.listen(port, () => {
  console.log(`LINE記帳機器人服務器運行在埠口 ${port}`);
});
