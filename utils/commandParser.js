// utils/commandParser.js - 統一指令解析器 (Class 版本)
const NaturalLanguageProcessor = require('./naturalLanguageProcessor');

class CommandParser {
  constructor() {
    this.nlp = new NaturalLanguageProcessor();

    // === 雙語指令支援 ===
    this.EXPENSE_COMMAND_MAPPING = {
      // 中文指令
      '總結': 'summary',
      '本月總結': 'summary',
      '說明': 'help',
      '幫助': 'help',
      '設定預算': 'set_budget',
      '預算': 'budget',
      '查看預算': 'budget',
      '剩餘': 'remaining',
      
      // 日文指令
      '集計': 'summary',
      '合計': 'summary', 
      'まとめ': 'summary',
      '今月集計': 'summary',
      '説明': 'help',
      'ヘルプ': 'help',
      '助け': 'help',
      '予算設定': 'set_budget',
      '予算': 'budget',
      '残り': 'remaining',
      '残額': 'remaining'
    };

    this.TODO_COMMAND_MAPPING = {
      // 中文代辦指令
      '新增代辦': 'add_todo',
      '添加代辦': 'add_todo',
      '代辦列表': 'list_todos',
      '查看代辦': 'list_todos',
      '完成代辦': 'complete_todo',
      '刪除代辦': 'delete_todo',
      '新增提醒': 'add_reminder',
      '添加提醒': 'add_reminder',
      '提醒列表': 'list_reminders',
      '查看提醒': 'list_reminders',
      '刪除提醒': 'delete_reminder',
      '代辦說明': 'todo_help',
      '代辦幫助': 'todo_help',
      
      // 日文代辦指令
      'タスク追加': 'add_todo',
      'TODO追加': 'add_todo',
      'タスク一覧': 'list_todos',
      'TODO一覧': 'list_todos',
      'タスク完了': 'complete_todo',
      'TODO完了': 'complete_todo',
      'タスク削除': 'delete_todo',
      'TODO削除': 'delete_todo',
      'リマインダー追加': 'add_reminder',
      'リマインダー一覧': 'list_reminders',
      'リマインダー削除': 'delete_reminder',
      'TODO説明': 'todo_help',
      'TODOヘルプ': 'todo_help'
    };
  }

  // === 語言檢測 ===
  detectLanguage(message) {
    const japaneseKeywords = ['集計', '合計', 'まとめ', '今月集計', '説明', 'ヘルプ', '助け',
                             '昼食', 'ランチ', '夕食', '夜食', '朝食', 'コーヒー', '珈琲',
                             '交通費', '電車', 'バス', 'タクシー', '買い物', 'ショッピング',
                             '娯楽', '映画', 'ゲーム', '医療', '病院', '薬', '今日', '昨日', '一昨日',
                             '予算設定', '予算', '残り', '残額', 'タスク', 'TODO', 'リマインダー'];
    
    const japaneseChars = /[\u3040-\u309F\u30A0-\u30FF]/;
    const hasJapaneseKeyword = japaneseKeywords.some(keyword => message.includes(keyword));
    const hasJapaneseChars = japaneseChars.test(message);
    
    return (hasJapaneseKeyword || hasJapaneseChars) ? 'ja' : 'zh';
  }

  // === 預算設定格式檢查 ===
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

  // === 檢查是否為代辦相關 ===
  isTodoCommand(message) {
    const todoKeywords = [
      '代辦', '待辦', '提醒', 'todo', 'TODO',
      'タスク', 'リマインダー'
    ];
    return todoKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  // === 主指令解析 ===
  parseCommand(message) {
    const language = this.detectLanguage(message);
    const trimmedMessage = message.trim();
    
    // 記帳相關指令
    const expenseCommandType = this.EXPENSE_COMMAND_MAPPING[trimmedMessage];
    if (expenseCommandType) {
      return { success: true, category: 'expense', commandType: expenseCommandType, language, originalMessage: message };
    }
    
    // 代辦相關指令
    const todoCommandType = this.TODO_COMMAND_MAPPING[trimmedMessage];
    if (todoCommandType) {
      return { success: true, category: 'todo', commandType: todoCommandType, language, originalMessage: message };
    }
    
    // 預算設定格式
    if (this.isBudgetSetting(trimmedMessage)) {
      return { success: true, category: 'expense', commandType: 'set_budget', language, originalMessage: message };
    }
    
    // 代辦相關自然語言
    if (this.isTodoCommand(trimmedMessage)) {
      const todoResult = this.parseTodoNaturalLanguage(trimmedMessage, language);
      if (todoResult.success) {
        return { success: true, category: 'todo', commandType: todoResult.commandType, language, originalMessage: message, parsedData: todoResult.data };
      }
      return { success: true, category: 'todo', commandType: 'todo_help', language, originalMessage: message };
    }
    
    // 記帳自然語言
    const nlResult = this.nlp.parseNaturalLanguage(trimmedMessage, language);
    if (nlResult.success) {
      return { success: true, category: 'expense', commandType: 'expense', language, originalMessage: message, parsedData: nlResult };
    }
    
    // 無法識別
    return { success: false, language, error: nlResult.error || (language === 'ja'
      ? '正しい形式を入力するか、「説明」または「TODOヘルプ」で使用方法を確認してください'
      : '請輸入正確格式或輸入「說明」或「代辦說明」查看使用方法') };
  }

  // === 代辦自然語言解析 ===
  parseTodoNaturalLanguage(message, language) {
    const addTodoPatterns = [
      /(?:新增|添加|加入)(?:代辦|待辦|任務)[:：]?\s*(.+)/i,
      /(?:タスク|TODO)(?:追加|新規)[:：]?\s*(.+)/i,
      /(?:代辦|待辦|todo)[:：]\s*(.+)/i
    ];
    
    const reminderPatterns = [
      /(?:提醒|リマインド).*?(\d+)(?:點|時|:)(\d+)?.*?(.+)/i,
      /(\d+)(?:點|時|:)(\d+)?.*?(?:提醒|リマインド).*?(.+)/i,
      /(?:明天|明日|今天|今日|後天).*?(?:提醒|リマインド)/i
    ];
    
    for (const pattern of addTodoPatterns) {
      const match = message.match(pattern);
      if (match) {
        return { success: true, commandType: 'add_todo', data: { content: match[1].trim(), priority: 'normal' } };
      }
    }
    
    for (const pattern of reminderPatterns) {
      const match = message.match(pattern);
      if (match) {
        return { success: true, commandType: 'add_reminder', data: { content: match[3] || match[1], time: match[1] && match[2] ? `${match[1]}:${match[2]}` : null } };
      }
    }
    
    if (/(?:完成|刪除|删除|完了|削除)/.test(message)) {
      const isComplete = /(?:完成|完了)/.test(message);
      const numberMatch = message.match(/(\d+)/);
      return { success: true, commandType: isComplete ? 'complete_todo' : 'delete_todo', data: { id: numberMatch ? parseInt(numberMatch[1]) : null } };
    }
    
    return { success: false };
  }
}

module.exports = CommandParser;
