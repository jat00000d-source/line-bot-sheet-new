// config/config.js (更新版 - 支援待辦功能)
require('dotenv').config();

const config = {
  // LINE Bot 設定
  line: {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET
  },
  
  // Google Sheets 設定
  googleSheets: {
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    serviceAccountKeyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || 'service-account-key.json',
    // 工作表名稱
    sheets: {
      expenses: 'expenses',
      budgets: 'budgets', 
      todos: 'todos',
      reminders: 'reminders'
    }
  },
  
  // 伺服器設定
  server: {
    port: process.env.PORT || 3000
  },
  
  // 功能開關
  features: {
    expenseTracking: true,
    todoSystem: true,
    reminderSystem: true,
    debugMode: process.env.DEBUG_MODE === 'true'
  },
  
  // 應用程式設定
  app: {
    timezone: process.env.TIMEZONE || 'Asia/Taipei',
    defaultLanguage: 'zh',
    supportedLanguages: ['zh', 'ja']
  },
  
  // 待辦系統設定
  todo: {
    maxTodos: 100, // 每個使用者最多100個待辦
    maxTitleLength: 100, // 標題最大長度
    defaultPriority: 'medium',
    priorities: ['low', 'medium', 'high', 'urgent']
  },
  
  // 提醒系統設定
  reminder: {
    maxReminders: 50, // 每個使用者最多50個提醒
    maxTitleLength: 100,
    checkInterval: 60000, // 檢查間隔：60秒
    types: {
      once: 'once',        // 一次性提醒
      daily: 'daily',      // 每日提醒
      weekly: 'weekly',    // 每週提醒
      monthly: 'monthly',  // 每月提醒
      custom: 'custom'     // 自定義間隔
    },
    weekdays: {
      zh: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
      ja: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日']
    },
    months: {
      zh: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
      ja: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
    }
  },
  
  // 記帳系統設定（保持原有）
  expense: {
    defaultCurrency: 'TWD',
    categories: [
      '食物', '交通', '娛樂', '購物', '醫療', '教育', '其他',
      '食事', '交通費', 'エンターテイメント', '買い物', '医療', '教育', 'その他'
    ],
    maxDescriptionLength: 100
  },
  
  // 日期格式設定
  dateFormats: {
    display: {
      zh: 'YYYY年MM月DD日 HH:mm',
      ja: 'YYYY年MM月DD日 HH:mm'
    },
    storage: 'YYYY-MM-DD HH:mm:ss'
  },
  
  // 錯誤訊息
  errorMessages: {
    zh: {
      systemError: '系統發生錯誤，請稍後再試',
      invalidCommand: '無法識別的指令，請輸入 help 查看使用說明',
      invalidDate: '無效的日期格式',
      todoNotFound: '找不到指定的待辦事項',
      reminderNotFound: '找不到指定的提醒',
      maxTodosExceeded: '待辦事項數量已達上限',
      maxRemindersExceeded: '提醒數量已達上限'
    },
    ja: {
      systemError: 'システムエラーが発生しました。しばらく後にもう一度お試しください',
      invalidCommand: '認識できないコマンドです。「help」と入力してください',
      invalidDate: '無効な日付形式です',
      todoNotFound: '指定されたTodoが見つかりません',
      reminderNotFound: '指定されたリマインドが見つかりません',
      maxTodosExceeded: 'Todoの最大数に達しました',
      maxRemindersExceeded: 'リマインドの最大数に達しました'
    }
  }
};

// 環境變數驗證
function validateConfig() {
  const required = [
    'CHANNEL_ACCESS_TOKEN',
    'CHANNEL_SECRET',
    'GOOGLE_SPREADSHEET_ID'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ 缺少必要的環境變數:', missing.join(', '));
    console.error('請檢查 .env 檔案或環境設定');
    process.exit(1);
  }
  
  console.log('✅ 環境變數驗證通過');
}

// 在模組載入時驗證配置
if (process.env.NODE_ENV !== 'test') {
  validateConfig();
}

module.exports = config;
