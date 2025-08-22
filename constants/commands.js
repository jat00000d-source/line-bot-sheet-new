// constants/commands.js

// 指令對照表 - 從原 index.js 移出並擴充
const COMMAND_MAPPING = {
  // === 記帳相關指令 ===
  
  // 中文指令
  '總結': 'expense_summary',
  '本月總結': 'expense_summary', 
  '說明': 'expense_help',
  '幫助': 'expense_help',
  '設定預算': 'set_budget',
  '預算': 'budget',
  '查看預算': 'budget',
  '剩餘': 'remaining',
  
  // 日文指令
  '集計': 'expense_summary',
  '合計': 'expense_summary',
  'まとめ': 'expense_summary',
  '今月集計': 'expense_summary',
  '説明': 'expense_help',
  'ヘルプ': 'expense_help',
  '助け': 'expense_help',
  '予算設定': 'set_budget',
  '予算': 'budget',
  '残り': 'remaining',
  '残額': 'remaining',
  
  // === 待辦相關指令（預留，暫時註解） ===
  
  // 中文指令
  // '新增提醒': 'add_reminder',
  // '提醒': 'add_reminder', 
  // '查看提醒': 'list_reminders',
  // '提醒列表': 'list_reminders',
  // '刪除提醒': 'delete_reminder',
  // '待辦': 'list_reminders',
  // '待辦說明': 'reminder_help',
  
  // 日文指令
  // 'リマインダー': 'add_reminder',
  // '通知': 'add_reminder',
  // 'リスト': 'list_reminders', 
  // '削除': 'delete_reminder',
  // 'タスク': 'list_reminders',
  // 'タスク説明': 'reminder_help',
};

// 項目分類對照表 - 從原 index.js 移出
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

// 語言檢測關鍵詞
const LANGUAGE_KEYWORDS = {
  japanese: [
    // 記帳相關
    '集計', '合計', 'まとめ', '今月集計', '説明', 'ヘルプ', '助け',
    '昼食', 'ランチ', '夕食', '夜食', '朝食', 'コーヒー', '珈琲',
    '交通費', '電車', 'バス', 'タクシー', '買い物', 'ショッピング',
    '娯楽', '映画', 'ゲーム', '医療', '病院', '薬', '今日', '昨日', '一昨日',
    '予算設定', '予算', '残り', '残額',
    
    // 待辦相關（預留）
    // 'リマインダー', '通知', 'リスト', '削除', 'タスク',
    // '明日', '明後日', '来週', '来月', '毎日', '毎週', '毎月'
  ],
  
  chinese: [
    // 記帳相關
    '總結', '本月總結', '說明', '幫助', '設定預算', '預算', '查看預算', '剩餘',
    '午餐', '晚餐', '早餐', '咖啡', '交通', '購物', '娛樂', '醫療',
    '今天', '昨天', '前天',
    
    // 待辦相關（預留）
    // '新增提醒', '提醒', '查看提醒', '提醒列表', '刪除提醒', '待辦',
    // '明天', '後天', '下週', '下個月', '每天', '每週', '每月'
  ]
};

// 指令類型分類
const COMMAND_TYPES = {
  // 記帳相關
  EXPENSE: 'expense',
  EXPENSE_SUMMARY: 'expense_summary',
  SET_BUDGET: 'set_budget', 
  BUDGET: 'budget',
  REMAINING: 'remaining',
  EXPENSE_HELP: 'expense_help',
  
  // 待辦相關（預留）
  ADD_REMINDER: 'add_reminder',
  LIST_REMINDERS: 'list_reminders', 
  DELETE_REMINDER: 'delete_reminder',
  REMINDER_HELP: 'reminder_help',
  
  // 系統相關
  UNKNOWN: 'unknown'
};

module.exports = {
  COMMAND_MAPPING,
  CATEGORY_MAPPING,
  LANGUAGE_KEYWORDS,
  COMMAND_TYPES
};
