// parsers/dateTimeParser.js - 修正版
const { LANGUAGES } = require('../constants/todoMessage');

class DateTimeParser {
    constructor() {
        this.timePatterns = {
            zh: {
                absolute: [
                    /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})日?\s*(\d{1,2}):(\d{1,2})/,
                    /(\d{1,2})[月\-\/](\d{1,2})日?\s*(\d{1,2}):(\d{1,2})/,
                    /(\d{1,2}):(\d{1,2})/,
                    /(明天|明日)\s*(\d{1,2}):(\d{1,2})/,
                    /(後天)\s*(\d{1,2}):(\d{1,2})/
                ],
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
                absolute: [
                    /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})日?\s*(\d{1,2}):(\d{1,2})/,
                    /(\d{1,2})[月\-\/](\d{1,2})日?\s*(\d{1,2}):(\d{1,2})/,
                    /(\d{1,2}):(\d{1,2})/,
                    /(明日|あした)\s*(\d{1,2}):(\d{1,2})/,
                    /(あさって|明後日)\s*(\d{1,2}):(\d{1,2})/
                ],
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

    parseDateTime(text, language = 'zh') {
        try {
            const patterns = this.timePatterns[language];
            if (!patterns) {
                console.warn(`不支援的語言: ${language}`);
                return null;
            }

            let result = this.parseAbsoluteTime(text, patterns.absolute);
            if (result) return result;

            result = this.parseRelativeTime(text, patterns.relative);
            if (result) return result;

            result = this.parseRecurringTime(text, patterns.recurring);
            if (result) return result;

            return null;
        } catch (error) {
            console.error('解析時間時發生錯誤:', error);
            return null;
        }
    }

    parseAbsoluteTime(text, patterns) {
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) return this.extractAbsoluteDateTime(match);
        }
        return null;
    }

    parseRelativeTime(text, patterns) {
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) return this.extractRelativeDateTime(match, text);
        }
        return null;
    }

    parseRecurringTime(text, patterns) {
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) return this.extractRecurringDateTime(match);
        }
        return null;
    }

    extractAbsoluteDateTime(match) {
        const now = new Date();
        let [ , a, b, c, d, e ] = match;
        let year = now.getFullYear(), month = now.getMonth() + 1, day = now.getDate();
        let hour = 0, minute = 0;

        if (match.length >= 6) { // yyyy-mm-dd hh:mm
            year = parseInt(a); month = parseInt(b); day = parseInt(c);
            hour = parseInt(d); minute = parseInt(e);
        } else if (match.length >= 5) { // mm-dd hh:mm
            month = parseInt(a); day = parseInt(b);
            hour = parseInt(c); minute = parseInt(d);
        } else if (match.length >= 3) { // hh:mm
            hour = parseInt(a); minute = parseInt(b);
        }

        const targetDate = new Date(year, month - 1, day, hour, minute);
        return { type: 'absolute', date: targetDate, dateString: targetDate.toISOString(), isValid: targetDate > now };
    }

    extractRelativeDateTime(match, text) {
        const now = new Date();
        let targetDate = new Date(now);

        const timeMatch = text.match(/(\d{1,2}):(\d{1,2})/);
        let hour = timeMatch ? parseInt(timeMatch[1]) : now.getHours();
        let minute = timeMatch ? parseInt(timeMatch[2]) : now.getMinutes();

        const raw = match[0];

        if (raw.includes('今天') || raw.includes('今日') || raw.includes('今日')) {
            targetDate.setHours(hour, minute, 0, 0);
        } else if (raw.includes('明天') || raw.includes('明日')) {
            targetDate.setDate(targetDate.getDate() + 1);
            targetDate.setHours(hour, minute, 0, 0);
        } else if (raw.includes('後天')) {
            targetDate.setDate(targetDate.getDate() + 2);
            targetDate.setHours(hour, minute, 0, 0);
        } else if (raw.includes('天後')) {
            targetDate.setDate(targetDate.getDate() + parseInt(match[1]));
            targetDate.setHours(hour, minute, 0, 0);
        } else if (raw.includes('小時後')) {
            targetDate.setHours(targetDate.getHours() + parseInt(match[1]), minute, 0, 0);
        } else if (raw.includes('分鐘後')) {
            targetDate.setMinutes(targetDate.getMinutes() + parseInt(match[1]), 0, 0);
        }

        return { type: 'relative', date: targetDate, dateString: targetDate.toISOString(), isValid: targetDate > now };
    }

    extractRecurringDateTime(match) {
        if (match[0].includes('每天')) {
            return { type: 'daily', hour: parseInt(match[1]), minute: parseInt(match[2]), isValid: true };
        } else if (match[0].includes('每週')) {
            return { type: 'weekly', weekday: match[1], hour: parseInt(match[2]), minute: parseInt(match[3]), isValid: true };
        } else if (match[0].includes('每月')) {
            return { type: 'monthly', day: parseInt(match[1]), hour: parseInt(match[2]), minute: parseInt(match[3]), isValid: true };
        }
        return null;
    }

    formatDateTime(date, language = 'zh') {
        if (!date) return '';
        const locale = language === 'ja' ? 'ja-JP' : 'zh-TW';
        return date.toLocaleString(locale, {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false
        });
    }

    isValidDateTime(dateTime) {
        if (!dateTime) return false;
        const now = new Date();
        const targetDate = new Date(dateTime);
        return targetDate instanceof Date && !isNaN(targetDate) && targetDate > now;
    }
}

module.exports = DateTimeParser;
