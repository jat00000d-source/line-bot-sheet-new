const { DATETIME_PATTERNS } = require('../constants/dateTimeConstants');

class DateTimeParser {
    constructor() {
        this.patterns = DATETIME_PATTERNS;
    }

    /**
     * 驗證日期時間是否有效
     */
    isValidDateTime(dateTime) {
        if (!dateTime || !(dateTime instanceof Date)) {
            return false;
        }
        
        if (isNaN(dateTime.getTime())) {
            return false;
        }
        
        // 檢查是否為未來時間（允許5分鐘的誤差）
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        
        return dateTime > fiveMinutesAgo;
    }

    /**
     * 解析週期性提醒的特殊邏輯
     */
    parseRecurringReminder(text, language = 'zh') {
        const patterns = {
            zh: [
                {
                    regex: /每天\s*(\d{1,2})[點点时]\s*(\d{1,2})?分?/,
                    parser: (match) => ({
                        type: 'daily',
                        time: {
                            hour: parseInt(match[1]),
                            minute: parseInt(match[2]) || 0
                        }
                    })
                },
                {
                    regex: /每[週周]([一二三四五六日天,、\s]+)\s*(\d{1,2})[點点时]\s*(\d{1,2})?分?/,
                    parser: (match) => {
                        const weekdayMap = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0};
                        const weekdayText = match[1];
                        const weekdays = [];
                        
                        Object.keys(weekdayMap).forEach(day => {
                            if (weekdayText.includes(day)) {
                                weekdays.push(weekdayMap[day]);
                            }
                        });
                        
                        return {
                            type: 'weekly',
                            weekdays: weekdays,
                            time: {
                                hour: parseInt(match[2]),
                                minute: parseInt(match[3]) || 0
                            }
                        };
                    }
                },
                {
                    regex: /每月(\d{1,2})[號号日]\s*(\d{1,2})[點点时]\s*(\d{1,2})?分?/,
                    parser: (match) => ({
                        type: 'monthly',
                        monthDay: parseInt(match[1]),
                        time: {
                            hour: parseInt(match[2]),
                            minute: parseInt(match[3]) || 0
                        }
                    })
                },
                {
                    regex: /每(\d+)[天日]\s*(\d{1,2})[點点时]\s*(\d{1,2})?分?/,
                    parser: (match) => ({
                        type: 'custom',
                        interval: parseInt(match[1]),
                        time: {
                            hour: parseInt(match[2]),
                            minute: parseInt(match[3]) || 0
                        }
                    })
                }
            ],
            ja: [
                {
                    regex: /毎日\s*(\d{1,2})[時时]\s*(\d{1,2})?分?/,
                    parser: (match) => ({
                        type: 'daily',
                        time: {
                            hour: parseInt(match[1]),
                            minute: parseInt(match[2]) || 0
                        }
                    })
                },
                {
                    regex: /毎[週周]([月火水木金土日,、\s]+)[曜日]*\s*(\d{1,2})[時时]\s*(\d{1,2})?分?/,
                    parser: (match) => {
                        const weekdayMap = {'月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6, '日': 0};
                        const weekdayText = match[1];
                        const weekdays = [];
                        
                        Object.keys(weekdayMap).forEach(day => {
                            if (weekdayText.includes(day)) {
                                weekdays.push(weekdayMap[day]);
                            }
                        });
                        
                        return {
                            type: 'weekly',
                            weekdays: weekdays,
                            time: {
                                hour: parseInt(match[2]),
                                minute: parseInt(match[3]) || 0
                            }
                        };
                    }
                },
                {
                    regex: /毎月(\d{1,2})日\s*(\d{1,2})[時时]\s*(\d{1,2})?分?/,
                    parser: (match) => ({
                        type: 'monthly',
                        monthDay: parseInt(match[1]),
                        time: {
                            hour: parseInt(match[2]),
                            minute: parseInt(match[3]) || 0
                        }
                    })
                },
                {
                    regex: /(\d+)日[ごと毎]\s*(\d{1,2})[時时]\s*(\d{1,2})?分?/,
                    parser: (match) => ({
                        type: 'custom',
                        interval: parseInt(match[1]),
                        time: {
                            hour: parseInt(match[2]),
                            minute: parseInt(match[3]) || 0
                        }
                    })
                }
            ]
        };

        const langPatterns = patterns[language] || patterns.zh;
        
        for (const pattern of langPatterns) {
            const match = text.match(pattern.regex);
            if (match) {
                try {
                    const recurring = pattern.parser(match);
                    return {
                        type: 'recurring',
                        recurring: recurring,
                        original: match[0],
                        confidence: 0.85
                    };
                } catch (error) {
                    console.error('解析週期性提醒失敗:', error);
                }
            }
        }
        
        return null;
    }

    /**
     * 解析時間範圍
     */
    parseTimeRange(text, language = 'zh') {
        const patterns = {
            zh: [
                {
                    regex: /從\s*(\d{1,2})[點点时](\d{1,2})?分?\s*到\s*(\d{1,2})[點点时](\d{1,2})?分?/,
                    parser: (match) => ({
                        start: {
                            hour: parseInt(match[1]),
                            minute: parseInt(match[2]) || 0
                        },
                        end: {
                            hour: parseInt(match[3]),
                            minute: parseInt(match[4]) || 0
                        }
                    })
                }
            ],
            ja: [
                {
                    regex: /(\d{1,2})[時时](\d{1,2})?分?から(\d{1,2})[時时](\d{1,2})?分?まで/,
                    parser: (match) => ({
                        start: {
                            hour: parseInt(match[1]),
                            minute: parseInt(match[2]) || 0
                        },
                        end: {
                            hour: parseInt(match[3]),
                            minute: parseInt(match[4]) || 0
                        }
                    })
                }
            ]
        };

        const langPatterns = patterns[language] || patterns.zh;
        
        for (const pattern of langPatterns) {
            const match = text.match(pattern.regex);
            if (match) {
                try {
                    return pattern.parser(match);
                } catch (error) {
                    console.error('解析時間範圍失敗:', error);
                }
            }
        }
        
        return null;
    }

    /**
     * 標準化時間格式
     */
    normalizeTime(hour, minute = 0) {
        // 處理12小時制轉換
        if (hour <= 12) {
            // 如果是上午時間，可能需要額外判斷
            // 這裡簡化處理，實際可以根據上下文判斷
        }
        
        return {
            hour: Math.max(0, Math.min(23, hour)),
            minute: Math.max(0, Math.min(59, minute))
        };
    }

    /**
     * 獲取下一個指定週期的日期
     */
    getNextOccurrence(baseDate, recurring) {
        const result = new Date(baseDate);
        
        switch (recurring.type) {
            case 'daily':
                result.setDate(result.getDate() + 1);
                result.setHours(recurring.time.hour, recurring.time.minute, 0, 0);
                break;
                
            case 'weekly':
                const currentWeekday = result.getDay();
                let nextWeekday = recurring.weekdays.find(day => day > currentWeekday);
                
                if (!nextWeekday) {
                    // 如果本週沒有下個週期日，找下週的第一個
                    nextWeekday = Math.min(...recurring.weekdays);
                    const daysToAdd = (7 - currentWeekday) + nextWeekday;
                    result.setDate(result.getDate() + daysToAdd);
                } else {
                    result.setDate(result.getDate() + (nextWeekday - currentWeekday));
                }
                
                result.setHours(recurring.time.hour, recurring.time.minute, 0, 0);
                break;
                
            case 'monthly':
                if (result.getDate() < recurring.monthDay) {
                    result.setDate(recurring.monthDay);
                } else {
                    result.setMonth(result.getMonth() + 1);
                    result.setDate(recurring.monthDay);
                }
                result.setHours(recurring.time.hour, recurring.time.minute, 0, 0);
                break;
                
            case 'custom':
                result.setDate(result.getDate() + recurring.interval);
                result.setHours(recurring.time.hour, recurring.time.minute, 0, 0);
                break;
        }
        
        return result;
    }

    /**
     * 解析模糊時間表達
     */
    parseFuzzyTime(text, language = 'zh') {
        const fuzzyPatterns = {
            zh: {
                '早上': {hour: 8, minute: 0},
                '上午': {hour: 9, minute: 0},
                '中午': {hour: 12, minute: 0},
                '下午': {hour: 14, minute: 0},
                '傍晚': {hour: 18, minute: 0},
                '晚上': {hour: 20, minute: 0},
                '深夜': {hour: 23, minute: 0}
            },
            ja: {
                '朝': {hour: 8, minute: 0},
                '午前': {hour: 9, minute: 0},
                '昼': {hour: 12, minute: 0},
                '午後': {hour: 14, minute: 0},
                '夕方': {hour: 18, minute: 0},
                '夜': {hour: 20, minute: 0},
                '深夜': {hour: 23, minute: 0}
            }
        };

        const patterns = fuzzyPatterns[language] || fuzzyPatterns.zh;
        
        for (const [keyword, time] of Object.entries(patterns)) {
            if (text.includes(keyword)) {
                return time;
            }
        }
        
        return null;
    }

    /**
     * 格式化解析結果
     */
    formatResult(parseResult) {
        if (!parseResult) return null;
        
        return {
            ...parseResult,
            formatted: this.formatDateTime(parseResult.dateTime),
            isValid: this.isValidDateTime(parseResult.dateTime),
            timeFromNow: this.getTimeFromNow(parseResult.dateTime)
        };
    }

    /**
     * 格式化日期時間顯示
     */
    formatDateTime(dateTime, language = 'zh') {
        if (!dateTime) return '';
        
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            weekday: 'short'
        };

        const locale = language === 'ja' ? 'ja-JP' : 'zh-TW';
        return dateTime.toLocaleDateString(locale, options);
    }

    /**
     * 計算距離現在的時間
     */
    getTimeFromNow(dateTime) {
        if (!dateTime) return '';
        
        const now = new Date();
        const diffMs = dateTime.getTime() - now.getTime();
        const diffMins = Math.round(diffMs / (1000 * 60));
        const diffHours = Math.round(diffMs / (1000 * 60 * 60));
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffMins < 60) {
            return `${diffMins}分鐘後`;
        } else if (diffHours < 24) {
            return `${diffHours}小時後`;
        } else {
            return `${diffDays}天後`;
        }
    }

    /**
     * 批量解析（用於處理多個時間表達）
     */
    parseMultiple(texts, language = 'zh') {
        return texts.map(text => this.parse(text, language)).filter(result => result !== null);
    }
}

module.exports = new DateTimeParser();主要解析函數
     */
    parse(text, language = 'zh') {
        const cleanText = text.toLowerCase().trim();
        
        // 嘗試各種解析模式
        let result = null;
        
        // 1. 絕對日期時間
        result = this.parseAbsoluteDateTime(cleanText, language);
        if (result) return result;
        
        // 2. 相對時間
        result = this.parseRelativeDateTime(cleanText, language);
        if (result) return result;
        
        // 3. 週期性時間
        result = this.parseRecurringDateTime(cleanText, language);
        if (result) return result;
        
        // 4. 自然語言時間
        result = this.parseNaturalLanguage(cleanText, language);
        if (result) return result;
        
        return null;
    }

    /**
     * 解析絕對日期時間
     */
    parseAbsoluteDateTime(text, language) {
        const patterns = this.patterns[language]?.absolute || this.patterns.zh.absolute;
        
        for (const pattern of patterns) {
            const match = text.match(pattern.regex);
            if (match) {
                try {
                    const dateTime = pattern.parser(match);
                    if (this.isValidDateTime(dateTime)) {
                        return {
                            type: 'absolute',
                            dateTime: dateTime,
                            original: match[0],
                            confidence: 0.9
                        };
                    }
                } catch (error) {
                    console.error('解析絕對時間失敗:', error);
                }
            }
        }
        
        return null;
    }

    /**
     * 解析相對時間
     */
    parseRelativeDateTime(text, language) {
        const patterns = this.patterns[language]?.relative || this.patterns.zh.relative;
        
        for (const pattern of patterns) {
            const match = text.match(pattern.regex);
            if (match) {
                try {
                    const baseTime = new Date();
                    const dateTime = pattern.parser(match, baseTime);
                    if (this.isValidDateTime(dateTime)) {
                        return {
                            type: 'relative',
                            dateTime: dateTime,
                            original: match[0],
                            confidence: 0.8
                        };
                    }
                } catch (error) {
                    console.error('解析相對時間失敗:', error);
                }
            }
        }
        
        return null;
    }

    /**
     * 解析週期性時間
     */
    parseRecurringDateTime(text, language) {
        const patterns = this.patterns[language]?.recurring || this.patterns.zh.recurring;
        
        for (const pattern of patterns) {
            const match = text.match(pattern.regex);
            if (match) {
                try {
                    const recurring = pattern.parser(match);
                    return {
                        type: 'recurring',
                        recurring: recurring,
                        original: match[0],
                        confidence: 0.85
                    };
                } catch (error) {
                    console.error('解析週期時間失敗:', error);
                }
            }
        }
        
        return null;
    }

    /**
     * 自然語言解析
     */
    parseNaturalLanguage(text, language) {
        const now = new Date();
        let result = null;

        // 中文自然語言
        if (language === 'zh') {
            result = this.parseChineseNaturalLanguage(text, now);
        }
        
        // 日文自然語言
        if (language === 'ja') {
            result = this.parseJapaneseNaturalLanguage(text, now);
        }

        return result;
    }

    /**
     * 中文自然語言解析
     */
    parseChineseNaturalLanguage(text, baseTime) {
        const patterns = [
            // 今天
            {
                regex: /今天\s*(\d{1,2})[點点时]\s*(\d{1,2})?分?/,
                parser: (match) => {
                    const hour = parseInt(match[1]);
                    const minute = parseInt(match[2]) || 0;
                    const result = new Date(baseTime);
                    result.setHours(hour, minute, 0, 0);
                    return result;
                }
            },
            // 明天
            {
                regex: /明天\s*(\d{1,2})[點点时]\s*(\d{1,2})?分?/,
                parser: (match) => {
                    const hour = parseInt(match[1]);
                    const minute = parseInt(match[2]) || 0;
                    const result = new Date(baseTime);
                    result.setDate(result.getDate() + 1);
                    result.setHours(hour, minute, 0, 0);
                    return result;
                }
            },
            // 後天
            {
                regex: /後天\s*(\d{1,2})[點点时]\s*(\d{1,2})?分?/,
                parser: (match) => {
                    const hour = parseInt(match[1]);
                    const minute = parseInt(match[2]) || 0;
                    const result = new Date(baseTime);
                    result.setDate(result.getDate() + 2);
                    result.setHours(hour, minute, 0, 0);
                    return result;
                }
            },
            // 下週
            {
                regex: /下[週周星期]([一二三四五六日天])\s*(\d{1,2})[點点时]\s*(\d{1,2})?分?/,
                parser: (match) => {
                    const weekdayMap = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0};
                    const targetWeekday = weekdayMap[match[1]];
                    const hour = parseInt(match[2]);
                    const minute = parseInt(match[3]) || 0;
                    
                    const result = new Date(baseTime);
                    const currentWeekday = result.getDay();
                    let daysToAdd = targetWeekday - currentWeekday + 7;
                    
                    result.setDate(result.getDate() + daysToAdd);
                    result.setHours(hour, minute, 0, 0);
                    return result;
                }
            },
            // 下個月
            {
                regex: /下[個个]月(\d{1,2})[號号日]\s*(\d{1,2})[點点时]\s*(\d{1,2})?分?/,
                parser: (match) => {
                    const day = parseInt(match[1]);
                    const hour = parseInt(match[2]);
                    const minute = parseInt(match[3]) || 0;
                    
                    const result = new Date(baseTime);
                    result.setMonth(result.getMonth() + 1);
                    result.setDate(day);
                    result.setHours(hour, minute, 0, 0);
                    return result;
                }
            },
            // X小時後
            {
                regex: /(\d+)\s*[個个]?小[時时]後/,
                parser: (match) => {
                    const hours = parseInt(match[1]);
                    const result = new Date(baseTime);
                    result.setHours(result.getHours() + hours);
                    return result;
                }
            },
            // X分鐘後
            {
                regex: /(\d+)\s*分[鐘钟]後/,
                parser: (match) => {
                    const minutes = parseInt(match[1]);
                    const result = new Date(baseTime);
                    result.setMinutes(result.getMinutes() + minutes);
                    return result;
                }
            }
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern.regex);
            if (match) {
                try {
                    const dateTime = pattern.parser(match);
                    if (this.isValidDateTime(dateTime)) {
                        return {
                            type: 'natural',
                            dateTime: dateTime,
                            original: match[0],
                            confidence: 0.7
                        };
                    }
                } catch (error) {
                    console.error('中文自然語言解析失敗:', error);
                }
            }
        }

        return null;
    }

    /**
     * 日文自然語言解析
     */
    parseJapaneseNaturalLanguage(text, baseTime) {
        const patterns = [
            // 今日
            {
                regex: /今日\s*(\d{1,2})[時时]\s*(\d{1,2})?分?/,
                parser: (match) => {
                    const hour = parseInt(match[1]);
                    const minute = parseInt(match[2]) || 0;
                    const result = new Date(baseTime);
                    result.setHours(hour, minute, 0, 0);
                    return result;
                }
            },
            // 明日
            {
                regex: /明日\s*(\d{1,2})[時时]\s*(\d{1,2})?分?/,
                parser: (match) => {
                    const hour = parseInt(match[1]);
                    const minute = parseInt(match[2]) || 0;
                    const result = new Date(baseTime);
                    result.setDate(result.getDate() + 1);
                    result.setHours(hour, minute, 0, 0);
                    return result;
                }
            },
            // 来週
            {
                regex: /来[週周]([月火水木金土日])[曜日]*\s*(\d{1,2})[時时]\s*(\d{1,2})?分?/,
                parser: (match) => {
                    const weekdayMap = {'月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6, '日': 0};
                    const targetWeekday = weekdayMap[match[1]];
                    const hour = parseInt(match[2]);
                    const minute = parseInt(match[3]) || 0;
                    
                    const result = new Date(baseTime);
                    const currentWeekday = result.getDay();
                    let daysToAdd = targetWeekday - currentWeekday + 7;
                    
                    result.setDate(result.getDate() + daysToAdd);
                    result.setHours(hour, minute, 0, 0);
                    return result;
                }
            },
            // 来月
            {
                regex: /来月(\d{1,2})日\s*(\d{1,2})[時时]\s*(\d{1,2})?分?/,
                parser: (match) => {
                    const day = parseInt(match[1]);
                    const hour = parseInt(match[2]);
                    const minute = parseInt(match[3]) || 0;
                    
                    const result = new Date(baseTime);
                    result.setMonth(result.getMonth() + 1);
                    result.setDate(day);
                    result.setHours(hour, minute, 0, 0);
                    return result;
                }
            },
            // X時間後
            {
                regex: /(\d+)[時间]間後/,
                parser: (match) => {
                    const hours = parseInt(match[1]);
                    const result = new Date(baseTime);
                    result.setHours(result.getHours() + hours);
                    return result;
                }
            }
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern.regex);
            if (match) {
                try {
                    const dateTime = pattern.parser(match);
                    if (this.isValidDateTime(dateTime)) {
                        return {
                            type: 'natural',
                            dateTime: dateTime,
                            original: match[0],
                            confidence: 0.7
                        };
                    }
                } catch (error) {
                    console.error('日文自然語言解析失敗:', error);
                }
            }
        }

        return null;
    }

    /**
     *
