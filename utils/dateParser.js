// parsers/dateTimeParser.js - 修復版本
const { LANGUAGES } = require('../constants/todoMessage');

class DateTimeParser {
    constructor() {
        this.timePatterns = {
            zh: {
                // 絕對時間 - 增加對 "點" 的支援
                absolute: [
                    // 完整日期時間格式
                    /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})日?\s*(?:晚上|上午|下午|早上)?\s*(\d{1,2})[：:點]\s*(\d{1,2})?/,
                    /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})日?\s*(\d{1,2}):(\d{1,2})/,
                    
                    // 月日時間格式
                    /(\d{1,2})[月\-\/](\d{1,2})日?\s*(?:晚上|上午|下午|早上)?\s*(\d{1,2})[：:點]\s*(\d{1,2})?/,
                    /(\d{1,2})[月\-\/](\d{1,2})日?\s*(\d{1,2}):(\d{1,2})/,
                    
                    // 簡化日期格式 (9/18 19點)
                    /(\d{1,2})\/(\d{1,2})\s*(?:晚上|上午|下午|早上)?\s*(\d{1,2})[：:點]\s*(\d{1,2})?/,
                    /(\d{1,2})\/(\d{1,2})\s*(\d{1,2}):(\d{1,2})/,
                    
                    // 相對日期 + 時間
                    /(明天|明日)\s*(?:晚上|上午|下午|早上)?\s*(\d{1,2})[：:點]\s*(\d{1,2})?/,
                    /(明天|明日)\s*(\d{1,2}):(\d{1,2})/,
                    /(後天)\s*(?:晚上|上午|下午|早上)?\s*(\d{1,2})[：:點]\s*(\d{1,2})?/,
                    /(後天)\s*(\d{1,2}):(\d{1,2})/,
                    /(今天|今日)\s*(?:晚上|上午|下午|早上)?\s*(\d{1,2})[：:點]\s*(\d{1,2})?/,
                    /(今天|今日)\s*(\d{1,2}):(\d{1,2})/,
                    
                    // 只有時間格式
                    /(?:晚上|上午|下午|早上)?\s*(\d{1,2})[：:點]\s*(\d{1,2})?/,
                    /(\d{1,2}):(\d{1,2})/,
                    
                    // 半點格式
                    /(?:晚上|上午|下午|早上)?\s*(\d{1,2})[：:點]半/,
                    /(\d{1,2}):30/
                ],
                
                // 相對時間
                relative: [
                    /(今天|今日)/,
                    /(明天|明日)/,
                    /(後天)/,
                    /(\d+)\s*天後/,
                    /(\d+)\s*小時後/,
                    /(\d+)\s*分鐘後/,
                    /(下週|下星期)/,
                    /(下個月|下月)/
                ],
                
                // 重複時間
                recurring: [
                    /每天\s*(?:晚上|上午|下午|早上)?\s*(\d{1,2})[：:點]\s*(\d{1,2})?/,
                    /每天\s*(\d{1,2}):(\d{1,2})/,
                    /每週([一二三四五六日天])\s*(?:晚上|上午|下午|早上)?\s*(\d{1,2})[：:點]\s*(\d{1,2})?/,
                    /每週([一二三四五六日天])\s*(\d{1,2}):(\d{1,2})/,
                    /每月(\d{1,2})號\s*(?:晚上|上午|下午|早上)?\s*(\d{1,2})[：:點]\s*(\d{1,2})?/,
                    /每月(\d{1,2})號\s*(\d{1,2}):(\d{1,2})/,
                    /每(\d+)天/,
                    /每(\d+)週/,
                    /每(\d+)個月/
                ]
            },
            
            ja: {
                // 絶対時間
                absolute: [
                    /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})日?\s*(\d{1,2}):(\d{1,2})/,
                    /(\d{1,2})[月\-\/](\d{1,2})日?\s*(\d{1,2}):(\d{1,2})/,
                    /(\d{1,2}):(\d{1,2})/,
                    /(明日|あした)\s*(\d{1,2}):(\d{1,2})/,
                    /(あさって|明後日)\s*(\d{1,2}):(\d{1,2})/,
                    /(今日|きょう)\s*(\d{1,2}):(\d{1,2})/
                ],
                
                // 相対時間
                relative: [
                    /(今日|きょう)/,
                    /(明日|あした)/,
                    /(明後日|あさって)/,
                    /(\d+)\s*日後/,
                    /(\d+)\s*時間後/,
                    /(\d+)\s*分後/,
                    /(来週|らいしゅう)/,
                    /(来月|らいげつ)/
                ],
                
                // 繰り返し時間
                recurring: [
                    /毎日\s*(\d{1,2}):(\d{1,2})/,
                    /毎週([月火水木金土日])\s*(\d{1,2}):(\d{1,2})/,
                    /毎月(\d{1,2})日\s*(\d{1,2}):(\d{1,2})/,
                    /(\d+)日ごと/,
                    /(\d+)週間ごと/,
                    /(\d+)ヶ月ごと/
                ]
            }
        };
    }
    
    // 解析時間字串
    parseDateTime(text, language = 'zh') {
        try {
            const lang = language || 'zh';
            const patterns = this.timePatterns[lang];
            
            if (!patterns) {
                console.warn(`不支援的語言: ${lang}`);
                return this.createFailureResult(text);
            }
            
            console.log(`🔍 開始解析時間: "${text}", 語言: ${lang}`);
            
            // 嘗試解析絕對時間
            let result = this.parseAbsoluteTime(text, patterns.absolute, lang);
            if (result && result.isValid) {
                console.log(`✅ 絕對時間解析成功:`, result);
                return result;
            }
            
            // 嘗試解析相對時間
            result = this.parseRelativeTime(text, patterns.relative, lang);
            if (result && result.isValid) {
                console.log(`✅ 相對時間解析成功:`, result);
                return result;
            }
            
            // 嘗試解析重複時間
            result = this.parseRecurringTime(text, patterns.recurring, lang);
            if (result && result.isValid) {
                console.log(`✅ 重複時間解析成功:`, result);
                return result;
            }
            
            console.log(`❌ 所有解析方式都失敗`);
            return this.createFailureResult(text);
            
        } catch (error) {
            console.error('解析時間時發生錯誤:', error);
            return this.createFailureResult(text);
        }
    }
    
    // 創建失敗結果
    createFailureResult(text) {
        return {
            success: false,
            datetime: null,
            type: 'once',
            interval: null,
            remainingText: text,
            isValid: false
        };
    }
    
    // 解析絕對時間
    parseAbsoluteTime(text, patterns, language) {
        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            try {
                const match = text.match(pattern);
                if (match) {
                    console.log(`🎯 匹配到絕對時間模式 ${i}:`, match);
                    const result = this.extractAbsoluteDateTime(match, text, language);
                    if (result && result.isValid) {
                        return result;
                    }
                }
            } catch (error) {
                console.warn(`絕對時間解析錯誤 (模式 ${i}):`, error);
                continue;
            }
        }
        return null;
    }
    
    // 解析相對時間
    parseRelativeTime(text, patterns, language) {
        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            try {
                const match = text.match(pattern);
                if (match) {
                    console.log(`🎯 匹配到相對時間模式 ${i}:`, match);
                    const result = this.extractRelativeDateTime(match, text, language);
                    if (result && result.isValid) {
                        return result;
                    }
                }
            } catch (error) {
                console.warn(`相對時間解析錯誤 (模式 ${i}):`, error);
                continue;
            }
        }
        return null;
    }
    
    // 解析重複時間
    parseRecurringTime(text, patterns, language) {
        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            try {
                const match = text.match(pattern);
                if (match) {
                    console.log(`🎯 匹配到重複時間模式 ${i}:`, match);
                    const result = this.extractRecurringDateTime(match, text, language);
                    if (result && result.isValid) {
                        return result;
                    }
                }
            } catch (error) {
                console.warn(`重複時間解析錯誤 (模式 ${i}):`, error);
                continue;
            }
        }
        return null;
    }
    
    // 提取絕對時間
    extractAbsoluteDateTime(match, originalText, language) {
        try {
            const now = new Date();
            let year = now.getFullYear();
            let month = now.getMonth() + 1;
            let day = now.getDate();
            let hour = 9; // 預設時間
            let minute = 0;
            
            console.log(`🔧 開始提取絕對時間:`, match);
            
            // 判斷匹配類型並解析
            if (this.isRelativeDateMatch(match)) {
                // 相對日期 (今天/明天/後天)
                const relativeDays = this.getRelativeDays(match[1]);
                const targetDate = new Date(now);
                targetDate.setDate(targetDate.getDate() + relativeDays);
                
                year = targetDate.getFullYear();
                month = targetDate.getMonth() + 1;
                day = targetDate.getDate();
                
                // 提取時間
                const timeInfo = this.extractTimeFromMatch(match, 2);
                hour = timeInfo.hour;
                minute = timeInfo.minute;
                
            } else if (this.isFullDateMatch(match)) {
                // 完整日期格式
                year = parseInt(match[1]);
                month = parseInt(match[2]);
                day = parseInt(match[3]);
                
                const timeInfo = this.extractTimeFromMatch(match, 4);
                hour = timeInfo.hour;
                minute = timeInfo.minute;
                
            } else if (this.isMonthDayMatch(match)) {
                // 月日格式
                month = parseInt(match[1]);
                day = parseInt(match[2]);
                
                const timeInfo = this.extractTimeFromMatch(match, 3);
                hour = timeInfo.hour;
                minute = timeInfo.minute;
                
            } else if (this.isSimpleDateMatch(match)) {
                // 簡化日期格式 (9/18)
                month = parseInt(match[1]);
                day = parseInt(match[2]);
                
                const timeInfo = this.extractTimeFromMatch(match, 3);
                hour = timeInfo.hour;
                minute = timeInfo.minute;
                
            } else {
                // 只有時間格式
                const timeInfo = this.extractTimeFromMatch(match, 1);
                hour = timeInfo.hour;
                minute = timeInfo.minute;
            }
            
            // 創建目標日期
            const targetDate = new Date(year, month - 1, day, hour, minute, 0, 0);
            
            console.log(`📅 解析結果: ${year}-${month}-${day} ${hour}:${minute}`);
            console.log(`📅 目標時間: ${targetDate.toISOString()}`);
            console.log(`📅 現在時間: ${now.toISOString()}`);
            
            // 檢查日期是否有效
            if (isNaN(targetDate.getTime())) {
                console.error('❌ 無效的日期時間');
                return null;
            }
            
            // 如果是今天但時間已過，則設為明天
            if (targetDate <= now && this.isTodayTime(originalText)) {
                targetDate.setDate(targetDate.getDate() + 1);
                console.log(`⏭️ 時間已過，調整為明天: ${targetDate.toISOString()}`);
            }
            
            const isValid = targetDate > now;
            
            return {
                success: true,
                datetime: targetDate.toISOString(),
                type: 'once',
                interval: null,
                remainingText: originalText.replace(match[0], '').trim(),
                isValid: isValid,
                date: targetDate,
                dateString: targetDate.toISOString()
            };
            
        } catch (error) {
            console.error('提取絕對時間時發生錯誤:', error);
            return null;
        }
    }
    
    // 從匹配結果中提取時間
    extractTimeFromMatch(match, startIndex) {
        let hour = 9; // 預設時間
        let minute = 0;
        
        // 查找時間相關的匹配組
        for (let i = startIndex; i < match.length; i++) {
            if (match[i] !== undefined) {
                const value = parseInt(match[i]);
                if (value >= 0 && value <= 24) {
                    hour = value;
                    // 查找分鐘
                    if (match[i + 1] !== undefined) {
                        const minuteValue = parseInt(match[i + 1]);
                        if (minuteValue >= 0 && minuteValue <= 59) {
                            minute = minuteValue;
                        }
                    }
                    break;
                }
            }
        }
        
        // 處理半點格式
        if (match[0].includes('半')) {
            minute = 30;
        }
        
        return { hour, minute };
    }
    
    // 判斷是否為相對日期匹配
    isRelativeDateMatch(match) {
        return match[1] && (match[1].includes('今天') || match[1].includes('今日') || 
                           match[1].includes('明天') || match[1].includes('明日') || 
                           match[1].includes('後天'));
    }
    
    // 判斷是否為完整日期匹配
    isFullDateMatch(match) {
        return match.length >= 6 && match[1] && match[2] && match[3] && 
               parseInt(match[1]) > 1000; // 年份大於1000
    }
    
    // 判斷是否為月日匹配
    isMonthDayMatch(match) {
        return match.length >= 5 && match[1] && match[2] && 
               parseInt(match[1]) <= 12 && parseInt(match[2]) <= 31 &&
               !match[1].includes('今') && !match[1].includes('明') && !match[1].includes('後');
    }
    
    // 判斷是否為簡化日期匹配 (9/18)
    isSimpleDateMatch(match) {
        return match.length >= 4 && match[1] && match[2] && 
               match[0].includes('/') && 
               parseInt(match[1]) <= 12 && parseInt(match[2]) <= 31;
    }
    
    // 獲取相對天數
    getRelativeDays(dateStr) {
        if (dateStr.includes('今天') || dateStr.includes('今日')) return 0;
        if (dateStr.includes('明天') || dateStr.includes('明日')) return 1;
        if (dateStr.includes('後天')) return 2;
        return 0;
    }
    
    // 判斷是否為今天時間
    isTodayTime(text) {
        return text.includes('今天') || text.includes('今日') || 
               (!text.includes('明天') && !text.includes('明日') && 
                !text.includes('後天') && !text.includes('/'));
    }
    
    // 提取相對時間
    extractRelativeDateTime(match, text, language) {
        try {
            const now = new Date();
            let targetDate = new Date(now);
            
            // 從文本中提取時間
            const timeMatch = text.match(/(\d{1,2})[：:點]\s*(\d{1,2})?|(\d{1,2}):(\d{1,2})/);
            let hour = 9; // 預設時間
            let minute = 0;
            
            if (timeMatch) {
                if (timeMatch[1] && timeMatch[2]) {
                    // 格式: 19點30 或 19:30
                    hour = parseInt(timeMatch[1]);
                    minute = parseInt(timeMatch[2]) || 0;
                } else if (timeMatch[1]) {
                    // 格式: 19點
                    hour = parseInt(timeMatch[1]);
                    minute = 0;
                } else if (timeMatch[3] && timeMatch[4]) {
                    // 格式: 19:30
                    hour = parseInt(timeMatch[3]);
                    minute = parseInt(timeMatch[4]);
                }
            }
            
            // 處理相對日期
            if (match[1] === '今天' || match[1] === '今日') {
                // 今天
                targetDate.setHours(hour, minute, 0, 0);
            } else if (match[1] === '明天' || match[1] === '明日') {
                // 明天
                targetDate.setDate(targetDate.getDate() + 1);
                targetDate.setHours(hour, minute, 0, 0);
            } else if (match[1] === '後天') {
                // 後天
                targetDate.setDate(targetDate.getDate() + 2);
                targetDate.setHours(hour, minute, 0, 0);
            } else if (match[1] && match[1].includes('天後')) {
                // N天後
                const days = parseInt(match[1]);
                targetDate.setDate(targetDate.getDate() + days);
                targetDate.setHours(hour, minute, 0, 0);
            }
            
            // 如果時間已過（今天的情況），調整到明天
            if (targetDate <= now && (match[1] === '今天' || match[1] === '今日')) {
                targetDate.setDate(targetDate.getDate() + 1);
            }
            
            const isValid = targetDate > now;
            
            return {
                success: true,
                datetime: targetDate.toISOString(),
                type: 'once',
                interval: null,
                remainingText: text.replace(match[0], '').trim(),
                isValid: isValid,
                date: targetDate,
                dateString: targetDate.toISOString()
            };
            
        } catch (error) {
            console.error('提取相對時間時發生錯誤:', error);
            return null;
        }
    }
    
    // 提取重複時間
    extractRecurringDateTime(match, text, language) {
        try {
            if (match[0].includes('每天')) {
                const hour = parseInt(match[1]) || 9;
                const minute = parseInt(match[2]) || 0;
                
                return {
                    success: true,
                    datetime: null,
                    type: 'daily',
                    interval: 'daily',
                    time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
                    hour: hour,
                    minute: minute,
                    remainingText: text.replace(match[0], '').trim(),
                    isValid: true
                };
            } else if (match[0].includes('每週')) {
                const weekday = match[1];
                const hour = parseInt(match[2]) || 9;
                const minute = parseInt(match[3]) || 0;
                
                return {
                    success: true,
                    datetime: null,
                    type: 'weekly',
                    interval: 'weekly',
                    weekday: weekday,
                    time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
                    hour: hour,
                    minute: minute,
                    remainingText: text.replace(match[0], '').trim(),
                    isValid: true
                };
            } else if (match[0].includes('每月')) {
                const day = parseInt(match[1]);
                const hour = parseInt(match[2]) || 9;
                const minute = parseInt(match[3]) || 0;
                
                return {
                    success: true,
                    datetime: null,
                    type: 'monthly',
                    interval: 'monthly',
                    day: day,
                    time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
                    hour: hour,
                    minute: minute,
                    remainingText: text.replace(match[0], '').trim(),
                    isValid: true
                };
            }
            
            return null;
            
        } catch (error) {
            console.error('提取重複時間時發生錯誤:', error);
            return null;
        }
    }
    
    // 格式化時間顯示
    formatDateTime(date, language = 'zh') {
        if (!date) return '';
        
        try {
            const options = {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            };
            
            const locale = language === 'ja' ? 'ja-JP' : 'zh-TW';
            return date.toLocaleDateString(locale, options);
        } catch (error) {
            console.error('格式化時間時發生錯誤:', error);
            return date.toString();
        }
    }
    
    // 檢查時間是否有效
    isValidDateTime(dateTime) {
        if (!dateTime) return false;
        
        try {
            const now = new Date();
            const targetDate = new Date(dateTime);
            
            return targetDate instanceof Date && !isNaN(targetDate.getTime()) && targetDate > now;
        } catch (error) {
            console.error('檢查時間有效性時發生錯誤:', error);
            return false;
        }
    }
    
    // 取得當前時間的字串表示
    getCurrentTimeString() {
        return new Date().toISOString();
    }
    
    // 解析時間範圍
    parseTimeRange(text, language = 'zh') {
        const rangePattern = /(\d{1,2})[：:點]\s*(\d{1,2})?\s*[-到至]\s*(\d{1,2})[：:點]\s*(\d{1,2})?/;
        const match = text.match(rangePattern);
        
        if (match) {
            const startHour = parseInt(match[1]);
            const startMinute = parseInt(match[2]) || 0;
            const endHour = parseInt(match[3]);
            const endMinute = parseInt(match[4]) || 0;
            
            return {
                start: { hour: startHour, minute: startMinute },
                end: { hour: endHour, minute: endMinute },
                isRange: true
            };
        }
        
        return null;
    }
}

module.exports = DateTimeParser;
