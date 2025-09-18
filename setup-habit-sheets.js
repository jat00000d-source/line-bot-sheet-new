require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { createServiceAccountAuth } = require('./src/utils/envValidator');

async function setupHabitSheets() {
  try {
    console.log('🔧 開始設定習慣追蹤工作表...');
    
    // 初始化 Google Sheets
    const serviceAccountAuth = createServiceAccountAuth();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID || process.env.GOOGLE_SPREADSHEET_ID;
    
    if (!spreadsheetId) {
      throw new Error('找不到 GOOGLE_SHEETS_ID 或 GOOGLE_SPREADSHEET_ID 環境變數');
    }
    
    const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
    await doc.loadInfo();
    
    console.log(`📊 連接到試算表: ${doc.title}`);
    
    // 檢查並建立 Habits 工作表
    let habitsSheet = doc.sheetsByTitle['Habits'];
    if (!habitsSheet) {
      console.log('📝 建立 Habits 工作表...');
      habitsSheet = await doc.addSheet({
        title: 'Habits',
        headerValues: [
          'habit_id',
          'user_id', 
          'habit_name',
          'category',
          'frequency_type',
          'frequency_value',
          'created_date',
          'status',
          'description'
        ]
      });
      
      // 格式化標題列
      await habitsSheet.loadCells('A1:I1');
      for (let col = 0; col < 9; col++) {
        const cell = habitsSheet.getCell(0, col);
        cell.textFormat = { bold: true };
        cell.backgroundColor = { red: 0.2, green: 0.6, blue: 0.86 };
        cell.horizontalAlignment = 'CENTER';
      }
      await habitsSheet.saveUpdatedCells();
      
      console.log('✅ Habits 工作表建立成功');
    } else {
      console.log('✅ Habits 工作表已存在');
    }
    
    // 檢查並建立 Habit_Records 工作表
    let recordsSheet = doc.sheetsByTitle['Habit_Records'];
    if (!recordsSheet) {
      console.log('📝 建立 Habit_Records 工作表...');
      recordsSheet = await doc.addSheet({
        title: 'Habit_Records',
        headerValues: [
          'record_id',
          'habit_id',
          'user_id',
          'record_date',
          'completion_status',
          'notes',
          'created_at'
        ]
      });
      
      // 格式化標題列
      await recordsSheet.loadCells('A1:G1');
      for (let col = 0; col < 7; col++) {
        const cell = recordsSheet.getCell(0, col);
        cell.textFormat = { bold: true };
        cell.backgroundColor = { red: 0.85, green: 0.92, blue: 0.83 };
        cell.horizontalAlignment = 'CENTER';
      }
      await recordsSheet.saveUpdatedCells();
      
      console.log('✅ Habit_Records 工作表建立成功');
    } else {
      console.log('✅ Habit_Records 工作表已存在');
    }
    
    // 建立範例資料（可選）
    if (process.argv.includes('--with-examples')) {
      console.log('📝 建立範例資料...');
      
      // 檢查是否已有資料
      const existingRows = await habitsSheet.getRows();
      if (existingRows.length === 0) {
        await habitsSheet.addRow({
          habit_id: 'habit_example_001',
          user_id: 'example_user',
          habit_name: '每天喝水8杯',
          category: '健康',
          frequency_type: 'daily',
          frequency_value: 1,
          created_date: '2025-09-18',
          status: 'active',
          description: '保持充足水分攝取'
        });
        
        await recordsSheet.addRow({
          record_id: 'rec_example_001',
          habit_id: 'habit_example_001',
          user_id: 'example_user',
          record_date: '2025-09-18',
          completion_status: 'completed',
          notes: '完成8杯水',
          created_at: '2025-09-18 16:00:00'
        });
        
        console.log('✅ 範例資料建立完成');
      } else {
        console.log('✅ 已有資料，跳過範例建立');
      }
    }
    
    console.log('\n🎉 習慣追蹤工作表設定完成！');
    console.log('\n📊 工作表結構:');
    console.log('   📋 Habits - 習慣基本資料');
    console.log('      • habit_id: 習慣ID');
    console.log('      • user_id: 用戶ID');
    console.log('      • habit_name: 習慣名稱');
    console.log('      • category: 分類');
    console.log('      • frequency_type: 頻率類型 (daily/weekly/monthly)');
    console.log('      • frequency_value: 頻率數值');
    console.log('      • created_date: 建立日期');
    console.log('      • status: 狀態 (active/paused)');
    console.log('      • description: 說明');
    console.log('');
    console.log('   📊 Habit_Records - 打卡記錄');
    console.log('      • record_id: 記錄ID');
    console.log('      • habit_id: 習慣ID');
    console.log('      • user_id: 用戶ID');
    console.log('      • record_date: 記錄日期');
    console.log('      • completion_status: 完成狀態 (completed/failed)');
    console.log('      • notes: 備註');
    console.log('      • created_at: 建立時間');
    console.log('');
    console.log('🚀 現在可以開始使用習慣追蹤功能了！');
    console.log('');
    console.log('💡 使用範例:');
    console.log('   • 新習慣 每天運動30分鐘');
    console.log('   • 運動✅');
    console.log('   • 運動❌');
    console.log('   • 習慣列表');
    console.log('   • 習慣統計 運動');
    
  } catch (error) {
    console.error('❌ 設定失敗:', error);
    process.exit(1);
  }
}

// 執行設定
if (require.main === module) {
  setupHabitSheets().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('❌ 執行錯誤:', error);
    process.exit(1);
  });
}

module.exports = { setupHabitSheets };
