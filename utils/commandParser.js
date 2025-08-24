// utils/commandParser.js (更新版 - 支援待辦功能)
const LanguageDetector = require('./languageDetector');

/**
 * 解析使用者指令
 * @param {string} message - 使用者訊息
 * @returns {Object} 解析結果
 */
function parseCommand(message) {
  const text = message.trim().toLowerCase();
  const language = LanguageDetector.detectLanguage(message);

  // 記帳相關指令
  if (isExpenseCommand(text, language)) {
    return parseExpenseCommand(text, language);
  }
  
  // 待辦相關指令
  if (isTodoCommand(text, language)) {
    return parseTodoCommand(message.trim(), language); // 保持原始大小寫
  }
  
  // 提醒相關指令
  if (isReminderCommand(text, language)) {
    return parseReminderCommand(message.trim(), language);
  }

  // 幫助指令
  if (isHelpCommand(text, language)) {
    return parseHelpCommand(text, language);
  }

  return {
    success: false,
    error: language === 'ja' ? 
      '認識できないコマンドです。「help」または「ヘルプ」と入力してください。' :
      '無法識別的指令。請輸入 help 或 幫助 查看使用說明。'
  };
}

/**
 * 檢查是否為記帳指令
 */
function isExpenseCommand(text, language) {
  const patterns = {
    zh: [/^\d+/, /預算/, /餘額/, /剩餘/, /總結/, /統計/],
    ja: [/^\d+/, /予算/, /残高/, /残り/, /まとめ/, /統計/]
  };
  
  return patterns[language]?.some(pattern => pattern.test(text)) || false;
}

/**
 * 檢查是否為待辦指令
 */
function isTodoCommand(text, language) {
  const patterns = {
    zh: [
      /^(新增|添加|加入).*待辦/,
      /^待辦.*(新增|添加|加入)/,
      /^(查看|顯示|列出).*待辦/,
      /^待辦.*(查看|顯示|列表|清單)/,
      /^(刪除|移除|完成).*待辦/,
      /^待辦.*(刪除|移除|完成)/,
      /^todo/i
    ],
    ja: [
      /^(追加|新規).*todo/i,
      /^todo.*(追加|新規)/i,
      /^(表示|確認|リスト).*todo/i,
      /^todo.*(表示|確認|リスト)/i,
      /^(削除|完了).*todo/i,
      /^todo.*(削除|完了)/i,
      /^やることリスト/,
      /^todo/i
    ]
  };
  
  return patterns[language]?.some(pattern => pattern.test(text)) || false;
}

/**
 * 檢查是否為提醒指令
 */
function isReminderCommand(text, language) {
  const patterns = {
    zh: [
      /^(提醒|通知|提醒我)/,
      /^(明天|下週|下個月|每天|每週|每月)/,
      /^設定.*提醒/,
      /^(查看|顯示|列出).*提醒/,
      /^(刪除|移除|取消).*提醒/
    ],
    ja: [
      /^(リマインド|通知|思い出させて)/,
      /^(明日|来週|来月|毎日|毎週|毎月)/,
      /^リマインド.*設定/,
      /^(表示|確認|リスト).*リマインド/,
      /^(削除|キャンセル).*リマインド/
    ]
  };
  
  return patterns[language]?.some(pattern => pattern.test(text)) || false;
}

/**
 * 檢查是否為幫助指令
 */
function isHelpCommand(text, language) {
  const helpKeywords = {
    zh: ['help', '幫助', '說明', '指令'],
    ja: ['help', 'ヘルプ', '使い方', 'コマンド']
  };
  
  return helpKeywords[language]?.includes(text) || false;
}

/**
 * 解析記帳指令
 */
function parseExpenseCommand(text, language) {
  // 原有的記帳指令解析邏輯
  if (/^\d+/.test(text)) {
    return {
      success: true,
      commandType: 'expense',
      originalText: text
    };
  }
  
  const budgetKeywords = language === 'ja' ? ['予算'] : ['預算'];
  if (budgetKeywords.some(keyword => text.includes(keyword))) {
    return {
      success: true,
      commandType: 'set_budget',
      originalText: text
    };
  }
  
  const summaryKeywords = language === 'ja' ? ['まとめ', '統計'] : ['總結', '統計'];
  if (summaryKeywords.some(keyword => text.includes(keyword))) {
    return {
      success: true,
      commandType: 'expense_summary',
      originalText: text
    };
  }
  
  return {
    success: true,
    commandType: 'expense',
    originalText: text
  };
}

/**
 * 解析待辦指令
 */
function parseTodoCommand(text, language) {
  const lowerText = text.toLowerCase();
  
  // 新增待辦
  if (language === 'zh') {
    if (/^(新增|添加|加入).*待辦/.test(lowerText) || 
        /^待辦.*(新增|添加|加入)/.test(lowerText) ||
        /^todo\s+add/i.test(text)) {
      return {
        success: true,
        commandType: 'todo_add',
        originalText: text,
        content: extractTodoContent(text, language, 'add')
      };
    }
  } else if (language === 'ja') {
    if (/^(追加|新規).*todo/i.test(lowerText) || 
        /^todo.*(追加|新規)/i.test(lowerText) ||
        /^todo\s+add/i.test(text)) {
      return {
        success: true,
        commandType: 'todo_add',
        originalText: text,
        content: extractTodoContent(text, language, 'add')
      };
    }
  }
  
  // 查看待辦
  if (language === 'zh') {
    if (/^(查看|顯示|列出).*待辦/.test(lowerText) || 
        /^待辦.*(查看|顯示|列表|清單)/.test(lowerText) ||
        /^todo\s+(list|show)/i.test(text)) {
      return {
        success: true,
        commandType: 'todo_list',
        originalText: text
      };
    }
  } else if (language === 'ja') {
    if (/^(表示|確認|リスト).*todo/i.test(lowerText) || 
        /^todo.*(表示|確認|リスト)/i.test(lowerText) ||
        /^todo\s+(list|show)/i.test(text)) {
      return {
        success: true,
        commandType: 'todo_list',
        originalText: text
      };
    }
  }
  
  // 刪除/完成待辦
  if (language === 'zh') {
    if (/^(刪除|移除|完成).*待辦/.test(lowerText) || 
        /^待辦.*(刪除|移除|完成)/.test(lowerText) ||
        /^todo\s+(delete|complete|done)/i.test(text)) {
      return {
        success: true,
        commandType: /完成/.test(lowerText) || /complete|done/i.test(text) ? 'todo_complete' : 'todo_delete',
        originalText: text,
        todoId: extractTodoId(text)
      };
    }
  } else if (language === 'ja') {
    if (/^(削除|完了).*todo/i.test(lowerText) || 
        /^todo.*(削除|完了)/i.test(lowerText) ||
        /^todo\s+(delete|complete|done)/i.test(text)) {
      return {
        success: true,
        commandType: /完了/.test(lowerText) || /complete|done/i.test(text) ? 'todo_complete' : 'todo_delete',
        originalText: text,
        todoId: extractTodoId(text)
      };
    }
  }
  
  // 預設為新增待辦
  return {
    success: true,
    commandType: 'todo_add',
    originalText: text,
    content: text
  };
}

/**
 * 解析提醒指令
 */
function parseReminderCommand(text, language) {
  const lowerText = text.toLowerCase();
  
  // 新增提醒
  if (language === 'zh') {
    if (/^(提醒|通知|提醒我)/.test(lowerText) || 
        /^設定.*提醒/.test(lowerText)) {
      return {
        success: true,
        commandType: 'reminder_add',
        originalText: text,
        content: extractReminderContent(text, language)
      };
    }
  } else if (language === 'ja') {
    if (/^(リマインド|通知|思い出させて)/.test(lowerText) || 
        /^リマインド.*設定/.test(lowerText)) {
      return {
        success: true,
        commandType: 'reminder_add',
        originalText: text,
        content: extractReminderContent(text, language)
      };
    }
  }
  
  // 查看提醒
  if (language === 'zh') {
    if (/^(查看|顯示|列出).*提醒/.test(lowerText)) {
      return {
        success: true,
        commandType: 'reminder_list',
        originalText: text
      };
    }
  } else if (language === 'ja') {
    if (/^(表示|確認|リスト).*リマインド/.test(lowerText)) {
      return {
        success: true,
        commandType: 'reminder_list',
        originalText: text
      };
    }
  }
  
  // 刪除提醒
  if (language === 'zh') {
    if (/^(刪除|移除|取消).*提醒/.test(lowerText)) {
      return {
        success: true,
        commandType: 'reminder_delete',
        originalText: text,
        reminderId: extractReminderId(text)
      };
    }
  } else if (language === 'ja') {
    if (/^(削除|キャンセル).*リマインド/.test(lowerText)) {
      return {
        success: true,
        commandType: 'reminder_delete',
        originalText: text,
        reminderId: extractReminderId(text)
      };
    }
  }
  
  // 預設為新增提醒
  return {
    success: true,
    commandType: 'reminder_add',
    originalText: text,
    content: text
  };
}

/**
 * 解析幫助指令
 */
function parseHelpCommand(text, language) {
  if (text.includes('todo') || text.includes('待辦') || text.includes('やること')) {
    return {
      success: true,
      commandType: 'todo_help',
      originalText: text
    };
  }
  
  return {
    success: true,
    commandType: 'expense_help',
    originalText: text
  };
}

/**
 * 提取待辦內容
 */
function extractTodoContent(text, language, action) {
  const patterns = {
    zh: {
      add: [/^(新增|添加|加入)\s*待辦\s*(.+)/, /^待辦\s*(新增|添加|加入)\s*(.+)/, /^todo\s+add\s+(.+)/i]
    },
    ja: {
      add: [/^(追加|新規)\s*todo\s*(.+)/i, /^todo\s*(追加|新規)\s*(.+)/i, /^todo\s+add\s+(.+)/i]
    }
  };
  
  for (const pattern of patterns[language]?.[action] || []) {
    const match = text.match(pattern);
    if (match) {
      return match[match.length - 1].trim();
    }
  }
  
  return text; // 如果沒有匹配到特定模式，返回原文
}

/**
 * 提取待辦ID
 */
function extractTodoId(text) {
  const match = text.match(/\d+/);
  return match ? parseInt(match[0]) : null;
}

/**
 * 提取提醒內容
 */
function extractReminderContent(text, language) {
  const patterns = {
    zh: [/^(提醒|通知|提醒我)\s*(.+)/, /^設定.*提醒\s*(.+)/],
    ja: [/^(リマインド|通知|思い出させて)\s*(.+)/, /^リマインド.*設定\s*(.+)/]
  };
  
  for (const pattern of patterns[language] || []) {
    const match = text.match(pattern);
    if (match) {
      return match[match.length - 1].trim();
    }
  }
  
  return text;
}

/**
 * 提取提醒ID
 */
function extractReminderId(text) {
  const match = text.match(/\d+/);
  return match ? parseInt(match[0]) : null;
}

module.exports = {
  parseCommand,
  isExpenseCommand,
  isTodoCommand,
  isReminderCommand,
  isHelpCommand
};
