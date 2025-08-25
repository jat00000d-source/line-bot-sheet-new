// constants/todoMessages.js - 多語言訊息和常數定義

// 語言代碼
const LANGUAGES = {
  ZH: 'zh',
  JA: 'ja'
};

// 指令關鍵字
const COMMAND_KEYWORDS = {
  zh: {
    // 代辦指令
    add: ['新增代辦', '新增待辦', '代辦', '待辦', '添加代辦', '加代辦'],
    list: ['查看代辦', '查看待辦', '代辦清單', '待辦清單', '所有代辦', '代辦列表'],
    complete: ['完成代辦', '完成待辦', '完成', '完成了'],
    delete: ['刪除代辦', '刪除待辦', '刪除', '移除代辦', '取消代辦'],
    search: ['搜尋代辦', '搜索代辦', '找代辦', '查找代辦'],
    
    // 提醒指令
    remind: ['提醒我', '提醒', '記得', '別忘記'],
    reminder: ['設定提醒', '添加提醒', '新增提醒'],
    reminders: ['查看提醒', '提醒清單', '所有提醒'],
    cancel_reminder: ['取消提醒', '刪除提醒', '移除提醒'],
    
    // 時間關鍵字
    daily: ['每天', '每日'],
    weekly: ['每週', '每星期'],
    monthly: ['每月', '每個月'],
    yearly: ['每年', '每一年'],
    
    // 系統指令
    help: ['幫助', '說明', '指令', '怎麼用'],
    status: ['狀態', '系統狀態', '統計'],
    settings: ['設定', '設置', '偏好設定']
  },
  
  ja: {
    // Todo指令
    add: ['タスク追加', 'やることを追加', 'todo追加', 'タスクを追加'],
    list: ['タスク一覧', 'やること一覧', 'todo一覧', 'タスクを見る'],
    complete: ['タスク完了', '完了', 'やることを完了', '完了した'],
    delete: ['タスク削除', 'やることを削除', '削除', 'タスクを消す'],
    search: ['タスク検索', 'やることを探す', '検索'],
    
    // リマインダー指令
    remind: ['リマインド', '思い出させて', '忘れないで'],
    reminder: ['リマインダー設定', 'リマインダー追加'],
    reminders: ['リマインダー一覧', 'すべてのリマインダー'],
    cancel_reminder: ['リマインダーキャンセル', 'リマインダー削除'],
    
    // 時間キーワード
    daily: ['毎日', '日々'],
    weekly: ['毎週', '週間'],
    monthly: ['毎月', '月間'],
    yearly: ['毎年', '年間'],
    
    // システム指令
    help: ['ヘルプ', '使い方', 'コマンド'],
    status: ['ステータス', 'システム状態', '統計'],
    settings: ['設定', '環境設定']
  }
};

// 訊息模板
const MESSAGES = {
  zh: {
    // 成功訊息
    todo_added: '✅ 代辦事項已新增！',
    todo_completed: '✅ 代辦事項已完成！',
    todo_deleted: '🗑️ 代辦事項已刪除！',
    reminder_added: '⏰ 提醒已設定！',
    reminder_deleted: '🗑️ 提醒已取消！',
    
    // 錯誤訊息
    todo_not_found: '❌ 找不到指定的代辦事項',
    reminder_not_found: '❌ 找不到指定的提醒',
    invalid_time: '❌ 時間格式不正確',
    no_todos: '📝 目前沒有代辦事項',
    no_reminders: '⏰ 目前沒有提醒',
    
    // 系統訊息
    help_message: '🤖 我可以幫您管理代辦事項和提醒！\n\n📝 代辦功能：\n• 新增代辦 [內容]\n• 查看代辦\n• 完成代辦 [編號]\n\n⏰ 提醒功能：\n• 提醒我 [時間] [內容]\n• 查看提醒\n• 取消提醒 [編號]',
    unknown_command: '❓ 抱歉，我不太理解您的指令。請輸入「幫助」查看可用指令。',
    
    // 狀態標籤
    priority_high: '🔴 高',
    priority_medium: '🟡 中',
    priority_low: '🟢 低',
    status_pending: '⏳ 待完成',
    status_completed: '✅ 已完成',
    
    // 按鈕文字
    button_complete: '完成',
    button_delete: '刪除',
    button_snooze: '稍後提醒',
    button_details: '詳細'
  },
  
  ja: {
    // 成功メッセージ
    todo_added: '✅ タスクを追加しました！',
    todo_completed: '✅ タスクを完了しました！',
    todo_deleted: '🗑️ タスクを削除しました！',
    reminder_added: '⏰ リマインダーを設定しました！',
    reminder_deleted: '🗑️ リマインダーをキャンセルしました！',
    
    // エラーメッセージ
    todo_not_found: '❌ 指定されたタスクが見つかりません',
    reminder_not_found: '❌ 指定されたリマインダーが見つかりません',
    invalid_time: '❌ 時間の形式が正しくありません',
    no_todos: '📝 現在タスクはありません',
    no_reminders: '⏰ 現在リマインダーはありません',
    
    // システムメッセージ
    help_message: '🤖 タスクとリマインダーの管理をお手伝いします！\n\n📝 タスク機能：\n• タスク追加 [内容]\n• タスク一覧\n• タスク完了 [番号]\n\n⏰ リマインダー機能：\n• リマインド [時間] [内容]\n• リマインダー一覧\n• リマインダーキャンセル [番号]',
    unknown_command: '❓ 申し訳ありませんが、コマンドを理解できませんでした。「ヘルプ」と入力してください。',
    
    // ステータスラベル
    priority_high: '🔴 高',
    priority_medium: '🟡 中',
    priority_low: '🟢 低',
    status_pending: '⏳ 未完了',
    status_completed: '✅ 完了',
    
    // ボタンテキスト
    button_complete: '完了',
    button_delete: '削除',
    button_snooze: '後で',
    button_details: '詳細'
  }
};

// 優先級定義
const PRIORITIES = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

// 提醒類型
const REMINDER_TYPES = {
  ONCE: 'once',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  CUSTOM: 'custom'
};

// 時間解析模式
const TIME_PATTERNS = {
  zh: {
    absolute: [
      /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})日?\s*(\d{1,2}):(\d{1,2})/,
      /(\d{1,2})[月\-\/](\d{1,2})日?\s*(\d{1,2}):(\d{1,2})/,
      /(\d{1,2}):(\d{1,2})/,
      /(明天|明日)\s*(\d{1,2}):(\d{1,2})/,
      /(後天)\s*(\d{1,2}):(\d{1,2})/
    ],
    relative: [
      /(今天|今日)/,
      /(明天|明日)/,
      /(後天)/,
      /(\d+)\s*天後/,
      /(\d+)\s*小時後/,
      /(\d+)\s*分鐘後/,
      /(下週|下星期)/,
      /(下個月|下月)/
    ],
    recurring: [
      /每天\s*(\d{1,2}):(\d{1,2})/,
      /每週([一二三四五六日天])\s*(\d{1,2}):(\d{1,2})/,
      /每月(\d{1,2})號\s*(\d{1,2}):(\d{1,2})/,
      /每(\d+)天/,
      /每(\d+)週/,
      /每(\d+)個月/
    ]
  },
  
  ja: {
    absolute: [
      /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})日?\s*(\d{1,2}):(\d{1,2})/,
      /(\d{1,2})[月\-\/](\d{1,2})日?\s*(\d{1,2}):(\d{1,2})/,
      /(\d{1,2}):(\d{1,2})/,
      /(明日|あした)\s*(\d{1,2}):(\d{1,2})/,
      /(あさって|明後日)\s*(\d{1,2}):(\d{1,2})/
    ],
    relative: [
      /(今日|きょう)/,
      /(明日|あした)/,
      /(明後日|あさって)/,
      /(\d+)\s*日後/,
      /(\d+)\s*時間後/,
      /(\d+)\s*分後/,
      /(来週|らいしゅう)/,
      /(来月|らいげつ)/
    ],
    recurring: [
      /毎日\s*(\d{1,2}):(\d{1,2})/,
      /毎週([月火水木金土日])\s*(\d{1,2}):(\d{1,2})/,
      /毎月(\d{1,2})日\s*(\d{1,2}):(\d{1,2})/,
      /(\d+)日ごと/,
      /(\d+)週間ごと/,
      /(\d+)ヶ月ごと/
    ]
  }
};

// 導出所有常數
module.exports = {
  LANGUAGES,
  COMMAND_KEYWORDS,
  MESSAGES,
  PRIORITIES,
  REMINDER_TYPES,
  TIME_PATTERNS
};
