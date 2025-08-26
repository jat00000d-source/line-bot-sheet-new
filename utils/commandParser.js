// utils/commandParser.js - 完整版
const moment = require('moment-timezone');

class CommandParser {
  constructor() {
    console.log('🔧 CommandParser 初始化完成');
  }

  parseCommand(text, language = 'zh') {
    const trimmedText = text.trim();
    
    // 記帳指令解析
    const expenseResult = this.parseExpenseCommand(trimmedText);
    if (expenseResult) return expenseResult;

    // 提醒指令解析
    const reminderResult = this.parseReminderCommand(trimmedText, language);
    if (reminderResult) return reminderResult;

    // 查詢指令解析
    const queryResult = this.parseQueryCommand(trimmedText, language);
    if (queryResult) return queryResult;

    // 刪除指令解析
    const deleteResult = this.parseDeleteCommand(trimmedText, language);
    if (deleteResult) return deleteResult;

    // 預設回應
    return {
      type: 'default',
      originalText: trimmedText,
      language: language
    };
  }

  parseExpenseCommand(text) {
    // 記帳格式：
    // "水 108"
    // "食物 50 午餐"
    // "交通 30"
    // "108 水"
    // "50元 食物 午餐"

    const patterns = [
      // 類別 金額 [描述]
      /^(.+?)\s+(\d+)(?:元|円)?\s*(.*)$/,
      // 金額 類別 [描述] 
      /^(\d+)(?:元|円)?\s+(.+?)\s*(.*)$/
    ];

    for (let i = 0; i < patterns.length; i++) {
      const match = text.match(patterns[i]);
      if (match) {
        let category, amount, description;
        
        if (i === 0) {
          // 類別 金額 [描述]
          category = match[1].trim();
          amount = parseInt(match[2]);
          description = match[3].trim();
        } else {
          // 金額 類別 [描述]
          amount = parseInt(match[1]);
          category = match[2].trim();
          description = match[3].trim();
        }

        // 驗證是否為有效的記帳指令
        if (amount > 0 && category.length > 0) {
          return {
            type: 'expense',
            category: category,
            amount: amount,
            description: description || '',
            originalText: text
          };
        }
      }
    }

    return null;
  }

  parseReminderCommand(text, language) {
    const reminderKeywords = {
      'zh': ['提醒', '提醒我', '記得', '提醒設定'],
      'ja': ['リマインダー', 'リマインド', '思い出させて', '通知']
    };

    // 檢查是否包含提醒關鍵字
    const hasReminderKeyword = reminderKeywords[language]?.some(keyword => 
      text.includes(keyword)
    );

    if (!hasReminderKeyword) {
      // 嘗試解析時間表達式來判斷是否為提醒
      const timeResult = this.parseTimeExpression(text);
      if (!timeResult) return null;
    }

    // 解析時間和內容
    const timeResult = this.parseTimeExpression(text);
    if (!timeResult) {
      return {
        type: 'reminder',
        error: 'time_parse_failed',
        originalText: text
      };
    }

    // 提取提醒內容
    let content = text;
    if (timeResult.matchedText) {
      content = text.replace(timeResult.matchedText, '').trim();
    }

    // 清理提醒關鍵字
    reminderKeywords[language]?.forEach(keyword => {
      content = content.replace(keyword, '').trim();
    });

    return {
      type: 'reminder',
      title: content || '提醒',
      description: '',
      reminderTime: timeResult.dateTime,
      type: timeResult.type,
      originalText: text
    };
  }

  parseTimeExpression(text) {
    const now = moment().tz('Asia/Tokyo');
    
    // 時間解析規則
    const timePatterns = [
      // 明天 8點
      {
        regex: /明天\s*(\d{1,2})(?:點|时|:|：)(\d{1,2})?/,
        handler: (match) => {
          const hour = parseInt(match[1]);
          const minute = parseInt(match[2] || '0');
          const tomorrow = now.clone().add(1, 'day').hour(hour).minute(minute).second(0);
          return { dateTime: tomorrow.toISOString(), type: 'once', matchedText: match[0] };
        }
      },
      // 今天 19點
      {
        regex: /今天\s*(\d{1,2})(?:點|时|:|：)(\d{1,2})?/,
        handler: (match) => {
          const hour = parseInt(match[1]);
          const minute = parseInt(match[2] || '0');
          const today = now.clone().hour(hour).minute(minute).second(0);
          return { dateTime: today.toISOString(), type: 'once', matchedText: match[0] };
        }
      },
      // 每天 19點
      {
        regex: /每天\s*(\d{1,2})(?:點|时|:|：)(\d{1,2})?/,
        handler: (match) => {
          const hour = parseInt(match[1]);
          const minute = parseInt(match[2] || '0');
          const dailyTime = now.clone().hour(hour).minute(minute).second(0);
          return { dateTime: dailyTime.toISOString(), type: 'daily', matchedText: match[0] };
        }
      },
      // 每週一 10點
      {
        regex: /每週?([一二三四五六日])\s*(\d{1,2})(?:點|时|:|：)(\d{1,2})?/,
        handler: (match) => {
          const weekdayMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0 };
          const targetWeekday = weekdayMap[match[1]];
          const hour = parseInt(match[2]);
          const minute = parseInt(match[3] || '0');
          
          const nextWeekday = now.clone()
            .day(targetWeekday)
            .hour(hour)
            .minute(minute)
            .second(0);
            
          if (nextWeekday.isBefore(now)) {
            nextWeekday.add(1, 'week');
          }
          
          return { dateTime: nextWeekday.toISOString(), type: 'weekly', matchedText: match[0] };
        }
      },
      // 直接時間格式 "19:30", "8點", "下午3點"
      {
        regex: /(\d{1,2})[:：](\d{2})/,
        handler: (match) => {
          const hour = parseInt(match[1]);
          const minute = parseInt(match[2]);
          const timeToday = now.clone().hour(hour).minute(minute).second(0);
          
          // 如果時間已過，設為明天
          if (timeToday.isBefore(now)) {
            timeToday.add(1, 'day');
          }
          
          return { dateTime: timeToday.toISOString(), type: 'once', matchedText: match[0] };
        }
      },
      // 日語時間表達
      {
        regex: /明日\s*(\d{1,2})時(\d{1,2})?分?/,
        handler: (match) => {
          const hour = parseInt(match[1]);
          const minute = parseInt(match[2] || '0');
          const tomorrow = now.clone().add(1, 'day').hour(hour).minute(minute).second(0);
          return { dateTime: tomorrow.toISOString(), type: 'once', matchedText: match[0] };
        }
      },
      {
        regex: /毎日\s*(\d{1,2})時(\d{1,2})?分?/,
        handler: (match) => {
          const hour = parseInt(match[1]);
          const minute = parseInt(match[2] || '0');
          const dailyTime = now.clone().hour(hour).minute(minute).second(0);
          return { dateTime: dailyTime.toISOString(), type: 'daily', matchedText: match[0] };
        }
      }
    ];

    // 嘗試匹配時間格式
    for (const pattern of timePatterns) {
      const match = text.match(pattern.regex);
      if (match) {
        try {
          return pattern.handler(match);
        } catch (error) {
          console.error('時間解析錯誤:', error);
          continue;
        }
      }
    }

    return null;
  }

  parseQueryCommand(text, language) {
    const queryKeywords = {
      'zh': ['查看提醒', '提醒列表', '提醒清單', '查詢提醒', '我的提醒', '查看支出', '支出記錄'],
      'ja': ['リマインダー一覧', 'リマインダーリスト', 'リマインダー確認', 'リマインダー表示', '支出確認', '支出履歴']
    };

    const hasQueryKeyword = queryKeywords[language]?.some(keyword => 
      text.includes(keyword)
    );

    if (hasQueryKeyword) {
      // 判斷是查詢提醒還是支出
      const expenseKeywords = ['支出', '記錄', '記帳', '花費'];
      const isExpenseQuery = expenseKeywords.some(keyword => text.includes(keyword));
      
      return {
        type: isExpenseQuery ? 'query_expenses' : 'query_reminders',
        originalText: text
      };
    }

    return null;
  }

  parseDeleteCommand(text, language) {
    const deletePatterns = {
      'zh': [
        /刪除提醒\s*(\d+)/,
        /删除提醒\s*(\d+)/,
        /提醒刪除\s*(\d+)/,
        /移除提醒\s*(\d+)/
      ],
      'ja': [
        /リマインダー削除\s*(\d+)/,
        /リマインダー消去\s*(\d+)/,
        /削除\s*(\d+)/
      ]
    };

    const patterns = deletePatterns[language] || deletePatterns['zh'];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'delete_reminder',
          index: parseInt(match[1]),
          originalText: text
        };
      }
    }

    return null;
  }
}

// utils/languageDetector.js - 完整版
class LanguageDetector {
  constructor() {
    console.log('🌐 LanguageDetector 初始化完成');
  }

  detect(text) {
    // 移除標點符號和數字，只檢查文字
    const cleanText = text.replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '');
    
    if (cleanText.length === 0) {
      return 'zh'; // 預設繁體中文
    }

    // 日語字符檢測
    const hiraganaRegex = /[\u3040-\u309F]/; // 平假名
    const katakanaRegex = /[\u30A0-\u30FF]/; // 片假名
    const kanjiRegex = /[\u4E00-\u9FAF]/;    // 漢字

    // 中文特有的字符（繁體常見字）
    const chineseSpecificRegex = /[的了是在我你他她它們這那個]/;

    // 日語特有的詞彙和語法標誌
    const japaneseSpecificWords = /です|ます|である|だった|している|リマインダー|円|時|分|明日|今日|毎日|毎週|削除/;

    // 中文特有的詞彙
    const chineseSpecificWords = /元|點|时|明天|今天|每天|每週|刪除|删除|提醒|記得|查看|列表|清單/;

    let japaneseScore = 0;
    let chineseScore = 0;

    // 檢查平假名和片假名（明顯的日語標誌）
    if (hiraganaRegex.test(text)) japaneseScore += 10;
    if (katakanaRegex.test(text)) japaneseScore += 5;

    // 檢查特定詞彙
    if (japaneseSpecificWords.test(text)) japaneseScore += 8;
    if (chineseSpecificWords.test(text)) chineseScore += 8;

    // 檢查特有字符
    if (chineseSpecificRegex.test(text)) chineseScore += 5;

    // 檢查數字單位
    if (text.includes('円')) japaneseScore += 3;
    if (text.includes('元')) chineseScore += 3;

    // 檢查時間表達
    if (text.includes('時') && !text.includes('點')) japaneseScore += 2;
    if (text.includes('點')) chineseScore += 2;

    // 語法結構檢測
    // 日語常見的動詞變位
    if (/します|ました|している|いる$/.test(text)) japaneseScore += 5;

    // 中文常見結構
    if (/了$|吧$|呢$/.test(text)) chineseScore += 3;

    console.log(`🌐 語言檢測: "${text}" -> 日語分數: ${japaneseScore}, 中文分數: ${chineseScore}`);
    
    return japaneseScore > chineseScore ? 'ja' : 'zh';
  }

  // 取得語言名稱
  getLanguageName(code) {
    const names = {
      'zh': '繁體中文',
      'ja': '日本語'
    };
    return names[code] || code;
  }
}

module.exports = { CommandParser, LanguageDetector };
