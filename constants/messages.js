// constants/messages.js

const ERROR_MESSAGES = {
  zh: {
    SYSTEM_ERROR: '系統發生錯誤，請稍後再試',
    PARSE_ERROR: '無法識別輸入格式',
    INVALID_AMOUNT: '找不到金額',
    INVALID_ITEM: '找不到消費項目',
    UNSUPPORTED_COMMAND: '不支援的指令',
    BUDGET_SET_ERROR: '預算設定失敗，請稍後再試',
    EXPENSE_ADD_ERROR: '記帳失敗，請稍後再試或檢查格式是否正確'
  },
  
  ja: {
    SYSTEM_ERROR: 'システムエラーが発生しました。しばらく後にもう一度お試しください',
    PARSE_ERROR: '入力形式を認識できませんでした',
    INVALID_AMOUNT: '金額が見つかりませんでした',
    INVALID_ITEM: '項目が見つかりませんでした', 
    UNSUPPORTED_COMMAND: '未対応のコマンドです',
    BUDGET_SET_ERROR: '予算設定に失敗しました。しばらく後にもう一度お試しください',
    EXPENSE_ADD_ERROR: '記録に失敗しました。しばらく後にもう一度お試しいただくか、形式を確認してください'
  }
};

const SUCCESS_MESSAGES = {
  zh: {
    EXPENSE_ADDED: '✅ 記帳成功！',
    BUDGET_SET: '💰 本月預算已設定為',
    CONFIG_LOADED: '📋 系統配置載入完成'
  },
  
  ja: {
    EXPENSE_ADDED: '✅ 記録完了！',
    BUDGET_SET: '💰 今月の予算を',
    CONFIG_LOADED: '📋 システム設定が読み込まれました'
  }
};

const PROMPT_MESSAGES = {
  zh: {
    INPUT_FORMAT_HINT: '請輸入正確格式的記帳資料或輸入「說明」查看使用方法',
    BUDGET_FORMAT_HINT: '請正確輸入預算金額，例如：設定預算 50000'
  },
  
  ja: {
    INPUT_FORMAT_HINT: '正しい形式の記帳データを入力するか、「説明」で使用方法を確認してください',
    BUDGET_FORMAT_HINT: '予算金額を正しく入力してください。例：予算設定 50000'
  }
};

module.exports = {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  PROMPT_MESSAGES
};
