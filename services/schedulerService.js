const cron = require('node-cron');
const moment = require('moment-timezone');

class SchedulerService {
  static start(todoController) {
    try {
      // 每分鐘檢查提醒
      cron.schedule('* * * * *', async () => {
        try {
          const now = moment().tz('Asia/Tokyo');
          console.log(`⏰ [${now.format('YYYY-MM-DD HH:mm:ss JST')}] 檢查提醒中...`);
          
          await todoController.checkAndSendReminders();
          
        } catch (error) {
          console.error('❌ 排程器錯誤:', error);
        }
      }, {
        timezone: 'Asia/Tokyo'
      });

      // 每小時執行一次系統狀態報告
      cron.schedule('0 * * * *', () => {
        const now = moment().tz('Asia/Tokyo');
        console.log(`📊 [${now.format('YYYY-MM-DD HH:mm:ss JST')}] 系統狀態正常 - 提醒系統運行中`);
      }, {
        timezone: 'Asia/Tokyo'
      });
      
      console.log('⏰ 提醒排程器已啟動 (JST 時區)');
      console.log(`🕐 目前 JST 時間: ${moment().tz('Asia/Tokyo').format('YYYY-MM-DD HH:mm:ss JST')}`);
      console.log('📅 排程設定:');
      console.log('   - 每分鐘檢查提醒');
      console.log('   - 每小時系統狀態報告');
      
    } catch (error) {
      console.error('❌ 排程器啟動失敗:', error);
    }
  }
}

module.exports = SchedulerService;
