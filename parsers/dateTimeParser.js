// parsers/dateTimeParser.js - 智能日期時間解析器
class DateTimeParser {
  constructor() {
    this.initializeKeywords();
  }

  // 初始化關鍵字字典
  initializeKeywords() {
    // 相對日期關鍵字
    this.relativeDates = {
      // 中文
      '今天': 0, '明天': 1, '後天': 2, '大後天': 3,
      '昨天': -1, '前天': -2, '大前天': -3,
      '今日': 0, '明日': 1,
      
      // 日文
      '今日': 0, '明日': 1, '明後日': 2,
      '昨日': -1, '一昨日': -2,
      'きょう': 0, 'あした': 1, 'あさって': 2,
      'きのう': -1, 'おととい': -2
    };

    // 星期關鍵字
    this.weekdays = {
      // 中文
      '星期一': 1, '星期二': 2, '星期三': 3, '星期四': 4, '星期五': 5, '星期六': 6, '星期日': 0,
      '週一': 1, '週二': 2, '週三': 3, '週四': 4, '週五': 5, '週六': 6, '週日': 0,
      '禮拜一': 1, '禮拜二': 2, '禮拜三': 3, '禮拜四': 4, '禮拜五': 5, '禮拜六': 6, '禮拜日': 0,
      
      // 日文
      '月曜日': 1, '火曜日': 2, '水曜日': 3, '木曜日': 4, '金曜日': 5, '土曜日': 6, '日曜日': 0,
      '月曜': 1, '火曜': 2, '水曜': 3, '木曜': 4, '金曜': 5, '土曜': 6, '日曜': 0
    };

    // 時間關鍵字
    this.timeKeywords = {
      // 中文
      '早上': 9, '上午': 10, '中午': 12, '下午': 14, '晚上': 19, '深夜': 23,
      '清晨': 6, '黃昏': 18, '午夜': 0,
      
      // 日文
      '朝': 9, '午前': 10, '正午': 12, '午後': 14, '夜': 19, '深夜': 23,
      '夕方': 18, '真夜中': 0
    };

    // 重複模式關鍵字
    this.repeatKeywords = {
      // 中文
      '每天': 'daily', '每日': 'daily', '天天': 'daily',
      '每週': 'weekly', '每星期': 'weekly',
      '每月': 'monthly', '每個月': 'monthly',
      
      // 日文
      '毎日': 'daily', '日々': 'daily',
      '毎週': 'weekly', '週毎': 'weekly',
      '毎月': 'monthly', '月毎': 'monthly'
    };

    // 相對週期關鍵字
    this.relativeWeeks = {
      // 中文
      '下週': 1, '下星期': 1, '下個星期': 1,
      '下下週': 2, '下下星期': 2,
      '上週': -1, '上星期': -1, '上個星期': -1,
      
      // 日文
      '来週': 1, '再来週': 2, '先週': -1
    };

    this.relativeMonths = {
      // 中文
      '下個月': 1, '下月': 1, '來月': 1,
      '上個月': -1, '上月': -1,
      
      // 日文
      '来月': 1, '再来月': 2, '先月': -1
    };
  }

  // 解析重複模式
  parseRepeatPattern(text) {
    // 檢查複雜週期模式
    const complexWeekly = this.parseComplexWeeklyPattern(text);
    if (complexWeekly) {
      return complexWeekly;
    }

    const complexMonthly = this.parseComplexMonthlyPattern(text);
    if (complexMonthly) {
      return complexMonthly;
    }

    // 檢查自定義間隔（如：每3天、每7天）
    const customIntervalMatch = text.match(/每(\d+)[天日]/);
    if (customIntervalMatch) {
      const interval = parseInt(customIntervalMatch[1]);
      return {
        type: 'custom',
        pattern: interval.toString()
      };
    }

    // 檢查重複關鍵字
    for (const [keyword, type] of Object.entries(this.repeatKeywords)) {
      if (text.includes(keyword)) {
        let pattern = '';
        
        switch (type) {
          case 'weekly':
            // 嘗試提取星期幾的模式
            const weekdays = [];
            for (const [dayKeyword, dayOfWeek] of Object.entries(this.weekdays)) {
              if (text.includes(dayKeyword)) {
                weekdays.push(dayOfWeek);
              }
            }
            pattern = weekdays.length > 0 ? weekdays.join(',') : '1'; // 預設週一
            break;
            
          case 'monthly':
            // 嘗試提取日期模式
            const dateMatch = text.match(/(\d{1,2})[日號号]/);
            pattern = dateMatch ? dateMatch[1] : '1'; // 預設每月1號
            break;
            
          case 'daily':
          default:
            pattern = '';
            break;
        }
        
        return {
          type: type,
          pattern: pattern
        };
      }
    }
    
    // 預設為一次性提醒
    return {
      type: 'once',
      pattern: ''
    };
  }

  // 提取位置資訊
  extractLocation(text) {
    // 位置相關關鍵字
    const locationKeywords = [
      // 中文
      '在', '到', '去', '於', '位於',
      // 日文
      'で', 'に', 'へ', 'にて'
    ];

    // 常見地點類型
    const placeTypes = [
      // 中文
      '公司', '家', '學校', '醫院', '銀行', '超市', '餐廳', '咖啡廳',
      '車站', '機場', '辦公室', '會議室',
      // 日文
      '会社', '家', '学校', '病院', '銀行', 'スーパー', 'レストラン',
      'カフェ', '駅', '空港', 'オフィス', '会議室'
    ];

    // 尋找位置相關的文字
    for (const keyword of locationKeywords) {
      const keywordIndex = text.indexOf(keyword);
      if (keywordIndex !== -1) {
        // 提取關鍵字後的文字作為位置
        const afterKeyword = text.substring(keywordIndex + keyword.length).trim();
        const locationMatch = afterKeyword.match(/^[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\w\s]+/);
        if (locationMatch) {
          return locationMatch[0].trim();
        }
      }
    }

    // 尋找常見地點類型
    for (const placeType of placeTypes) {
      if (text.includes(placeType)) {
        return placeType;
      }
    }

    return '';
  }

  // 解析特殊格式（如：每週一三五）
  parseComplexWeeklyPattern(text) {
    const weekdayNumbers = {
      '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0,
      '１': 1, '２': 2, '３': 3, '４': 4, '５': 5, '６': 6, '０': 0,
      '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '0': 0
    };

    // 匹配 "週一三五" 或 "星期135" 這樣的模式
    const complexPattern = text.match(/(?:每週|每星期|週|星期)([一二三四五六日０-６0-6１-６]+)/);
    if (complexPattern) {
      const dayString = complexPattern[1];
      const days = [];
      
      for (let i = 0; i < dayString.length; i++) {
        const char = dayString[i];
        if (weekdayNumbers.hasOwnProperty(char)) {
          days.push(weekdayNumbers[char]);
        }
      }
      
      if (days.length > 0) {
        return {
          type: 'weekly',
          pattern: days.join(',')
        };
      }
    }

    return null;
  }

  // 解析特殊格式（如：每月1號15號）
  parseComplexMonthlyPattern(text) {
    // 匹配 "每月1號15號" 這樣的模式
    const monthlyMatches = text.match(/每月.*?(\d{1,2}[號号日])/g);
    if (monthlyMatches) {
      const days = [];
      
      monthlyMatches.forEach(match => {
        const dayMatches = match.match(/(\d{1,2})[號号日]/g);
        if (dayMatches) {
          dayMatches.forEach(dayMatch => {
            const day = parseInt(dayMatch.match(/(\d{1,2})/)[1]);
            if (day >= 1 && day <= 31 && !days.includes(day)) {
              days.push(day);
            }
          });
        }
      });
      
      if (days.length > 0) {
        return {
          type: 'monthly',
          pattern: days.sort((a, b) => a - b).join(',')
        };
      }
    }

    return null;
  }

  // 智能時間推測
  intelligentTimeGuess(text, baseTime = new Date()) {
    // 根據內容推測合適的時間
    const timeHints = {
      // 工作相關
      '會議': 10, '開會': 10, '報告': 14, '工作': 9,
      '会議': 10, 'ミーティング': 10, '仕事': 9,
      
      // 生活相關
      '吃藥': 8, '服藥': 8, '運動': 19, '跑步': 7,
      '薬': 8, '運動': 19, 'ランニング': 7,
      
      // 購物相關
      '買菜': 16, '購物': 15, '逛街': 15,
      '買い物': 15, 'ショッピング': 15,
      
      // 學習相關
      '上課': 9, '學習': 19, '複習': 20,
      '授業': 9, '勉強': 19, '復習': 20
    };

    for (const [keyword, suggestedHour] of Object.entries(timeHints)) {
      if (text.includes(keyword)) {
        const suggestedTime = new Date(baseTime);
        suggestedTime.setHours(suggestedHour, 0, 0, 0);
        return suggestedTime;
      }
    }

    // 預設返回上午9點
    const defaultTime = new Date(baseTime);
    defaultTime.setHours(9, 0, 0, 0);
    return defaultTime;
  }

  // 驗證和修正日期時間
  validateAndCorrectDateTime(datetime) {
    const now = new Date();
    const correctedDateTime = new Date(datetime);

    // 如果時間在過去，調整到未來
    if (correctedDateTime <= now) {
      // 如果是今天但時間已過，設定為明天
      if (correctedDateTime.toDateString() === now.toDateString()) {
        correctedDateTime.setDate(correctedDateTime.getDate() + 1);
      }
    }

    // 確保時間合理（不要超過一年後）
    const oneYearLater = new Date(now);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    
    if (correctedDateTime > oneYearLater) {
      // 如果超過一年，設定為一年後
      return oneYearLater;
    }

    return correctedDateTime;
  }

  // 格式化解析結果供調試用
  formatParseResult(result) {
    if (!result.success) {
      return `解析失敗: ${result.error}`;
    }

    const datetime = new Date(result.datetime);
    const formattedTime = datetime.toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
標題: ${result.title}
描述: ${result.description}
類型: ${result.type}
時間: ${formattedTime}
模式: ${result.pattern}
位置: ${result.location}
語言: ${result.language}
    `.trim();
  }

  // 測試用的範例解析
  static getExamples(language = 'zh') {
    if (language === 'ja') {
      return [
        '明日9時に会議',
        '毎日8時に薬を飲む',
        '毎週月曜日に資料準備',
        '来週金曜日14時に病院',
        '毎月1日に家賃支払い',
        '3日後の午後に買い物',
        '今度の日曜日朝に運動'
      ];
    } else {
      return [
        '明天9點開會',
        '每天8點吃藥',
        '每週一準備資料',
        '下週五下午2點看醫生',
        '每月1號繳房租',
        '3天後下午去買菜',
        '這週日早上運動'
      ];
    }
  }

  // 批量測試解析功能
  async testParseExamples(language = 'zh') {
    const examples = DateTimeParser.getExamples(language);
    const results = [];

    for (const example of examples) {
      console.log(`\n測試: ${example}`);
      const result = await this.parseNaturalLanguage(example, language);
      console.log(this.formatParseResult(result));
      results.push({
        input: example,
        output: result
      });
    }

    return results;
  }

  // 主要解析函數
  async parseNaturalLanguage(input, language = 'zh') {
    try {
      console.log('解析輸入:', input);
      
      // 清理和標準化輸入
      const normalizedInput = this.normalizeInput(input);
      
      // 提取提醒內容
      const reminderContent = this.extractReminderContent(normalizedInput);
      
      // 解析日期時間
      const dateTimeResult = this.parseDateTimeFromText(normalizedInput);
      
      // 解析重複模式
      const repeatPattern = this.parseRepeatPattern(normalizedInput);
      
      // 提取位置資訊
      const location = this.extractLocation(normalizedInput);

      // 驗證結果
      if (!dateTimeResult.success) {
        return {
          success: false,
          error: language === 'ja' ? 
            '日時を認識できませんでした。例：明日9時、毎日8時など' :
            '無法識別日期時間，例如：明天9點、每天8點等'
        };
      }

      const result = {
        success: true,
        title: reminderContent.title,
        description: reminderContent.description,
        type: repeatPattern.type,
        datetime: dateTimeResult.datetime.toISOString(),
        pattern: repeatPattern.pattern,
        location: location,
        language: language
      };

      console.log('解析結果:', result);
      return result;

    } catch (error) {
      console.error('日期時間解析錯誤:', error);
      return {
        success: false,
        error: language === 'ja' ? 
          '解析処理中にエラーが発生しました' :
          '解析過程中發生錯誤'
      };
    }
  }

  // 標準化輸入文字
  normalizeInput(input) {
    return input
      .replace(/[\s　]+/g, ' ') // 統一空格
      .replace(/[：:]/g, ':') // 統一冒號
      .replace(/[，,]/g, ',') // 統一逗號
      .replace(/[。.！!？?]/g, '') // 移除標點符號
      .trim();
  }

  // 提取提醒內容
  extractReminderContent(text) {
    // 移除時間和重複相關的關鍵字，剩下的就是提醒內容
    let content = text;
    
    // 移除時間表達式
    content = content.replace(/\d{1,2}[：:點点时]\d{0,2}/g, '');
    content = content.replace(/\d{1,2}[點点时]/g, '');
    
    // 移除日期表達式
    content = content.replace(/\d{1,2}月\d{1,2}[日號号]/g, '');
    content = content.replace(/\d{4}[年年]\d{1,2}月\d{1,2}[日號号]/g, '');
    
    // 移除相對日期
    Object.keys(this.relativeDates).forEach(keyword => {
      content = content.replace(new RegExp(keyword, 'g'), '');
    });
    
    // 移除星期
    Object.keys(this.weekdays).forEach(keyword => {
      content = content.replace(new RegExp(keyword, 'g'), '');
    });
    
    // 移除重複關鍵字
    Object.keys(this.repeatKeywords).forEach(keyword => {
      content = content.replace(new RegExp(keyword, 'g'), '');
    });
    
    // 移除時間關鍵字
    Object.keys(this.timeKeywords).forEach(keyword => {
      content = content.replace(new RegExp(keyword, 'g'), '');
    });

    // 移除相對週期關鍵字
    Object.keys(this.relativeWeeks).forEach(keyword => {
      content = content.replace(new RegExp(keyword, 'g'), '');
    });
    
    Object.keys(this.relativeMonths).forEach(keyword => {
      content = content.replace(new RegExp(keyword, 'g'), '');
    });

    // 清理多餘空格
    content = content.replace(/\s+/g, ' ').trim();
    
    // 如果內容太短，使用原始文字的前幾個字
    if (content.length < 2) {
      const words = text.split(/\s+/);
      content = words.slice(0, 3).join(' ') || '提醒事項';
    }

    return {
      title: content.substring(0, 50), // 限制標題長度
      description: content.length > 50 ? content : ''
    };
  }

  // 解析日期時間
  parseDateTimeFromText(text) {
    const now = new Date();
    let targetDate = new Date(now);
    let hasTimeInfo = false;
    let hasDateInfo = false;

    // 1. 解析具體時間 (如：9點、14:30)
    const timeMatch = text.match(/(\d{1,2})[：:點点时](\d{0,2})/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        targetDate.setHours(hour, minute, 0, 0);
        hasTimeInfo = true;
      }
    }

    // 2. 解析時間關鍵字 (如：早上、下午)
    if (!hasTimeInfo) {
      for (const [keyword, hour] of Object.entries(this.timeKeywords)) {
        if (text.includes(keyword)) {
          targetDate.setHours(hour, 0, 0, 0);
          hasTimeInfo = true;
          break;
        }
      }
    }

    // 3. 解析具體日期 (如：12月25日)
    const dateMatch = text.match(/(\d{1,2})月(\d{1,2})[日號号]/);
    if (dateMatch) {
      const month = parseInt(dateMatch[1]) - 1; // JavaScript 月份從0開始
      const day = parseInt(dateMatch[2]);
      
      targetDate.setMonth(month, day);
      
      // 如果日期已過，設定為明年
      if (targetDate <= now) {
        targetDate.setFullYear(targetDate.getFullYear() + 1);
      }
      
      hasDateInfo = true;
    }

    // 4. 解析年月日 (如：2025年1月1日)
    const fullDateMatch = text.match(/(\d{4})[年年](\d{1,2})月(\d{1,2})[日號号]/);
    if (fullDateMatch) {
      const year = parseInt(fullDateMatch[1]);
      const month = parseInt(fullDateMatch[2]) - 1;
      const day = parseInt(fullDateMatch[3]);
      
      targetDate.setFullYear(year, month, day);
      hasDateInfo = true;
    }

    // 5. 解析相對日期 (如：明天、後天)
    if (!hasDateInfo) {
      for (const [keyword, offset] of Object.entries(this.relativeDates)) {
        if (text.includes(keyword)) {
          targetDate.setDate(now.getDate() + offset);
          hasDateInfo = true;
          break;
        }
      }
    }

    // 6. 解析星期 (如：下週一)
    if (!hasDateInfo) {
      for (const [weekKeyword, weekOffset] of Object.entries(this.relativeWeeks)) {
        if (text.includes(weekKeyword)) {
          for (const [dayKeyword, dayOfWeek] of Object.entries(this.weekdays)) {
            if (text.includes(dayKeyword)) {
              const targetWeekDate = this.getDateForWeekday(now, dayOfWeek, weekOffset);
              targetDate = targetWeekDate;
              if (hasTimeInfo) {
                // 保持已設定的時間
                const hours = targetDate.getHours();
                const minutes = targetDate.getMinutes();
                targetDate.setHours(hours, minutes, 0, 0);
              }
              hasDateInfo = true;
              break;
            }
          }
          if (hasDateInfo) break;
        }
      }
    }

    // 7. 解析單純的星期 (如：星期一，預設為下一個星期一)
    if (!hasDateInfo) {
      for (const [keyword, dayOfWeek] of Object.entries(this.weekdays)) {
        if (text.includes(keyword)) {
          const targetWeekDate = this.getNextWeekday(now, dayOfWeek);
          targetDate = targetWeekDate;
          if (hasTimeInfo) {
            const hours = targetDate.getHours();
            const minutes = targetDate.getMinutes();
            targetDate.setHours(hours, minutes, 0, 0);
          }
          hasDateInfo = true;
          break;
        }
      }
    }

    // 8. 解析相對月份 (如：下個月)
    if (!hasDateInfo) {
      for (const [keyword, offset] of Object.entries(this.relativeMonths)) {
        if (text.includes(keyword)) {
          targetDate.setMonth(targetDate.getMonth() + offset);
          hasDateInfo = true;
          break;
        }
      }
    }

    // 預設設定：如果沒有日期資訊，設為明天；如果沒有時間資訊，設為上午9點
    if (!hasDateInfo) {
      targetDate.setDate(now.getDate() + 1);
    }
    
    if (!hasTimeInfo) {
      targetDate.setHours(9, 0, 0, 0);
    }

    // 確保時間在未來
    if (targetDate <= now) {
      if (!hasDateInfo) {
        targetDate.setDate(targetDate.getDate() + 1);
      } else {
        // 如果指定了日期但時間已過，設定為明天同一時間
        targetDate.setDate(targetDate.getDate() + 1);
      }
    }

    return {
      success: true,
      datetime: targetDate,
      hasTimeInfo: hasTimeInfo,
      hasDateInfo: hasDateInfo
    };
  }

  // 獲取指定星期幾的日期
  getNextWeekday(baseDate, targetDay) {
    const currentDay = baseDate.getDay();
    let daysAhead = targetDay - currentDay;
    
    if (daysAhead <= 0) {
      daysAhead += 7; // 如果是今天或已過，取下週的同一天
    }
    
    const targetDate = new Date(baseDate);
    targetDate.setDate(baseDate.getDate() + daysAhead);
    
    return targetDate;
  }

  // 獲取指定週數偏移的星期幾
  getDateForWeekday(baseDate, targetDay, weekOffset) {
    const targetDate = this.getNextWeekday(baseDate, targetDay);
    targetDate.setDate(targetDate.getDate() + (weekOffset - 1) * 7);
    
    return targetDate;
  }
}

module.exports = DateTimeParser;
