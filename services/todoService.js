// services/todoService.js
const GoogleSheetService = require('./googleSheetService');
const DateParser = require('../utils/dateParser');
const WeatherService = require('./weatherService');
const HolidayService = require('./holidayService');
const LocationService = require('./locationService');
const { v4: uuidv4 } = require('uuid');

class TodoService {
  constructor() {
    this.googleSheetService = new GoogleSheetService();
    this.activeReminders = new Map(); // 記憶體中的提醒排程
  }

  /**
   * 新增待辦提醒
   * @param {Object} reminderData - 提醒資料
   * @param {string} userId - 用戶ID
   * @param {string} language - 語言代碼
   * @returns {Promise<string>} 回應訊息
   */
  async addReminder(reminderData, userId, language = 'zh') {
    try {
      const {
        title,
        type,
        datetime,
        interval,
        description,
        location,
        weather_condition,
        priority,
        weekdays,
        monthdays
      } = reminderData;

      // 生成提醒ID
      const reminderId = uuidv4();
      
      // 準備資料
      const todoRecord = {
        id: reminderId,
        user_id: userId,
        title: title,
        type: type, // 'once', 'daily', 'weekly', 'monthly', 'custom', 'weather', 'location'
        datetime: datetime,
        interval_days: interval || null,
        weekdays: weekdays ? weekdays.join(',') : null,
        monthdays: monthdays ? monthdays.join(',') : null,
        description: description || '',
        location: location || '',
        weather_condition: weather_condition || '',
        priority: priority || 'medium',
        status: 'active',
        created_at: new Date().toISOString(),
        last_triggered: null,
        next_trigger: this.calculateNextTrigger(type, datetime, interval, weekdays, monthdays)
      };

      // 儲存到 Google Sheets
      await this.googleSheetService.addTodoRecord(todoRecord);

      // 設定提醒排程
      this.scheduleReminder(todoRecord);

      // 回應訊息
      const response = this.formatAddReminderResponse(todoRecord, language);
      
      return response;

    } catch (error) {
      console.error('新增提醒時發生錯誤:', error);
      return language === 'ja' ? 
        'リマインダーの追加に失敗しました' : 
        '新增提醒失敗';
    }
  }

  /**
   * 解析待辦提醒訊息
   * @param {string} messageText - 訊息文本
   * @param {string} language - 語言代碼
   * @returns {Object} 解析後的提醒資料
   */
  parseReminderMessage(messageText, language = 'zh') {
    const dateParser = new DateParser(language);
    
    // 移除指令前綴
    let text = messageText.replace(/^(提醒|リマインダー|remind|todo|待辦)\s*/i, '');
    
    // 解析不同類型的提醒
    const reminderData = {
      title: '',
      type: 'once',
      datetime: null,
      interval: null,
      description: '',
      location: '',
      weather_condition: '',
      priority: 'medium',
      weekdays: null,
      monthdays: null
    };

    // 解析天氣相關提醒
    if (this.isWeatherReminder(text, language)) {
      reminderData.type = 'weather';
      reminderData.weather_condition = this.extractWeatherCondition(text, language);
      reminderData.title = this.extractWeatherTitle(text, language);
      return reminderData;
    }

    // 解析位置相關提醒
    if (this.isLocationReminder(text, language)) {
      reminderData.type = 'location';
      reminderData.location = this.extractLocation(text, language);
      reminderData.title = this.extractLocationTitle(text, language);
      return reminderData;
    }

    // 解析重複模式
    const repeatPattern = this.parseRepeatPattern(text, language);
    if (repeatPattern.found) {
      reminderData.type = repeatPattern.type;
      reminderData.interval = repeatPattern.interval;
      reminderData.weekdays = repeatPattern.weekdays;
      reminderData.monthdays = repeatPattern.monthdays;
      text = repeatPattern.remainingText;
    }

    // 解析時間和標題
    const timeResult = dateParser.parseDateTime(text, reminderData.type);
    if (timeResult.success) {
      reminderData.datetime = timeResult.datetime;
      if (!repeatPattern.found) {
        reminderData.type = timeResult.type;
        reminderData.interval = timeResult.interval;
      }
      reminderData.title = timeResult.remainingText || '提醒';
    } else {
      // 如果無法解析時間，設定預設時間
      if (reminderData.type === 'daily') {
        // 每日提醒預設為早上9點
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        reminderData.datetime = tomorrow.toISOString();
      } else {
        // 其他類型設定為5分鐘後
        const fiveMinutesLater = new Date();
        fiveMinutesLater.setMinutes(fiveMinutesLater.getMinutes() + 5);
        reminderData.datetime = fiveMinutesLater.toISOString();
      }
      reminderData.title = text;
    }

    // 解析優先級
    reminderData.priority = this.extractPriority(text, language);

    return reminderData;
  }

  /**
   * 解析重複模式
   */
  parseRepeatPattern(text, language) {
    const result = {
      found: false,
      type: 'once',
      interval: null,
      weekdays: null,
      monthdays: null,
      remainingText: text
    };

    // 每日模式
    if (language === 'ja') {
      if (/毎日|まいにち|daily/i.test(text)) {
        result.found = true;
        result.type = 'daily';
        result.remainingText = text.replace(/毎日|まいにち|daily/gi, '').trim();
        return result;
      }
    } else {
      if (/每日|每天|daily/i.test(text)) {
        result.found = true;
        result.type = 'daily';
        result.remainingText = text.replace(/每日|每天|daily/gi, '').trim();
        return result;
      }
    }

    // 每週模式
    const weeklyPattern = this.parseWeeklyPattern(text, language);
    if (weeklyPattern.found) {
      result.found = true;
      result.type = 'weekly';
      result.weekdays = weeklyPattern.weekdays;
      result.remainingText = weeklyPattern.remainingText;
      return result;
    }

    // 每月模式
    const monthlyPattern = this.parseMonthlyPattern(text, language);
    if (monthlyPattern.found) {
      result.found = true;
      result.type = 'monthly';
      result.monthdays = monthlyPattern.monthdays;
      result.remainingText = monthlyPattern.remainingText;
      return result;
    }

    // 自定義間隔
    const customPattern = this.parseCustomInterval(text, language);
    if (customPattern.found) {
      result.found = true;
      result.type = 'custom';
      result.interval = customPattern.interval;
      result.remainingText = customPattern.remainingText;
      return result;
    }

    return result;
  }

  /**
   * 解析每週模式
   */
  parseWeeklyPattern(text, language) {
    const result = {
      found: false,
      weekdays: [],
      remainingText: text
    };

    let weekdayMap;
    let patterns;

    if (language === 'ja') {
      weekdayMap = {
        '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6, '日': 0,
        '月曜': 1, '火曜': 2, '水曜': 3, '木曜': 4, '金曜': 5, '土曜': 6, '日曜': 0
      };
      patterns = [
        /毎週([月火水木金土日曜]+)/g,
        /週([月火水木金土日])/g,
        /([月火水木金土日曜日]+)に/g
      ];
    } else {
      weekdayMap = {
        '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0,
        '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6, '週日': 0,
        '星期一': 1, '星期二': 2, '星期三': 3, '星期四': 4, '星期五': 5, '星期六': 6, '星期日': 0
      };
      patterns = [
        /每週([一二三四五六日]+)/g,
        /週([一二三四五六日])/g,
        /星期([一二三四五六日])/g
      ];
    }

    for (let pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        result.found = true;
        const dayStr = match[1];
        
        // 解析每個字元對應的星期
        for (let char of dayStr) {
          if (weekdayMap[char] !== undefined && !result.weekdays.includes(weekdayMap[char])) {
            result.weekdays.push(weekdayMap[char]);
          }
        }
        
        result.remainingText = result.remainingText.replace(match[0], '').trim();
      }
    }

    return result;
  }

  /**
   * 解析每月模式
   */
  parseMonthlyPattern(text, language) {
    const result = {
      found: false,
      monthdays: [],
      remainingText: text
    };

    let patterns;
    if (language === 'ja') {
      patterns = [
        /毎月(\d+)日/g,
        /月(\d+)日/g
      ];
    } else {
      patterns = [
        /每月(\d+)[號日]/g,
        /每月(\d+)/g
      ];
    }

    for (let pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        result.found = true;
        const day = parseInt(match[1]);
        if (day >= 1 && day <= 31 && !result.monthdays.includes(day)) {
          result.monthdays.push(day);
        }
        result.remainingText = result.remainingText.replace(match[0], '').trim();
      }
    }

    return result;
  }

  /**
   * 解析自定義間隔
   */
  parseCustomInterval(text, language) {
    const result = {
      found: false,
      interval: null,
      remainingText: text
    };

    let patterns;
    if (language === 'ja') {
      patterns = [
        /(\d+)日おき/g,
        /(\d+)日ごと/g,
        /(\d+)日間隔/g
      ];
    } else {
      patterns = [
        /每(\d+)天/g,
        /隔(\d+)天/g,
        /(\d+)天一次/g
      ];
    }

    for (let pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        result.found = true;
        result.interval = parseInt(match[1]);
        result.remainingText = result.remainingText.replace(match[0], '').trim();
        break; // 只取第一個匹配
      }
      if (result.found) break;
    }

    return result;
  }

  /**
   * 檢查是否為天氣相關提醒
   */
  isWeatherReminder(text, language) {
    if (language === 'ja') {
      return /雨|傘|天気|晴れ|曇り|雪/.test(text);
    } else {
      return /下雨|天氣|晴天|陰天|下雪|帶傘|雨傘/.test(text);
    }
  }

  /**
   * 檢查是否為位置相關提醒
   */
  isLocationReminder(text, language) {
    if (language === 'ja') {
      return /場所|位置|到着|出発|駅|空港/.test(text);
    } else {
      return /位置|地點|到達|出發|車站|機場|附近/.test(text);
    }
  }

  /**
   * 計算下次觸發時間
   */
  calculateNextTrigger(type, datetime, interval, weekdays, monthdays) {
    const now = new Date();
    const triggerTime = new Date(datetime);

    switch (type) {
      case 'once':
        return triggerTime > now ? triggerTime.toISOString() : null;

      case 'daily':
        const nextDaily = new Date(triggerTime);
        while (nextDaily <= now) {
          nextDaily.setDate(nextDaily.getDate() + 1);
        }
        return nextDaily.toISOString();

      case 'weekly':
        if (!weekdays || weekdays.length === 0) return null;
        return this.calculateNextWeeklyTrigger(triggerTime, weekdays);

      case 'monthly':
        if (!monthdays || monthdays.length === 0) return null;
        return this.calculateNextMonthlyTrigger(triggerTime, monthdays);

      case 'custom':
        if (!interval) return null;
        const nextCustom = new Date(triggerTime);
        while (nextCustom <= now) {
          nextCustom.setDate(nextCustom.getDate() + interval);
        }
        return nextCustom.toISOString();

      default:
        return null;
    }
  }

  /**
   * 計算下次每週觸發時間
   */
  calculateNextWeeklyTrigger(baseTime, weekdays) {
    const now = new Date();
    const next = new Date(baseTime);
    
    // 找到下一個符合條件的星期幾
    for (let i = 0; i < 14; i++) { // 檢查兩週內
      const currentWeekday = next.getDay();
      if (weekdays.includes(currentWeekday) && next > now) {
        return next.toISOString();
      }
      next.setDate(next.getDate() + 1);
    }
    
    return null;
  }

  /**
   * 計算下次每月觸發時間
   */
  calculateNextMonthlyTrigger(baseTime, monthdays) {
    const now = new Date();
    const next = new Date(baseTime);
    
    // 檢查當月和下月
    for (let monthOffset = 0; monthOffset < 2; monthOffset++) {
      const targetMonth = new Date(next);
      targetMonth.setMonth(targetMonth.getMonth() + monthOffset);
      
      for (let day of monthdays.sort((a, b) => a - b)) {
        const targetDate = new Date(targetMonth);
        targetDate.setDate(day);
        
        // 檢查日期是否有效（避免2月31日等無效日期）
        if (targetDate.getDate() === day && targetDate > now) {
          return targetDate.toISOString();
        }
      }
    }
    
    return null;
  }

  /**
   * 設定提醒排程
   */
  scheduleReminder(todoRecord) {
    const nextTrigger = new Date(todoRecord.next_trigger);
    const now = new Date();
    const delay = nextTrigger.getTime() - now.getTime();

    if (delay > 0) {
      const timeoutId = setTimeout(async () => {
        await this.triggerReminder(todoRecord);
      }, delay);

      this.activeReminders.set(todoRecord.id, {
        timeoutId,
        todoRecord
      });
    }
  }

  /**
   * 觸發提醒
   */
  async triggerReminder(todoRecord) {
    try {
      // 這裡需要實現發送LINE訊息的邏輯
      console.log(`觸發提醒: ${todoRecord.title}`);
      
      // 更新最後觸發時間
      todoRecord.last_triggered = new Date().toISOString();
      
      // 計算下次觸發時間
      const nextTrigger = this.calculateNextTrigger(
        todoRecord.type,
        todoRecord.datetime,
        todoRecord.interval_days,
        todoRecord.weekdays ? todoRecord.weekdays.split(',').map(Number) : null,
        todoRecord.monthdays ? todoRecord.monthdays.split(',').map(Number) : null
      );
      
      if (nextTrigger) {
        todoRecord.next_trigger = nextTrigger;
        await this.googleSheetService.updateTodoRecord(todoRecord);
        this.scheduleReminder(todoRecord); // 設定下次提醒
      } else {
        // 一次性提醒完成後標記為已完成
        todoRecord.status = 'completed';
        await this.googleSheetService.updateTodoRecord(todoRecord);
      }
      
    } catch (error) {
      console.error('觸發提醒時發生錯誤:', error);
    }
  }

  /**
   * 格式化新增提醒回應
   */
  formatAddReminderResponse(todoRecord, language) {
    const triggerTime = new Date(todoRecord.next_trigger);
    const timeStr = triggerTime.toLocaleString(language === 'ja' ? 'ja-JP' : 'zh-TW');

    if (language === 'ja') {
      let response = `✅ リマインダーを設定しました！\n`;
      response += `📝 内容：${todoRecord.title}\n`;
      response += `⏰ 次回：${timeStr}\n`;
      response += `📊 種類：${this.getTypeDisplayName(todoRecord.type, language)}`;
      
      if (todoRecord.type === 'weekly' && todoRecord.weekdays) {
        const weekdays = todoRecord.weekdays.split(',').map(Number);
        const dayNames = weekdays.map(day => ['日', '月', '火', '水', '木', '金', '土'][day]).join('、');
        response += `\n📅 曜日：${dayNames}`;
      }
      
      return response;
    } else {
      let response = `✅ 提醒已設定！\n`;
      response += `📝 內容：${todoRecord.title}\n`;
      response += `⏰ 下次：${timeStr}\n`;
      response += `📊 類型：${this.getTypeDisplayName(todoRecord.type, language)}`;
      
      if (todoRecord.type === 'weekly' && todoRecord.weekdays) {
        const weekdays = todoRecord.weekdays.split(',').map(Number);
        const dayNames = weekdays.map(day => ['日', '一', '二', '三', '四', '五', '六'][day]).join('、');
        response += `\n📅 星期：${dayNames}`;
      }
      
      return response;
    }
  }

  /**
   * 獲取類型顯示名稱
   */
  getTypeDisplayName(type, language) {
    const names = {
      once: { zh: '單次', ja: '一回のみ' },
      daily: { zh: '每日', ja: '毎日' },
      weekly: { zh: '每週', ja: '毎週' },
      monthly: { zh: '每月', ja: '毎月' },
      custom: { zh: '自訂間隔', ja: 'カスタム間隔' },
      weather: { zh: '天氣相關', ja: '天気関連' },
      location: { zh: '位置相關', ja: '位置関連' }
    };
    return names[type] ? names[type][language] : type;
  }

  /**
   * 獲取用戶所有提醒
   */
  async getUserReminders(userId, language = 'zh') {
    try {
      const reminders = await this.googleSheetService.getUserTodoRecords(userId);
      
      if (reminders.length === 0) {
        return language === 'ja' ? 
          '設定されているリマインダーはありません' : 
          '目前沒有設定任何提醒';
      }

      return this.formatRemindersResponse(reminders, language);

    } catch (error) {
      console.error('獲取提醒列表時發生錯誤:', error);
      return language === 'ja' ? 
        'リマインダーリストの取得に失敗しました' : 
        '獲取提醒列表失敗';
    }
  }

  /**
   * 格式化提醒列表回應
   */
  formatRemindersResponse(reminders, language) {
    let response = language === 'ja' ? '📋 リマインダー一覧：\n\n' : '📋 提醒列表：\n\n';
    
    reminders.forEach((reminder, index) => {
      const nextTrigger = reminder.next_trigger ? 
        new Date(reminder.next_trigger).toLocaleString(language === 'ja' ? 'ja-JP' : 'zh-TW') : 
        (language === 'ja' ? '未設定' : '未設定');
        
      response += `${index + 1}. ${reminder.title}\n`;
      response += `   ⏰ ${nextTrigger}\n`;
      response += `   📊 ${this.getTypeDisplayName(reminder.type, language)}\n`;
      response += `   🆔 ID: ${reminder.id.substring(0, 8)}\n\n`;
    });
    
    response += language === 'ja' ? 
      '削除するには「リマインダー削除 ID」と入力してください' :
      '要刪除提醒請輸入「刪除提醒 ID」';
    
    return response;
  }

  /**
   * 刪除提醒
   */
  async deleteReminder(reminderId, userId, language = 'zh') {
    try {
      const success = await this.googleSheetService.deleteTodoRecord(reminderId, userId);
      
      if (success) {
        // 取消記憶體中的排程
        if (this.activeReminders.has(reminderId)) {
          clearTimeout(this.activeReminders.get(reminderId).timeoutId);
          this.activeReminders.delete(reminderId);
        }
        
        return language === 'ja' ? 
          'リマインダーを削除しました' : 
          '提醒已刪除';
      } else {
        return language === 'ja' ? 
          'リマインダーが見つかりません' : 
          '找不到該提醒';
      }
    } catch (error) {
      console.error('刪除提醒時發生錯誤:', error);
      return language === 'ja' ? 
        'リマインダーの削除に失敗しました' : 
        '刪除提醒失敗';
    }
  }

  /**
   * 提取優先級
   */
  extractPriority(text, language) {
    if (language === 'ja') {
      if (/重要|緊急|高/.test(text)) return 'high';
      if (/普通|中/.test(text)) return 'medium';
      if (/低/.test(text)) return 'low';
    } else {
      if (/重要|緊急|高|urgent|high/i.test(text)) return 'high';
      if (/普通|中|medium|normal/i.test(text)) return 'medium';
      if (/低|low/i.test(text)) return 'low';
    }
    return 'medium';
  }

  /**
   * 載入現有提醒並設定排程
   */
  async loadAndScheduleExistingReminders() {
    try {
      const allReminders = await this.googleSheetService.getAllActiveTodoRecords();
      
      for (let reminder of allReminders) {
        if (reminder.next_trigger && reminder.status === 'active') {
          this.scheduleReminder(reminder);
        }
      }
      
      console.log(`已載入 ${allReminders.length} 個提醒並設定排程`);
    } catch (error) {
      console.error('載入現有提醒時發生錯誤:', error);
    }
  }
}

module.exports = TodoService;
