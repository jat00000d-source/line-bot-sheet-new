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

// === 新增：自然語言處理器 ===
class NaturalLanguageProcessor {
  constructor() {
    // 金額相關的關鍵詞
    this.amountKeywords = ['元', '円', '圓', '塊', '錢', '用了', '花了', '花費', '支出', '費用'];
    
    // 日期相關的關鍵詞
    this.dateKeywords = {
      '今天': 0,
      '昨天': -1,
      '前天': -2,
      '大前天': -3,
      '今日': 0,
      '昨日': -1,
      '一昨日': -2
    };
    
    // 常見動詞
    this.actionVerbs = ['吃', '買', '喝', '花', '用', '搭', '坐', '看', '玩'];
  }

  // 智能解析自然語言輸入
  parseNaturalLanguage(message, language) {
    try {
      console.log('原始輸入:', message);
      
      // 首先嘗試傳統格式解析（支援全形空格）
      const traditionalResult = this.parseTraditionalFormat(message);
      if (traditionalResult.success) {
        console.log('傳統格式解析成功:', traditionalResult);
        return traditionalResult;
      }
      
      // 自然語言解析
      const nlResult = this.parseNaturalText(message, language);
      console.log('自然語言解析結果:', nlResult);
      return nlResult;
      
    } catch (error) {
      console.error('解析錯誤:', error);
      return {
        success: false,
        error: language === 'ja' ? 
          '入力形式を認識できませんでした' : 
          '無法識別輸入格式'
      };
    }
  }

  // 解析傳統格式（支援全形和半形空格）
  parseTraditionalFormat(message) {
    // 同時支援全形空格（　）和半形空格（ ）
    const parts = message.split(/[\s　]+/).filter(part => part.length > 0);
    
    if (parts.length >= 2) {
      const firstPart = parts[0];
      const secondPart = parts[1];
      
      // 檢查第二部分是否為純數字
      const amount = this.extractAmount(secondPart);
      if (amount !== null) {
        return {
          success: true,
          item: firstPart,
          amount: amount,
          note: parts.slice(2).join(' ') || '',
          date: null // 使用今天日期
        };
      }
      
      // 檢查第一部分是否為純數字
      const amountFirst = this.extractAmount(firstPart);
      if (amountFirst !== null) {
        return {
          success: true,
          item: secondPart,
          amount: amountFirst,
          note: parts.slice(2).join(' ') || '',
          date: null
        };
      }
    }
    
    return { success: false };
  }

  // 解析自然語言文本
  parseNaturalText(message, language) {
    let item = null;
    let amount = null;
    let dateOffset = 0; // 相對今天的天數差
    let note = '';
    
    // 提取金額
    amount = this.extractAmountFromText(message);
    if (amount === null) {
      return {
        success: false,
        error: language === 'ja' ? 
          '金額が見つかりませんでした' : 
          '找不到金額'
      };
    }
    
    // 提取日期偏移
    dateOffset = this.extractDateOffset(message);
    
    // 提取項目
    item = this.extractItemFromText(message, language);
    if (!item) {
      return {
        success: false,
        error: language === 'ja' ? 
          '項目が見つかりませんでした' : 
          '找不到消費項目'
      };
    }
    
    // 提取備註（移除已識別的部分）
    note = this.extractNote(message, item, amount, dateOffset);
    
    return {
      success: true,
      item: item,
      amount: amount,
      note: note,
      dateOffset: dateOffset
    };
  }

  // 從文本中提取金額
  extractAmountFromText(text) {
    // 匹配各種金額格式
    const patterns = [
      /(\d+(?:\.\d+)?)\s*[元円圓塊錢]/g,  // 100元, 150円
      /[元円圓塊錢]\s*(\d+(?:\.\d+)?)/g,  // 元100, 円150
      /(?:花了?|用了?|費用|支出|花費)\s*(\d+(?:\.\d+)?)/g, // 花了100
      /(\d+(?:\.\d+)?)\s*(?:花了?|用了?)/g, // 100花了
      /(?:^|\s)(\d+(?:\.\d+)?)(?=\s|[^.\d]|$)/g  // 單純的數字
    ];
    
    for (let pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        const amount = parseFloat(matches[0][1]);
        if (!isNaN(amount) && amount > 0) {
          return amount;
        }
      }
    }
    
    return null;
  }

  // 從純數字字串提取金額
  extractAmount(str) {
    // 移除貨幣符號
    const cleaned = str.replace(/[元円圓塊錢]/g, '');
    const amount = parseFloat(cleaned);
    return (!isNaN(amount) && amount > 0) ? amount : null;
  }

  // 提取日期偏移
  extractDateOffset(text) {
    for (let [keyword, offset] of Object.entries(this.dateKeywords)) {
      if (text.includes(keyword)) {
        return offset;
      }
    }
    return 0; // 預設今天
  }

  // 從文本中提取項目
  extractItemFromText(message, language) {
    // 先檢查是否有明確的類別關鍵詞
    for (let [key, value] of Object.entries(CATEGORY_MAPPING)) {
      if (message.includes(key)) {
        return value;
      }
    }
    
    // 嘗試從上下文推斷
    const contextPatterns = {
      // 餐食相關
      '午餐': ['午餐', '中餐', '午飯', 'ランチ', '昼食', '昼飯'],
      '晚餐': ['晚餐', '晚飯', '夕食', '夜食', '夕飯', '晩御飯'],
      '早餐': ['早餐', '早飯', '朝食', '朝飯'],
      '咖啡': ['咖啡', 'コーヒー', '珈琲', '拿鐵', 'ラテ'],
      
      // 交通相關
      '交通': ['電車', '巴士', '公車', '計程車', 'タクシー', 'バス', '地鐵', '捷運'],
      
      // 購物相關
      '購物': ['買', '購買', 'ショッピング', '買い物'],
      
      // 娛樂相關
      '娛樂': ['電影', '遊戲', 'ゲーム', '映画', '唱歌', 'カラオケ']
    };
    
    for (let [category, keywords] of Object.entries(contextPatterns)) {
      for (let keyword of keywords) {
        if (message.includes(keyword)) {
          return category;
        }
      }
    }
    
    // 如果都找不到，嘗試提取第一個可能的名詞
    const words = message.replace(/[\d\s元円圓塊錢花了用了昨天今天前天]/g, '').trim();
    if (words.length > 0) {
      // 取前幾個字符作為項目名
      return words.substring(0, Math.min(words.length, 4));
    }
    
    return language === 'ja' ? 'その他' : '其他';
  }

  // 提取備註
  extractNote(originalText, item, amount, dateOffset) {
    let note = originalText;
    
    // 移除已識別的部分
    note = note.replace(new RegExp(item, 'g'), '');
    note = note.replace(/\d+(?:\.\d+)?[元円圓塊錢]?/g, '');
    note = note.replace(/[元円圓塊錢]/g, '');
    note = note.replace(/(?:花了?|用了?|費用|支出|花費)/g, '');
    note = note.replace(/(?:今天|昨天|前天|大前天|今日|昨日|一昨日)/g, '');
    note = note.replace(/(?:吃|買|喝|花|用|搭|坐|看|玩)/g, '');
    
    // 清理空格和標點
    note = note.replace(/[\s　，,。.！!？?]+/g, ' ').trim();
    
    return note || '';
  }
}

// 創建自然語言處理器實例
const nlp = new NaturalLanguageProcessor();

// 語言檢測函數
function detectLanguage(message) {
  const japaneseKeywords = ['集計', '合計', 'まとめ', '今月集計', '説明', 'ヘルプ', '助け',
                           '昼食', 'ランチ', '夕食', '夜食', '朝食', 'コーヒー', '珈琲',
                           '交通費', '電車', 'バス', 'タクシー', '買い物', 'ショッピング',
                           '娯楽', '映画', 'ゲーム', '医療', '病院', '薬', '今日', '昨日', '一昨日'];
  
  // 檢查日文平假名、片假名字符
  const japaneseChars = /[\u3040-\u309F\u30A0-\u30FF]/;
  
  const hasJapaneseKeyword = japaneseKeywords.some(keyword => message.includes(keyword));
  const hasJapaneseChars = japaneseChars.test(message);
  
  return (hasJapaneseKeyword || hasJapaneseChars) ? 'ja' : 'zh';
}

// 統一指令解析函數（修改版）
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
  
  // 使用自然語言處理器解析
  const nlResult = nlp.parseNaturalLanguage(message, language);
  if (nlResult.success) {
    return {
      success: true,
      commandType: 'expense',
      language,
      originalMessage: message,
      parsedData: nlResult
    };
  }
  
  // 無法識別的指令
  return {
    success: false,
    language,
    error: nlResult.error || (language === 'ja' ? 
      '正しい形式の記帳データを入力するか、「説明」で使用方法を確認してください' : 
      '請輸入正確格式的記帳資料或輸入「說明」查看使用方法')
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
        const result = await addExpenseRecordFromParsed(parsed.parsedData, language);
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

// 新的記帳函數（基於解析後的數據）
async function addExpenseRecordFromParsed(parsedData, language = 'zh') {
  try {
    let { item, amount, note, dateOffset } = parsedData;

    // 項目名稱統一處理（日文轉中文）
    item = CATEGORY_MAPPING[item] || item;

    const doc = await getGoogleSheet();
    
    // 計算實際日期
    const targetDate = new Date();
    if (dateOffset) {
      targetDate.setDate(targetDate.getDate() + dateOffset);
    }
    
    const sheetName = formatDate(targetDate, 'YYYY-MM');
    
    // 取得或建立當月工作表
    let sheet = doc.sheetsByTitle[sheetName];
    if (!sheet) {
      sheet = await createNewMonthSheet(doc, sheetName);
    }

    // 加入記帳資料
    const dateStr = formatDate(targetDate, 'MM/DD');
    await sheet.addRow({
      '日期': dateStr,
      '項目': item,
      '金額': amount,
      '備註': note
    });

    // 雙語回應（使用円）
    const dateLabel = dateOffset === 0 ? 
      (language === 'ja' ? '今日' : '今天') :
      (dateOffset === -1 ? 
        (language === 'ja' ? '昨日' : '昨天') : 
        `${Math.abs(dateOffset)}${language === 'ja' ? '日前' : '天前'}`);
    
    if (language === 'ja') {
      return `✅ 記録完了！\n日付：${dateStr}（${dateLabel}）\n項目：${item}\n金額：${amount.toLocaleString('ja-JP')}円\n備考：${note}`;
    } else {
      return `✅ 記帳成功！\n日期：${dateStr}（${dateLabel}）\n項目：${item}\n金額：${amount.toLocaleString('zh-TW')}円\n備註：${note}`;
    }

  } catch (error) {
    console.error('添加記帳記錄時發生錯誤:', error);
    return language === 'ja' ? 
      '記録に失敗しました。しばらく後にもう一度お試しいただくか、形式を確認してください' : 
      '記帳失敗，請稍後再試或檢查格式是否正確';
  }
}

// 舊版記帳函數（保持向後兼容）
async function addExpenseRecord(messageText, language = 'zh') {
  try {
    // 支援全形空格解析
    const parts = messageText.split(/[\s　]+/).filter(part => part.length > 0);
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

// 檢查是否為記帳格式（修改版，支援全形空格）
function isExpenseRecord(text) {
  const parts = text.split(/[\s　]+/).filter(part => part.length > 0);
  return parts.length >= 2 && !isNaN(parseFloat(parts[1]));
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

// 取得使用說明（修改版，支援雙語+円+自然語言）
function getHelpMessage(language = 'zh') {
  if (language === 'ja') {
    return `📝 記帳ボット使用説明\n\n` +
           `💡 記帳形式：\n` +
           `【従来形式】\n` +
           `項目　金額　[備考]（全角スペース対応）\n` +
           `項目 金額 [備考]（半角スペース対応）\n\n` +
           `【自然言語形式】NEW！\n` +
           `• 昨日ランチ100円食べた\n` +
           `• 今日コーヒー85円\n` +
           `• 交通費150\n` +
           `• 午餐100元（中国語もOK）\n\n` +
           `📌 例：\n` +
           `• 昼食　150\n` +
           `• コーヒー　85　スターバックス\n` +
           `• 昨天午餐吃了200\n` +
           `• 前天買咖啡花80\n\n` +
           `📊 まとめ確認：\n` +
           `「集計」で今月の支出を確認\n\n` +
           `✨ 特長：\n` +
           `• 全角・半角スペース対応\n` +
           `• 自然言語理解（昨日、今日対応）\n` +
           `• 金額順序自動認識\n` +
           `• 月別ワークシート自動作成\n` +
           `• 中国語・日本語対応`;
  } else {
    return `📝 記帳機器人使用說明\n\n` +
           `💡 記帳格式：\n` +
           `【傳統格式】\n` +
           `項目　金額　[備註]（支援全形空格）\n` +
           `項目 金額 [備註]（支援半形空格）\n\n` +
           `【自然語言格式】全新功能！\n` +
           `• 昨天午餐吃了100元\n` +
           `• 今天咖啡85円\n` +
           `• 交通費150\n` +
           `• ランチ200（日文也可以）\n\n` +
           `📌 範例：\n` +
           `• 午餐　150\n` +
           `• 咖啡　85　星巴克\n` +
           `• 昨天買東西花了200\n` +
           `• 前天搭車用50\n\n` +
           `📊 查看總結：\n` +
           `輸入「總結」查看本月支出\n\n` +
           `✨ 特色功能：\n` +
           `• 支援全形、半形空格\n` +
           `• 自然語言理解（昨天、今天支援）\n` +
           `• 金額順序自動識別\n` +
           `• 自動按月份分工作表\n` +
           `• 支援中日雙語指令`;
  }
}

// 健康檢查路由
app.get('/', (req, res) => {
  res.json({
    status: 'LINE記帳機器人運行中（增強版）',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    features: [
      '全形空格支援',
      '自然語言處理',
      '智能日期識別',
      '金額順序自動判斷',
      '中日雙語支援'
    ]
  });
});

// 啟動伺服器
app.listen(port, () => {
  console.log(`LINE記帳機器人服務器運行在埠口 ${port}`);
  console.log('新功能：');
  console.log('- 支援全形空格（　）解析');
  console.log('- 自然語言處理');
  console.log('- 智能日期識別（昨天、今天等）');
  console.log('- 金額位置自動判斷');
});
