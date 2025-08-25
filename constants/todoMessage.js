// constants/todoMessages.js - 簡化版本

module.exports = {
  // 指令關鍵字
  COMMANDS: {
    ADD: ['新增', '添加', '加入'],
    LIST: ['查看', '列表', '清單'],
    COMPLETE: ['完成', '完成了'],
    DELETE: ['刪除', '移除'],
    STATS: ['統計', '狀況', '狀態']
  },
  
  // 系統訊息
  MESSAGES: {
    ADDED: '✅ 已新增代辦事項',
    COMPLETED: '🎉 已完成代辦事項',
    DELETED: '🗑️ 已刪除代辦事項',
    NOT_FOUND: '❌ 找不到指定的代辦事項',
    EMPTY_LIST: '📋 目前沒有代辦事項',
    ERROR: '❌ 處理代辦指令時發生錯誤',
    INVALID_ID: '❌ 請提供正確的代辦編號',
    LOADING: '⏳ 系統載入中...'
  },
  
  // 表情符號
  ICONS: {
    TODO: '📝',
    COMPLETED: '✅',
    PENDING: '🔴',
    TIME: '📅',
    ID: '🆔',
    STATS: '📊'
  },
  
  // 優先級
  PRIORITY: {
    HIGH: '🔴 高',
    NORMAL: '🟡 中',
    LOW: '🟢 低'
  }
};
