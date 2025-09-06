// 工具模組 - 環境變數驗證器
const { JWT } = require('google-auth-library');

function validateEnvironment() {
  const required = ['CHANNEL_ACCESS_TOKEN', 'CHANNEL_SECRET', 'GOOGLE_SPREADSHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ 缺少必要的環境變數:', missing.join(', '));
    process.exit(1);
  }
}

function createServiceAccountAuth() {
  return new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

module.exports = {
  validateEnvironment,
  createServiceAccountAuth
};
