// config/config.js
require('dotenv').config();

// 驗證必要的環境變數
const requiredEnvVars = [
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET', 
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'GOOGLE_SPREADSHEET_ID'
];

// 檢查環境變數是否存在
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`❌ 缺少必要的環境變數: ${varName}`);
    process.exit(1);
  }
});

const config = {
  // LINE Bot 設定
  line: {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
  },
  
  // Google Sheets 設定
  google: {
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  },
  
  // 伺服器設定
  server: {
    port: process.env.PORT || 3000,
  },
  
  // 功能開關（方便後續開發測試）
  features: {
    expenseTracking: true,      // 記帳功能
    reminderSystem: false,      // 待辦功能（暫時關閉）
    weatherIntegration: false,  // 天氣整合（預留）
    debugMode: process.env.NODE_ENV !== 'production',
  }
};

// 輸出配置資訊（不包含敏感資料）
if (config.features.debugMode) {
  console.log('📋 系統配置載入完成:');
  console.log(`  - 伺服器埠口: ${config.server.port}`);
  console.log(`  - 記帳功能: ${config.features.expenseTracking ? '啟用' : '停用'}`);
  console.log(`  - 待辦功能: ${config.features.reminderSystem ? '啟用' : '停用'}`);
  console.log(`  - 除錯模式: ${config.features.debugMode ? '啟用' : '停用'}`);
}

module.exports = config;
