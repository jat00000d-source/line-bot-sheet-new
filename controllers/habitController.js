const { GoogleSpreadsheet } = require('google-spreadsheet');
const moment = require('moment-timezone');
const { createServiceAccountAuth } = require('../utils/envValidator');

class GoogleSheetsHabitController {
  constructor(lineClient) {
    this.lineClient = lineClient;
    this.doc = null;
    this.isInitialized = false;
    moment.tz.setDefault('Asia/Tokyo');
  }

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

  generateId(prefix) {
    const timestamp = moment().format('YYYYMMDDHHmmss');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}_${timestamp}_${random}`;
  }

  // 修正：建立新習慣 - 移除分類，修復頻率解析
  async createHabit(userId, habitName, frequencyType = 'daily', frequencyValue = 1, description = '') {
    try {
      const doc = await this.getGoogleSheet();
      
      const habitsSheet = doc.sheetsByTitle['Habits'];
      if (!habitsSheet) {
        throw new Error('找不到 Habits 分頁');
      }

      // 檢查是否已存在
      const existingHabit = await this.findHabitByName(userId, habitName);
      if (existingHabit) {
        return {
          success: false,
          message: `❌ 習慣「${habitName}」已存在！`
        };
      }

      const habitId = this.generateId('habit');
      const createdDate = moment().format('YYYY-MM-DD');

      await habitsSheet.addRow({
        habit_id: habitId,
        user_id: userId,
        habit_name: habitName,
        frequency_type: frequencyType,
        frequency_value: frequencyValue,
        created_date: createdDate,
        status: 'active',
        description: description
      });

      console.log('✅ 習慣建立成功:', habitName, '頻率:', frequencyType, frequencyValue);
      return {
        success: true,
        habitId: habitId,
        message: `✅ 習慣「${habitName}」建立成功！\n📅 頻率：${this.getFrequencyText(frequencyType, frequencyValue)}`
      };

    } catch (error) {
      console.error('❌ 建立習慣失敗:', error);
      return {
        success: false,
        message: '❌ 建立習慣時發生錯誤，請稍後再試。'
      };
    }
  }

  // 修正：習慣打卡 - 加強查找邏輯
  async recordHabit(userId, habitName, status, notes = '') {
    try {
      console.log(`🔍 開始查找習慣: 用戶=${userId}, 習慣名稱="${habitName}"`);
      
      const doc = await this.getGoogleSheet();
      
      // 強化習慣查找
      const habit = await this.findHabitByName(userId, habitName);
      if (!habit) {
        console.log(`❌ 找不到習慣: ${habitName}`);
        
        // 列出所有習慣協助除錯
        const allUserHabits = await this.getUserHabits(userId);
        console.log('📋 用戶所有習慣:', allUserHabits.map(h => h.get('habit_name')));
        
        return {
          success: false,
          message: allUserHabits.length > 0 ? 
            `❌ 找不到習慣「${habitName}」。\n\n你的習慣：\n${allUserHabits.map(h => `• ${h.get('habit_name')}`).join('\n')}` :
            `❌ 找不到習慣「${habitName}」，請先使用「新習慣 ${habitName}」建立。`
        };
      }

      console.log(`✅ 找到習慣: ${habit.get('habit_name')}, ID: ${habit.get('habit_id')}`);

      const recordsSheet = doc.sheetsByTitle['Habit_Records'];
      if (!recordsSheet) {
        throw new Error('找不到 Habit_Records 分頁');
      }

      const recordDate = moment().format('YYYY-MM-DD');
      const createdAt = moment().format('YYYY-MM-DD HH:mm:ss');

      // 檢查今日是否已打卡
      const rows = await recordsSheet.getRows();
      const todayRecord = rows.find(row => 
        row.get('habit_id') === habit.get('habit_id') && 
        row.get('user_id') === userId && 
        row.get('record_date') === recordDate
      );

      if (todayRecord) {
        console.log('📝 更新現有記錄');
        todayRecord.set('completion_status', status);
        todayRecord.set('notes', notes);
        await todayRecord.save();
      } else {
        console.log('📝 新增打卡記錄');
        const recordId = this.generateId('rec');
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
        message: '❌ 打卡時發生錯誤，請稍後再試。'
      };
    }
  }

  // 新增：獲取用戶所有習慣
  async getUserHabits(userId) {
    try {
      const doc = await this.getGoogleSheet();
      const habitsSheet = doc.sheetsByTitle['Habits'];
      if (!habitsSheet) return [];
      
      const rows = await habitsSheet.getRows();
      return rows.filter(row => 
        row.get('user_id') === userId && 
        row.get('status') === 'active'
      );
    } catch (error) {
      console.error('❌ 獲取用戶習慣失敗:', error);
      return [];
    }
  }

  // 修正：根據名稱找習慣 - 加強匹配邏輯
  async findHabitByName(userId, habitName) {
    try {
      const doc = await this.getGoogleSheet();
      const habitsSheet = doc.sheetsByTitle['Habits'];
      if (!habitsSheet) return null;
      
      const rows = await habitsSheet.getRows();
      
      // 精確匹配
      let habit = rows.find(row => 
        row.get('user_id') === userId && 
        row.get('habit_name') === habitName && 
        row.get('status') === 'active'
      );
      
      // 如果找不到，嘗試忽略大小寫和空格的模糊匹配
      if (!habit) {
        const normalizedInput = habitName.trim().toLowerCase();
        habit = rows.find(row => 
          row.get('user_id') === userId && 
          row.get('habit_name') && 
          row.get('habit_name').trim().toLowerCase() === normalizedInput && 
          row.get('status') === 'active'
        );
      }
      
      return habit;
    } catch (error) {
      console.error('❌ 查找習慣失敗:', error);
      return null;
    }
  }

  async getHabitList(userId) {
    try {
      const doc = await this.getGoogleSheet();
      const habitsSheet = doc.sheetsByTitle['Habits'];
      if (!habitsSheet) {
        return {
          success: false,
          message: '❌ 系統尚未設定習慣追蹤功能。'
        };
      }

      const userHabits = await this.getUserHabits(userId);

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

  async calculateHabitStats(userId, habitId) {
    try {
      const doc = await this.getGoogleSheet();
      const recordsSheet = doc.sheetsByTitle['Habit_Records'];
      if (!recordsSheet) return { currentStreak: 0, maxStreak: 0, weeklyRate: 0, monthlyRate: 0 };
      
      const rows = await recordsSheet.getRows();
      
      const userRecords = rows.filter(row => 
        row.get('user_id') === userId && row.get('habit_id') === habitId
      ).sort((a, b) => new Date(b.get('record_date')) - new Date(a.get('record_date')));

      // 計算連續天數
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

      // 計算月完成率
      const thisMonthStart = moment().startOf('month');
      const thisMonthRecords = userRecords.filter(record => 
        moment(record.get('record_date')).isSameOrAfter(thisMonthStart)
      );

      const monthlyRate = thisMonthRecords.length === 0 ? 0 : 
        Math.round((thisMonthRecords.filter(r => r.get('completion_status') === 'completed').length / thisMonthRecords.length) * 100);

      return {
        currentStreak,
        maxStreak,
        monthlyRate
      };
    } catch (error) {
      console.error('❌ 計算統計失敗:', error);
      return { currentStreak: 0, maxStreak: 0, monthlyRate: 0 };
    }
  }

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
              command.frequencyType,
              command.frequencyValue,
              command.description
            )).message
          };

        case 'record':
          return {
            type: 'text',
            text: (await this.recordHabit(
              userId,
              command.habitName,
              command.status,
              command.notes
            )).message
          };

        case 'list':
          return {
            type: 'text',
            text: (await this.getHabitList(userId)).message
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
