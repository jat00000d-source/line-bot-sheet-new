// parsers/dateTimeParser.js - 修復版本
const { LANGUAGES } = require('../constants/todoMessage');

class DateTimeParser {
    constructor() {
        this.timePatterns = {
            zh: {
                // 絕對時間
                absolute: [
                    /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})日?\s*(\d{1,2}):(\d{1,2})/,
                    /(\d{1,2})[月\-\/](\d{1,2})日?\s*(\d{1,2}):(\d{1,2})/,
                    /(\d{1,2}):(\d{1,2})/,
                    /(明天|明日)\s*(\d{1,2}):(\d{1,2})/,
                    /(後天)\s*(\d{1,2}):(\d{1,2})/
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
                    /每天\s*(\d{1,2}):(\d{1,2})/,
                    /每週([一二三四五六日天])\s*(\d{1,2}):(\d{1,2})/,
                    /每月(\d{1,2})號\s*(\d{1,2}):(\d{1,2})/,
                    /每(\d+)天/,
                    /每(\d+)週/,
                    /每(\d+)個月/
                ]
            },
            
            ja: {
                // 絕対時間
                absolute: [
                    /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})日?\s*(\d{1,2}):(\d{1,2})/,
                    /(\d{1,2})[月\-\/](\d{1,2})日?\s*(\d{1,2}):(\d{1,2})/,
                    /(\d{1,2}):(\d{1,2})/,
                    /(明日|あした)\s*(\d{1,2}):(\d{1,2})/,
                    /(あさって|明後日)\s*(\d{1,2}):(\d{1,2})/
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
                return null;
            }
            
            // 嘗試解析絕對時間
            let result = this.parseAbsoluteTime(text, patterns.absolute);
            if (result) return result;
            
            // 嘗試解析相對時間
            result = this.parseRelativeTime(text, patterns.relative);
            if (result) return result;
            
            // 嘗試解析重複時間
            result = this.parseRecurringTime(text, patterns.recurring);
            if (result) return result;
            
            return null;
            
        } catch (error) {
            console.error('解析時間時發生錯誤:', error);
            return null;
        }
    }
    
    // 解析絕對時間
    parseAbsoluteTime(text, patterns) {
        for (const pattern of patterns) {
            try {
                const match = text.match(pattern);
                if (match) {
                    return this.extractAbsoluteDateTime(match);
                }
            } catch (error) {
                console.warn('絕對時間解析錯誤:', error);
                continue;
            }
        }
        return null;
    }
    
    // 解析相對時間
    parseRelativeTime(text, patterns) {
        for (const pattern of patterns) {
            try {
                const match = text.match(pattern);
                if (match) {
                    return this.extractRelativeDateTime(match, text);
                }
            } catch (error) {
                console.warn('相對時間解析錯誤:', error);
                continue;
            }
        }
        return null;
    }
    
    // 解析重複時間
    parseRecurringTime(text, patterns) {
        for (const pattern of patterns) {
            try {
                const match = text.match(pattern);
                if (match) {
                    return this.extractRecurringDateTime(match, text);
                }
            } catch (error) {
                console.warn('重複時間解析錯誤:', error);
                continue;
            }
        }
        return null;
    }
    
    // 提取絕對時間
    extractAbsoluteDateTime(match) {
        const now = new Date();
        let year = now.getFullYear();
        let month = now.getMonth() + 1;
        let day = now.getDate();
        let hour = 0;
        let minute = 0;
        
        // 根據匹配結果解析
        if (match.length >= 6) {
            // 完整日期時間格式
            year = parseInt(match[1]);
            month = parseInt(match[2]);
            day = parseInt(match[3]);
            hour = parseInt(match[4]);
            minute = parseInt(match[5]);
        } else if (match.length >= 5) {
            // 月日時間格式
            month = parseInt(match[1]);
            day = parseInt(match[2]);
            hour = parseInt(match[3]);
            minute = parseInt(match[4]);
        } else if (match.length >= 3) {
            // 只有時間格式
            hour = parseInt(match[1]);
            minute = parseInt(match[2]);
        }
        
        const targetDate = new Date(year, month - 1, day, hour, minute);
        
        return {
            type: 'absolute',
            date: targetDate,
            dateString: targetDate.toISOString(),
            isValid: targetDate > now
        };
    }
    
    // 提取相對時間
    extractRelativeDateTime(match, text) {
        const now = new Date();
        let targetDate = new Date(now);
        
        const timeMatch = text.match(/(\d{1,2}):(\d{1,2})/);
        let hour = timeMatch ? parseInt(timeMatch[1]) : now.getHours();
        let minute = timeMatch ? parseInt(timeMatch[2]) : now.getMinutes();
        
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
        
        return {
            type: 'relative',
            date: targetDate,
            dateString: targetDate.toISOString(),
            isValid: targetDate > now
        };
    }
    
    // 提取重複時間
    extractRecurringDateTime(match, text) {
        const now = new Date();
        
        if (match[0].includes('每天')) {
            return {
                type: 'daily',
                time: `${match[1]}:${match[2]}`,
                hour: parseInt(match[1]),
                minute: parseInt(match[2]),
                isValid: true
            };
        } else if (match[0].includes('每週')) {
            return {
                type: 'weekly',
                weekday: match[1],
                time: `${match[2]}:${match[3]}`,
                hour: parseInt(match[2]),
                minute: parseInt(match[3]),
                isValid: true
            };
        } else if (match[0].includes('每月')) {
            return {
                type: 'monthly',
                day: parseInt(match[1]),
                time: `${match[2]}:${match[3]}`,
                hour: parseInt(match[2]),
                minute: parseInt(match[3]),
                isValid: true
            };
        }
        
        return null;
    }
    
    // 格式化時間顯示
    formatDateTime(date, language = 'zh') {
        if (!date) return '';
        
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
    }
    
    // 檢查時間是否有效
    isValidDateTime(dateTime) {
        if (!dateTime) return false;
        
        const now = new Date();
        const targetDate = new Date(dateTime);
        
        return targetDate instanceof Date && !isNaN(targetDate) && targetDate > now;
    }
}

module.exports =  DateTimeParser();
