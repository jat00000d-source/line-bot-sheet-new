const { GoogleSpreadsheet } = require('google-spreadsheet');
const moment = require('moment-timezone');
const { createServiceAccountAuth } = require('../utils/envValidator');

class GoogleSheetsHabitController {
  constructor(lineClient) {
    this.lineClient = lineClient;
    this.doc = null; // 延遲初始化
    this.isInitialized = false;
    
    // 設定時區
    moment.tz.setDefault('Asia/Tokyo');
  }

  // 修正初始化方法，參考 expenseController.js 的方式
  async getGoogleSheet() {
    if (!this.doc) {
      const serviceAccountAuth = createServiceAccountAuth();
      this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID || process.env.GOOGLE_SPREADSHEET_ID, serviceAccountAuth);
      await this.doc.loadInfo();
      this.isInitialized = true;
      console.log('✅ HabitController 初始化成功');
    }
    return this.doc;
  }

  async initialize() {
    if (this.isInitialized) return true;
    
    try {
      await this.getGoogleSheet();
      return true;
    } catch (error) {
      console.error('❌ HabitController 初始化失敗:', error);
      return false;
    }
  }

  // 生成唯一ID
  generateId(prefix) {
    const timestamp = moment().format('YYYYMMDDHHmmss');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}_${timestamp}_${random}`;
  }

  // 建立新習慣
  async createHabit(userId, habitName, category = '一般', frequencyType = 'daily', frequencyValue = 1, description = '') {
    try {
      const doc = await this.getGoogleSheet();
      
      const habitsSheet = doc.sheetsByTitle['Habits'];
      if (!habitsSheet) {
        throw new Error('找不到 Habits 分頁，請先執行 setup-habit-sheets.js 建立分頁');
      }

      const habitId = this.generateId('habit');
      const createdDate = moment().format('YYYY-MM-DD');

      await habitsSheet.addRow({
        habit_id: habitId,
        user_id: userId,
        habit_name: habitName,
        category: category,
        frequency_type: frequencyType,
        frequency_value: frequencyValue,
        created_date: createdDate,
        status: 'active',
        description: description
      });

      console.log('✅ 習慣建立成功:', habitName);
      return {
        success: true,
        habitId: habitId,
        message: `✅ 習慣「${habitName}」建立成功！\n📅 頻率：${this.getFrequencyText(frequencyType, frequencyValue)}\n🏷️ 分類：${category}`
      };

    } catch (error) {
      console.error('❌ 建立習慣失敗:', error);
      return {
        success: false,
        message: error.message.includes('找不到 Habits 分頁') ? 
          '❌ 系統尚未設定習慣追蹤功能，請聯繫管理員。' :
          '❌ 建立習慣時發生錯誤，請稍後再試。'
      };
    }
  }

  // 習慣打卡
  async recordHabit(userId, habitName, status, notes = '') {
    try {
      const doc = await this.getGoogleSheet();
      
      // 先找到習慣
      const habit = await this.findHabitByName(userId, habitName);
      if (!habit) {
        return {
          success: false,
          message: `❌ 找不到習慣「${habitName}」，請先使用「新習慣」指令建立。`
        };
      }

      const recordsSheet = doc.sheetsByTitle['Habit_Records'];
      if (!recordsSheet) {
        throw new Error('找不到 Habit_Records 分頁，請先執行 setup-habit-sheets.js 建立分頁');
      }

      const recordId = this.generateId('rec');
      const recordDate = moment().format('YYYY-MM-DD');
      const createdAt = moment().format('YYYY-MM-DD HH:mm:ss');

      // 檢查今天是否已經打卡
      const rows = await recordsSheet.getRows();
      const todayRecord = rows.find(row => 
        row.get('habit_id') === habit.get('habit_id') && 
        row.get('user_id') === userId && 
        row.get('record_date') === recordDate
      );

      if (todayRecord) {
        // 更新現有記錄
        todayRecord.set('completion_status', status);
        todayRecord.set('notes', notes);
        await todayRecord.save();
      } else {
        // 新增記錄
        await recordsSheet.addRow({
          record_id: recordId,
          habit_id: habit.get('habit_id'),
          user_id: userId,
          record_date: recordDate,
          completion_status: status,
          notes: notes,
          created_at: createdAt
        });
      }

      // 計算統計數據
      const stats = await this.calculateHabitStats(userId, habit.get('habit_id'));
      
      const statusIcon = status === 'completed' ? '✅' : '❌';
      const encouragement = this.getEncouragement(stats.currentStreak, status === 'completed');

      return {
        success: true,
        message: `${statusIcon} 習慣「${habitName}」打卡完成！\n${encouragement}\n📊 連續天數：${stats.currentStreak} 天\n📈 本月完成率：${stats.monthlyRate}%`
      };

    } catch (error) {
      console.error('❌ 習慣打卡失敗:', error);
      return {
        success: false,
        message: error.message.includes('找不到 Habit_Records 分頁') ? 
          '❌ 系統尚未設定習慣追蹤功能，請聯繫管理員。' :
          '❌ 打卡時發生錯誤，請稍後再試。'
      };
    }
  }

  // 批量打卡
  async batchRecord(userId, habitStatuses) {
    const results = [];
    
    for (const { habitName, status, notes } of habitStatuses) {
      const result = await this.recordHabit(userId, habitName, status, notes);
      results.push({ habitName, ...result });
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    if (successCount === totalCount) {
      return {
        success: true,
        message: `✅ 批量打卡完成！成功記錄 ${successCount} 個習慣。`
      };
    } else {
      const failedHabits = results.filter(r => !r.success).map(r => r.habitName);
      return {
        success: false,
        message: `⚠️ 部分打卡失敗。成功：${successCount}，失敗：${totalCount - successCount}\n失敗的習慣：${failedHabits.join('、')}`
      };
    }
  }

  // 查詢習慣狀態
  async getHabitStatus(userId, habitName) {
    try {
      const doc = await this.getGoogleSheet();

      const habit = await this.findHabitByName(userId, habitName);
      if (!habit) {
        return {
          success: false,
          message: `❌ 找不到習慣「${habitName}」`
        };
      }

      const stats = await this.calculateHabitStats(userId, habit.get('habit_id'));
      const recentRecords = await this.getRecentRecords(userId, habit.get('habit_id'), 7);

      let statusText = `📊 習慣「${habitName}」狀態報告\n\n`;
      statusText += `🎯 連續完成：${stats.currentStreak} 天\n`;
      statusText += `📈 本週完成率：${stats.weeklyRate}%\n`;
      statusText += `📈 本月完成率：${stats.monthlyRate}%\n`;
      statusText += `🏆 最長連續：${stats.maxStreak} 天\n\n`;
      
      statusText += `📅 近7天記錄：\n`;
      recentRecords.forEach(record => {
        const icon = record.get('completion_status') === 'completed' ? '✅' : 
                     record.get('completion_status') === 'failed' ? '❌' : '⭕';
        statusText += `${record.get('record_date')} ${icon}\n`;
      });

      return {
        success: true,
        message: statusText
      };

    } catch (error) {
      console.error('❌ 查詢習慣狀態失敗:', error);
      return {
        success: false,
        message: '❌ 查詢狀態時發生錯誤，請稍後再試。'
      };
    }
  }

  // 查詢習慣列表
  async getHabitList(userId) {
    try {
      const doc = await this.getGoogleSheet();

      const habitsSheet = doc.sheetsByTitle['Habits'];
      if (!habitsSheet) {
        return {
          success: false,
          message: '❌ 系統尚未設定習慣追蹤功能，請聯繫管理員。'
        };
      }

      const rows = await habitsSheet.getRows();
      
      const userHabits = rows.filter(row => 
        row.get('user_id') === userId && row.get('status') === 'active'
      );

      if (userHabits.length === 0) {
        return {
          success: true,
          message: '📝 你還沒有建立任何習慣，使用「新習慣 [習慣名稱]」來建立第一個習慣吧！'
        };
      }

      let listText = `📋 你的習慣列表 (共 ${userHabits.length} 個)\n\n`;
      
      for (const habit of userHabits) {
        const stats = await this.calculateHabitStats(userId, habit.get('habit_id'));
        const frequencyText = this.getFrequencyText(habit.get('frequency_type'), habit.get('frequency_value'));
        
        listText += `🎯 ${habit.get('habit_name')}\n`;
        listText += `   📅 ${frequencyText} | 🔥 連續 ${stats.currentStreak} 天\n`;
        listText += `   📊 本月完成率 ${stats.monthlyRate}%\n\n`;
      }

      return {
        success: true,
        message: listText
      };

    } catch (error) {
      console.error('❌ 查詢習慣列表失敗:', error);
      return {
        success: false,
        message: '❌ 查詢列表時發生錯誤，請稍後再試。'
      };
    }
  }

  // 暫停/恢復習慣
  async toggleHabitStatus(userId, habitName, action) {
    try {
      const doc = await this.getGoogleSheet();

      const habitsSheet = doc.sheetsByTitle['Habits'];
      const rows = await habitsSheet.getRows();
      
      const habitRow = rows.find(row => 
        row.get('user_id') === userId && 
        row.get('habit_name') === habitName
      );

      if (!habitRow) {
        return {
          success: false,
          message: `❌ 找不到習慣「${habitName}」`
        };
      }

      const newStatus = action === 'pause' ? 'paused' : 'active';
      habitRow.set('status', newStatus);
      await habitRow.save();

      const actionText = action === 'pause' ? '暫停' : '恢復';
      return {
        success: true,
        message: `✅ 習慣「${habitName}」已${actionText}`
      };

    } catch (error) {
      console.error('❌ 切換習慣狀態失敗:', error);
      return {
        success: false,
        message: '❌ 操作失敗，請稍後再試。'
      };
    }
  }

  // 輔助方法：根據名稱找習慣
  async findHabitByName(userId, habitName) {
    const doc = await this.getGoogleSheet();
    const habitsSheet = doc.sheetsByTitle['Habits'];
    if (!habitsSheet) return null;
    
    const rows = await habitsSheet.getRows();
    
    return rows.find(row => 
      row.get('user_id') === userId && 
      row.get('habit_name') === habitName && 
      row.get('status') === 'active'
    );
  }

  // 輔助方法：計算習慣統計
  async calculateHabitStats(userId, habitId) {
    const doc = await this.getGoogleSheet();
    const recordsSheet = doc.sheetsByTitle['Habit_Records'];
    if (!recordsSheet) return { currentStreak: 0, maxStreak: 0, weeklyRate: 0, monthlyRate: 0 };
    
    const rows = await recordsSheet.getRows();
    
    const userRecords = rows.filter(row => 
      row.get('user_id') === userId && row.get('habit_id') === habitId
    ).sort((a, b) => new Date(b.get('record_date')) - new Date(a.get('record_date')));

    // 計算當前連續天數
    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;

    for (let i = 0; i < userRecords.length; i++) {
      if (userRecords[i].get('completion_status') === 'completed') {
        if (i === 0 || moment(userRecords[i-1].get('record_date')).diff(moment(userRecords[i].get('record_date')), 'days') === 1) {
          tempStreak++;
          if (i === 0) currentStreak = tempStreak;
        } else {
          tempStreak = 1;
        }
        maxStreak = Math.max(maxStreak, tempStreak);
      } else {
        tempStreak = 0;
        if (i === 0) currentStreak = 0;
      }
    }

    // 計算本週和本月完成率
    const thisWeekStart = moment().startOf('week');
    const thisMonthStart = moment().startOf('month');

    const thisWeekRecords = userRecords.filter(record => 
      moment(record.get('record_date')).isSameOrAfter(thisWeekStart)
    );
    const thisMonthRecords = userRecords.filter(record => 
      moment(record.get('record_date')).isSameOrAfter(thisMonthStart)
    );

    const weeklyRate = thisWeekRecords.length === 0 ? 0 : 
      Math.round((thisWeekRecords.filter(r => r.get('completion_status') === 'completed').length / thisWeekRecords.length) * 100);
    
    const monthlyRate = thisMonthRecords.length === 0 ? 0 : 
      Math.round((thisMonthRecords.filter(r => r.get('completion_status') === 'completed').length / thisMonthRecords.length) * 100);

    return {
      currentStreak,
      maxStreak,
      weeklyRate,
      monthlyRate
    };
  }

  // 輔助方法：獲取最近記錄
  async getRecentRecords(userId, habitId, days = 7) {
    const doc = await this.getGoogleSheet();
    const recordsSheet = doc.sheetsByTitle['Habit_Records'];
    if (!recordsSheet) return [];
    
    const rows = await recordsSheet.getRows();
    
    const startDate = moment().subtract(days - 1, 'days').format('YYYY-MM-DD');
    
    return rows.filter(row => 
      row.get('user_id') === userId && 
      row.get('habit_id') === habitId && 
      row.get('record_date') >= startDate
    ).sort((a, b) => new Date(b.get('record_date')) - new Date(a.get('record_date')));
  }

  // 輔助方法：獲取頻率文字
  getFrequencyText(type, value) {
    switch (type) {
      case 'daily':
        return '每天';
      case 'weekly':
        return `每週${value}次`;
      case 'monthly':
        return `每月${value}次`;
      default:
        return '自訂頻率';
    }
  }

  // 輔助方法：獲取鼓勵語句
  getEncouragement(streak, isCompleted) {
    if (!isCompleted) {
      return '💪 沒關係，明天繼續加油！';
    }

    if (streak === 0) {
      return '🌟 開始第一天，加油！';
    } else if (streak < 3) {
      return '👍 很棒，繼續保持！';
    } else if (streak < 7) {
      return '🔥 連續完成中，你很厲害！';
    } else if (streak < 21) {
      return '⭐ 超過一週了，習慣正在養成！';
    } else if (streak < 66) {
      return '🏆 21天達成，你正在建立強大的習慣！';
    } else {
      return '🎉 習慣大師！你已經完全掌握這個習慣了！';
    }
  }

  // 主要處理函數
  async handleHabit(event, command, language = 'zh') {
    const userId = event.source.userId;
    
    try {
      switch (command.action) {
        case 'create':
          return {
            type: 'text',
            text: (await this.createHabit(
              userId,
              command.habitName,
              command.category,
              command.frequencyType,
              command.frequencyValue,
              command.description
            )).message
          };

        case 'record':
          if (command.batch) {
            return {
              type: 'text',
              text: (await this.batchRecord(userId, command.habitStatuses)).message
            };
          } else {
            return {
              type: 'text',
              text: (await this.recordHabit(
                userId,
                command.habitName,
                command.status,
                command.notes
              )).message
            };
          }

        case 'status':
          return {
            type: 'text',
            text: (await this.getHabitStatus(userId, command.habitName)).message
          };

        case 'list':
          return {
            type: 'text',
            text: (await this.getHabitList(userId)).message
          };

        case 'pause':
        case 'resume':
          return {
            type: 'text',
            text: (await this.toggleHabitStatus(userId, command.habitName, command.action)).message
          };

        default:
          return {
            type: 'text',
            text: '❓ 不支援的習慣指令。使用「說明」查看可用指令。'
          };
      }
    } catch (error) {
      console.error('❌ 處理習慣指令失敗:', error);
      return {
        type: 'text',
        text: '❌ 處理習慣指令時發生錯誤，請稍後再試。'
      };
    }
  }
}

module.exports = GoogleSheetsHabitController;
