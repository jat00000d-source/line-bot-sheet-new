// 如果 categoryMapping 檔案不存在，我們先定義基本的對應表
let COMMAND_MAPPING = {};
let CATEGORY_MAPPING = {};

try {
  const mappings = require('../constants/categoryMapping');
  COMMAND_MAPPING = mappings.COMMAND_MAPPING || {};
  CATEGORY_MAPPING = mappings.CATEGORY_MAPPING || {};
} catch (error) {
  console.log('⚠️ categoryMapping 檔案不存在，使用預設對應表');
  
  // 預設指令對應表
  COMMAND_MAPPING = {
    '說明': 'help',
    'help': 'help',
    '幫助': 'help',
    '查看支出': 'query_expenses',
    '支出統計': 'query_expenses',
    '查看提醒': 'query_reminders',
    '提醒列表': 'query_reminders',
    '剩餘': 'budget',
    '預算': 'budget',
    '餘額': 'budget'
  };
  
  // 預設類別對應表
  CATEGORY_MAPPING = {
    '早餐': '早餐',
    '午餐': '午餐',
    '晚餐': '晚餐',
    '交通': '交通',
    '娛樂': '娛樂',
    '購物': '購物',
    '醫療': '醫療',
    '其他': '其他'
  };
}

class EnhancedCommandParser {
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

    // 代購相關關鍵詞
    this.purchaseKeywords = ['代購', '代买', '幫買', '幫忙買', '帮买', '購買'];
    this.prepaymentKeywords = ['預付', '预付', '先付', '押金', '訂金', '存錢'];
  }

  parseCommand(text, language = 'zh') {
    const lowerText = text.toLowerCase();
    
    // 檢查特殊指令
    const commandType = COMMAND_MAPPING[text.trim()];
    if (commandType) {
      return { type: commandType };
    }
    
    // 檢查代購相關指令
    if (this.isPurchaseCommand(text)) {
      // 代購查詢
      if (lowerText.includes('查看') || lowerText.includes('查詢') || lowerText.includes('列表') || 
          lowerText.includes('記錄') || lowerText.includes('查') || lowerText.includes('看')) {
        const friendName = this.extractFriendName(text);
        return {
          type: 'query_purchases',
          friendName: friendName
        };
      }
      
      // 一般代購記錄
      const purchaseData = this.parsePurchaseData(text);
      if (purchaseData.success) {
        return {
          type: 'purchase',
          friendName: purchaseData.friendName,
          productName: purchaseData.productName,
          amount: purchaseData.amount,
          note: purchaseData.note
        };
      }
    }

    // 檢查預付金指令
    if (this.isPrepaymentCommand(text)) {
      const prepaymentData = this.parsePrepaymentData(text);
      if (prepaymentData.success) {
        return {
          type: 'prepayment',
          friendName: prepaymentData.friendName,
          amount: prepaymentData.amount
        };
      }
    }
    
    // 檢查預算設定
    if (this.isBudgetSetting(text)) {
      const budgetMatch = text.match(/(\d+)/);
      if (budgetMatch) {
        return {
          type: 'set_budget',
          amount: parseInt(budgetMatch[1])
        };
      }
    }
    
    // 記帳相關命令
    if (lowerText.includes('支出') || lowerText.includes('查看') || lowerText.includes('統計') || lowerText.includes('集計') || lowerText.includes('まとめ')) {
      return { type: 'query_expenses' };
    }
    
    // 提醒相關命令 - 增強解析
    if (this.isReminderCommand(text)) {
      if (lowerText.includes('查看') || lowerText.includes('列表') || lowerText.includes('一覧') || lowerText.includes('リスト')) {
        return { type: 'query_reminders' };
      }
      if (lowerText.includes('刪除') || lowerText.includes('削除') || lowerText.includes('delete')) {
        const match = text.match(/(\d+)/);
        return { 
          type: 'delete_reminder',
          index: match ? match[1] : '1'
        };
      }
      return { 
        type: 'reminder',
        text: text, // 傳遞完整文字給提醒解析器
        reminder: text
      };
    }
    
    // 解析記帳資料
    const expenseData = this.parseExpenseData(text, language);
    if (expenseData.success) {
      return {
        type: 'expense',
        amount: expenseData.amount,
        category: expenseData.item,
        description: expenseData.note,
        dateOffset: expenseData.dateOffset || 0
      };
    }
    
    return { type: 'unknown' };
  }

  isPurchaseCommand(text) {
    return this.purchaseKeywords.some(keyword => text.includes(keyword));
  }

  isPrepaymentCommand(text) {
    return this.prepaymentKeywords.some(keyword => text.includes(keyword));
  }

  parsePurchaseData(text) {
    try {
      // 移除代購關鍵詞
      let cleanText = text;
      this.purchaseKeywords.forEach(keyword => {
        cleanText = cleanText.replace(new RegExp(keyword, 'g'), '');
      });

      // 提取金額
      const amount = this.extractAmountFromText(text);
      if (amount === null) {
        return { success: false, error: '找不到金額' };
      }

      // 提取朋友姓名和商品名稱
      const parts = cleanText.trim().split(/[\s　]+/).filter(part => part.length > 0);
      
      let friendName = '';
      let productName = '';
      let note = '';

      // 移除金額相關文字
      const filteredParts = parts.filter(part => {
        const hasAmount = /\d/.test(part) && (
          part.includes('円') || part.includes('元') || part.includes('圓') ||
          /^\d+$/.test(part.replace(/[元円圓]/g, ''))
        );
        return !hasAmount;
      });

      if (filteredParts.length >= 2) {
        friendName = filteredParts[0];
        productName = filteredParts[1];
        note = filteredParts.slice(2).join(' ');
      } else if (filteredParts.length === 1) {
        productName = filteredParts[0];
        friendName = '朋友';
      } else {
        return { success: false, error: '無法識別朋友或商品資訊' };
      }

      return {
        success: true,
        friendName: friendName || '朋友',
        productName: productName,
        amount: amount,
        note: note
      };
    } catch (error) {
      console.error('解析代購資料錯誤:', error);
      return { success: false, error: '解析失敗' };
    }
  }

  parsePrepaymentData(text) {
    try {
      // 移除預付關鍵詞
      let cleanText = text;
      this.prepaymentKeywords.forEach(keyword => {
        cleanText = cleanText.replace(new RegExp(keyword, 'g'), '');
      });

      // 提取金額
      const amount = this.extractAmountFromText(text);
      if (amount === null) {
        return { success: false, error: '找不到金額' };
      }

      // 提取朋友姓名
      const parts = cleanText.trim().split(/[\s　]+/).filter(part => part.length > 0);
      
      // 移除金額相關文字
      const filteredParts = parts.filter(part => {
        const hasAmount = /\d/.test(part) && (
          part.includes('円') || part.includes('元') || part.includes('圓') ||
          /^\d+$/.test(part.replace(/[元円圓]/g, ''))
        );
        return !hasAmount;
      });

      const friendName = filteredParts.length > 0 ? filteredParts[0] : '朋友';

      return {
        success: true,
        friendName: friendName,
        amount: amount
      };
    } catch (error) {
      console.error('解析預付資料錯誤:', error);
      return { success: false, error: '解析失敗' };
    }
  }

  extractFriendName(text) {
    // 移除查詢相關關鍵詞
    let cleanText = text.replace(/(?:查看|查詢|列表|記錄|查|看|代購)/g, '').trim();
    
    // 如果還有內容，認為是朋友姓名
    if (cleanText.length > 0) {
      const parts = cleanText.split(/[\s　]+/).filter(part => part.length > 0);
      return parts[0];
    }
    
    return null;
  }

  isReminderCommand(text) {
    const reminderKeywords = [
      '提醒', 'リマインダー', 'remind', 'reminder',
      '明天', '明日', '後で', '今天', '今日', 
      '每天', '毎日', '每週', '毎週', '每月', '毎月',
      '時', '點', '分', 'daily', 'weekly', 'monthly',
      '隔週', '隔周', '每年', '毎年'
    ];
    
    const timePatterns = [
      /\d+[:：時点]\d*/,
      /\d+\s*(分鐘?|小時|時間|hours?|minutes?)\s*後/,
      /(今天|明天|今日|明日)\s*\d+/,
      /(每天|每週|每月|每年|隔週|毎日|毎週|毎月|毎年|daily|weekly|monthly|yearly)/,
      /每月\d+號/, // 每月特定日期
      /每個月\d+號/, // 每個月特定日期
      /每月(一|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|二十一|二十二|二十三|二十四|二十五|二十六|二十七|二十八|二十九|三十|三十一)號/, // 每月中文數字
      /每週(一|二|三|四|五|六|日|星期[一二三四五六日])/, // 每週特定天
      /每\d+天/, // 每N天
      /(下週|下周|這週|這周)(一|二|三|四|五|六|日)/ // 下週/這週特定天
    ];
    
    // 首先檢查關鍵詞
    const hasKeyword = reminderKeywords.some(keyword => text.includes(keyword));
    
    // 然後檢查時間模式
    const hasTimePattern = timePatterns.some(pattern => pattern.test(text));
    
    // 特殊情況：包含"每月XX號"這樣的模式，即使沒有"提醒"關鍵詞也認為是提醒
    const monthlyPattern = /每月\d+號|每個月\d+號|每月(一|二|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|二十一|二十二|二十三|二十四|二十五|二十六|二十七|二十八|二十九|三十|三十一)號/;
    
    return hasKeyword || hasTimePattern || monthlyPattern.test(text);
  }

  isBudgetSetting(text) {
    const patterns = [
      /^設定預算[\s　]+(\d+)/,
      /^預算設定[\s　]+(\d+)/,
      /^予算設定[\s　]+(\d+)/,
      /^予算[\s　]+(\d+)/,
      /^預算[\s　]+(\d+)/
    ];
    
    return patterns.some(pattern => pattern.test(text.trim()));
  }

  parseExpenseData(message, language) {
    try {
      // 首先嘗試傳統格式解析
      const traditionalResult = this.parseTraditionalFormat(message);
      if (traditionalResult.success) {
        return traditionalResult;
      }
      
      // 自然語言解析
      const nlResult = this.parseNaturalText(message, language);
      return nlResult;
      
    } catch (error) {
      console.error('解析錯誤:', error);
      return {
        success: false,
        error: '無法識別輸入格式'
      };
    }
  }

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
          dateOffset: 0
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
          dateOffset: 0
        };
      }
    }
    
    return { success: false };
  }

  parseNaturalText(message, language) {
    let item = null;
    let amount = null;
    let dateOffset = 0;
    let note = '';
    
    // 提取金額
    amount = this.extractAmountFromText(message);
    if (amount === null) {
      return {
        success: false,
        error: '找不到金額'
      };
    }
    
    // 提取日期偏移
    dateOffset = this.extractDateOffset(message);
    
    // 提取項目
    item = this.extractItemFromText(message, language);
    if (!item) {
      return {
        success: false,
        error: '找不到消費項目'
      };
    }
    
    // 提取備註
    note = this.extractNote(message, item, amount, dateOffset);
    
    return {
      success: true,
      item: item,
      amount: amount,
      note: note,
      dateOffset: dateOffset
    };
  }

  extractAmountFromText(text) {
    const patterns = [
      /(\d+(?:\.\d+)?)\s*[元円圓塊錢]/g,
      /[元円圓塊錢]\s*(\d+(?:\.\d+)?)/g,
      /(?:花了?|用了?|費用|支出|花費)\s*(\d+(?:\.\d+)?)/g,
      /(\d+(?:\.\d+)?)\s*(?:花了?|用了?)/g,
      /(?:^|\s)(\d+(?:\.\d+)?)(?=\s|[^.\d]|$)/g
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

  extractAmount(str) {
    const cleaned = str.replace(/[元円圓塊錢]/g, '');
    const amount = parseFloat(cleaned);
    return (!isNaN(amount) && amount > 0) ? amount : null;
  }

  extractDateOffset(text) {
    for (let [keyword, offset] of Object.entries(this.dateKeywords)) {
      if (text.includes(keyword)) {
        return offset;
      }
    }
    return 0;
  }

  extractItemFromText(message, language) {
    // 先檢查是否有明確的類別關鍵詞
    for (let [key, value] of Object.entries(CATEGORY_MAPPING)) {
      if (message.includes(key)) {
        return value;
      }
    }
    
    // 如果都找不到，嘗試提取第一個可能的名詞
    const words = message.replace(/[\d\s元円圓塊錢花了用了昨天今天前天]/g, '').trim();
    if (words.length > 0) {
      return words.substring(0, Math.min(words.length, 4));
    }
    
    return '其他';
  }

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

module.exports = EnhancedCommandParser;
