const DATETIME_PATTERNS = {
    zh: {
        absolute: [
            // 完整日期時間：2024年1月15日 14點30分
            {
                regex: /(\d{4})年(\d{1,2})月(\d{1,2})[日號]\s*(\d{1,2})[點点时]\s*(\d{1,2})?分?/,
                parser: (match) => {
                    const year = parseInt(match[1]);
                    const month = parseInt(match[2]) - 1; // JavaScript 月份從0開始
                    const day = parseInt(match[3]);
                    const hour = parseInt(match[4]);
                    const minute = parseInt(match[5]) || 0;
                    return new Date(year, month, day, hour, minute);
                }
            },
            // 月日時間：1月15日 14點30分
            {
                regex: /(\d{1,2})月(\d{1,2})[日號]\s*(\d{1,2})[點点时]\s*(\d{1,2})?分?/,
                parser: (match) => {
                    const now = new Date();
                    const month = parseInt(match[1]) - 1;
                    const day = parseInt(match[2]);
                    const hour = parseInt(match[3]);
                    const minute = parseInt(match[4]) || 0;
                    let year = now.getFullYear();
                    
                    // 如果指定的日期已過，則為明年
                    const targetDate = new Date(year, month, day, hour, minute);
                    if (targetDate < now) {
                        year++;
                    }
                    
                    return new Date(year, month, day, hour, minute);
                }
            },
            // 僅時間：14點30分
            {
                regex: /(\d{1,2})[點点时]\s*(\d{1,2})?分?/,
                parser: (match) => {
                    const now = new Date();
                    const hour = parseInt(match[1]);
                    const minute = parseInt(match[2]) || 0;
                    const result = new Date(now);
                    result.setHours(hour, minute, 0, 0);
                    
                    // 如果時間已過，則為明天
                    if (result < now) {
                        result.setDate(result.getDate() + 1);
                    }
                    
                    return result;
                }
            }
        ],
        relative: [
            // 明天 X點
            {
                regex: /明天\s*(\d{1,2})[點点时]\s*(\d{1,2})?分?/,
                parser: (match, baseTime) => {
                    const hour = parseInt(match[1]);
                    const minute = parseInt(match[2]) || 0;
                    const result = new Date(baseTime);
                    result.setDate(result.getDate() + 1);
                    result.setHours(hour, minute, 0, 0);
                    return result;
                }
            },
            // 後天 X點
            {
                regex: /後天\s*(\d{1,2})[點点时]\s*(\d{1,2})?分?/,
                parser: (match, baseTime) => {
                    const hour = parseInt(match[1]);
                    const minute = parseInt(match[2]) || 0;
                    const result = new Date(baseTime);
                    result.setDate(result.getDate() + 2);
                    result.setHours(hour, minute, 0, 0);
                    return result;
                }
            },
            // X小時後
            {
                regex: /(\d+)\s*[個个]?小[時时]後/,
                parser: (match, baseTime) => {
                    const hours = parseInt(match[1]);
                    const result = new Date(baseTime);
                    result.setHours(result.getHours() + hours);
                    return result;
                }
            },
            // X分鐘後
            {
                regex: /(\d+)\s*分[鐘钟]後/,
                parser: (match, baseTime) => {
                    const minutes = parseInt(match[1]);
                    const result = new Date(baseTime);
                    result.setMinutes(result.getMinutes() + minutes);
                    return result;
                }
            },
            // 下週X
            {
                regex: /下[週周星期]([一二三四五六日天])\s*(\d{1,2})[點点时]\s*(\d{1,2})?分?/,
                parser: (match, baseTime) => {
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
            }
        ],
        recurring: [
            // 每天
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
            // 每週
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
            }
        ]
    },
    ja: {
        absolute: [
            // 完整日期時間：2024年1月15日 14時30分
            {
                regex: /(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2})[時时]\s*(\d{1,2})?分?/,
                parser: (match) => {
                    const year = parseInt(match[1]);
                    const month = parseInt(match[2]) - 1;
                    const day = parseInt(match[3]);
                    const hour = parseInt(match[4]);
                    const minute = parseInt(match[5]) || 0;
                    return new Date(year, month, day, hour, minute);
                }
            },
            // 月日時間：1月15日 14時30分
            {
                regex: /(\d{1,2})月(\d{1,2})日\s*(\d{1,2})[時时]\s*(\d{1,2})?分?/,
                parser: (match) => {
                    const now = new Date();
                    const month = parseInt(match[1]) - 1;
                    const day = parseInt(match[2]);
                    const hour = parseInt(match[3]);
                    const minute = parseInt(match[4]) || 0;
                    let year = now.getFullYear();
                    
                    const targetDate = new Date(year, month, day, hour, minute);
                    if (targetDate < now) {
                        year++;
                    }
                    
                    return new Date(year, month, day, hour, minute);
                }
            },
            // 僅時間：14時30分
            {
                regex: /(\d{1,2})[時时]\s*(\d{1,2})?分?/,
                parser: (match) => {
                    const now = new Date();
                    const hour = parseInt(match[1]);
                    const minute = parseInt(match[2]) || 0;
                    const result = new Date(now);
                    result.setHours(hour, minute, 0, 0);
                    
                    if (result < now) {
                        result.setDate(result.getDate() + 1);
                    }
                    
                    return result;
                }
            }
        ],
        relative: [
            // 明日 X時
            {
                regex: /明日\s*(\d{1,2})[時时]\s*(\d{1,2})?分?/,
                parser: (match, baseTime) => {
                    const hour = parseInt(match[1]);
                    const minute = parseInt(match[2]) || 0;
                    const result = new Date(baseTime);
                    result.setDate(result.getDate() + 1);
                    result.setHours(hour, minute, 0, 0);
                    return result;
                }
            },
            // 来週X曜日
            {
                regex: /来[週周]([月火水木金土日])[曜日]*\s*(\d{1,2})[時时]\s*(\d{1,2})?分?/,
                parser: (match, baseTime) => {
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
            }
        ],
        recurring: [
            // 毎日
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
            // 毎週
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
            }
        ]
    }
};

const WEEKDAY_NAMES = {
    zh: ['日', '一', '二', '三', '四', '五', '六'],
    ja: ['日', '月', '火', '水', '木', '金', '土']
};

const MONTH_NAMES = {
    zh: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    ja: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
};

const TIME_KEYWORDS = {
    zh: {
        now: ['現在', '立刻', '馬上'],
        today: ['今天', '今日'],
        tomorrow: ['明天', '明日'],
        yesterday: ['昨天', '昨日'],
        thisWeek: ['這週', '本週'],
        nextWeek: ['下週', '下星期'],
        thisMonth: ['這個月', '本月'],
        nextMonth: ['下個月', '下月'],
        morning: ['早上', '上午', '晨間'],
        afternoon: ['下午', '午後'],
        evening: ['傍晚', '晚上', '夜間'],
        night: ['深夜', '半夜']
    },
    ja: {
        now: ['今', 'いま', '今すぐ'],
        today: ['今日', 'きょう'],
        tomorrow: ['明日', 'あした', 'あす'],
        yesterday: ['昨日', 'きのう'],
        thisWeek: ['今週', 'こんしゅう'],
        nextWeek: ['来週', 'らいしゅう'],
        thisMonth: ['今月', 'こんげつ'],
        nextMonth: ['来月', 'らいげつ'],
        morning: ['朝', 'あさ', '午前'],
        afternoon: ['午後', 'ごご'],
        evening: ['夕方', 'ゆうがた', '夜'],
        night: ['深夜', '夜中']
    }
};

const FUZZY_TIME_MAP = {
    zh: {
        '早上': {hour: 8, minute: 0},
        '上午': {hour: 9, minute: 0},
        '中午': {hour: 12, minute: 0},
        '下午': {hour: 14, minute: 0},
        '傍晚': {hour: 18, minute: 0},
        '晚上': {hour: 20, minute: 0},
        '深夜': {hour: 23, minute: 0},
        '半夜': {hour: 0, minute: 0}
    },
    ja: {
        '朝': {hour: 8, minute: 0},
        '午前': {hour: 9, minute: 0},
        '昼': {hour: 12, minute: 0},
        '午後': {hour: 14, minute: 0},
        '夕方': {hour: 18, minute: 0},
        '夜': {hour: 20, minute: 0},
        '深夜': {hour: 23, minute: 0},
        '夜中': {hour: 0, minute: 0}
    }
};

const RECURRING_KEYWORDS = {
    zh: {
        daily: ['每天', '每日', '天天'],
        weekly: ['每週', '每星期', '週週'],
        monthly: ['每月', '月月'],
        yearly: ['每年', '年年']
    },
    ja: {
        daily: ['毎日', 'まいにち'],
        weekly: ['毎週', 'まいしゅう'],
        monthly: ['毎月', 'まいつき'],
        yearly: ['毎年', 'まいねん', '毎年']
    }
};

const DURATION_PATTERNS = {
    zh: {
        minutes: /(\d+)\s*分[鐘钟]/,
        hours: /(\d+)\s*[個个]?小[時时]/,
        days: /(\d+)\s*[天日]/,
        weeks: /(\d+)\s*[個个]?[週周星期]/,
        months: /(\d+)\s*[個个]?月/,
        years: /(\d+)\s*年/
    },
    ja: {
        minutes: /(\d+)\s*分/,
        hours: /(\d+)\s*[時间]間/,
        days: /(\d+)\s*日/,
        weeks: /(\d+)\s*週間?/,
        months: /(\d+)\s*ヶ?月/,
        years: /(\d+)\s*年/
    }
};

const RELATIVE_TIME_PATTERNS = {
    zh: {
        after: /(\d+)\s*(分[鐘钟]|小[時时]|天|[週周]|月|年)[後后]/,
        before: /(\d+)\s*(分[鐘钟]|小[時时]|天|[週周]|月|年)[前]/,
        in: /(\d+)\s*(分[鐘钟]|小[時时]|天|[週周]|月|年)[內内]/
    },
    ja: {
        after: /(\d+)\s*(分|[時间]間|日|週間?|ヶ?月|年)後/,
        before: /(\d+)\s*(分|[時间]間|日|週間?|ヶ?月|年)前/,
        in: /(\d+)\s*(分|[時间]間|日|週間?|ヶ?月|年)[內内以]/
    }
};

const PRIORITY_KEYWORDS = {
    zh: {
        high: ['緊急', '重要', '優先', '高優先級'],
        medium: ['普通', '一般', '中等'],
        low: ['不急', '低優先級', '有空再做']
    },
    ja: {
        high: ['緊急', '重要', '優先', '高優先度'],
        medium: ['普通', '一般', '中程度'],
        low: ['急がない', '低優先度', '時間があるとき']
    }
};

const LOCATION_PATTERNS = {
    zh: {
        at: /在\s*(.+?)\s*(提醒|做|完成)/,
        near: /[靠近附近]\s*(.+?)\s*(提醒|做|完成)/,
        address: /([\u4e00-\u9fff]+[市區縣鄉鎮村里路街巷弄號樓室][\d\w\-]*)/
    },
    ja: {
        at: /(.+?)で\s*(リマインド|する|完成)/,
        near: /(.+?)[のの近く付近]\s*で\s*(リマインド|する|完成)/,
        address: /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+[都道府県市区町村字][\d\w\-]*)/
    }
};

const COMMAND_PATTERNS = {
    zh: {
        add: /[新增加創建]\s*(提醒|代辦|任務)/,
        list: /[查看列出顯示]\s*(提醒|代辦|任務)/,
        delete: /[刪除移除取消]\s*(提醒|代辦|任務)/,
        complete: /[完成標記結束]\s*(提醒|代辦|任務)/,
        update: /[修改更新編輯]\s*(提醒|代辦|任務)/,
        search: /[搜尋搜索查找]\s*(提醒|代辦|任務)/
    },
    ja: {
        add: /[追加新規作成]\s*(リマインド|タスク|予定)/,
        list: /[表示一覧確認]\s*(リマインド|タスク|予定)/,
        delete: /[削除除去取消]\s*(リマインド|タスク|予定)/,
        complete: /[完了終了]\s*(リマインド|タスク|予定)/,
        update: /[更新編集修正]\s*(リマインド|タスク|予定)/,
        search: /[検索探す]\s*(リマインド|タスク|予定)/
    }
};

const DATE_FORMATS = {
    zh: [
        'YYYY年MM月DD日',
        'MM月DD日',
        'YYYY-MM-DD',
        'MM-DD',
        'M/D',
        'YYYY/MM/DD'
    ],
    ja: [
        'YYYY年MM月DD日',
        'MM月DD日',
        'YYYY-MM-DD',
        'MM-DD',
        'M/D',
        'YYYY/MM/DD'
    ]
};

const TIME_FORMATS = {
    zh: [
        'HH點mm分',
        'HH點',
        'HH:mm',
        'HH時mm分',
        'H點',
        'H時'
    ],
    ja: [
        'HH時mm分',
        'HH時',
        'HH:mm',
        'H時mm分',
        'H時'
    ]
};

const VALIDATION_RULES = {
    minYear: 2024,
    maxYear: 2030,
    minHour: 0,
    maxHour: 23,
    minMinute: 0,
    maxMinute: 59,
    maxDaysInFuture: 365 * 2, // 2年
    minMinutesFromNow: 1 // 至少1分鐘後
};

const DEFAULT_TIMES = {
    morning: {hour: 9, minute: 0},
    afternoon: {hour: 14, minute: 0},
    evening: {hour: 18, minute: 0},
    night: {hour: 21, minute: 0}
};

const SPECIAL_DATES = {
    zh: {
        '今天': 0,
        '明天': 1,
        '後天': 2,
        '大後天': 3
    },
    ja: {
        '今日': 0,
        '明日': 1,
        '明後日': 2,
        '明々後日': 3
    }
};

const ORDINAL_NUMBERS = {
    zh: {
        '第一': 1, '第二': 2, '第三': 3, '第四': 4, '第五': 5,
        '第六': 6, '第七': 7, '第八': 8, '第九': 9, '第十': 10,
        '第十一': 11, '第十二': 12, '第十三': 13, '第十四': 14, '第十五': 15,
        '第十六': 16, '第十七': 17, '第十八': 18, '第十九': 19, '第二十': 20,
        '第二十一': 21, '第二十二': 22, '第二十三': 23, '第二十四': 24, '第二十五': 25,
        '第二十六': 26, '第二十七': 27, '第二十八': 28, '第二十九': 29, '第三十': 30, '第三十一': 31
    },
    ja: {
        '第一': 1, '第二': 2, '第三': 3, '第四': 4, '第五': 5,
        '第六': 6, '第七': 7, '第八': 8, '第九': 9, '第十': 10,
        '一日': 1, '二日': 2, '三日': 3, '四日': 4, '五日': 5,
        '六日': 6, '七日': 7, '八日': 8, '九日': 9, '十日': 10,
        '十一日': 11, '十二日': 12, '十三日': 13, '十四日': 14, '十五日': 15,
        '十六日': 16, '十七日': 17, '十八日': 18, '十九日': 19, '二十日': 20,
        '二十一日': 21, '二十二日': 22, '二十三日': 23, '二十四日': 24, '二十五日': 25,
        '二十六日': 26, '二十七日': 27, '二十八日': 28, '二十九日': 29, '三十日': 30, '三十一日': 31
    }
};

const NUMBER_WORDS = {
    zh: {
        '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
        '十': 10, '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
        '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
        '二十一': 21, '二十二': 22, '二十三': 23, '二十四': 24, '二十五': 25,
        '二十六': 26, '二十七': 27, '二十八': 28, '二十九': 29, '三十': 30
    },
    ja: {
        '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
        '十': 10, '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
        '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
        '二十一': 21, '二十二': 22, '二十三': 23, '二十四': 24
    }
};

const TIMEZONE_OFFSETS = {
    'Asia/Taipei': 8,
    'Asia/Tokyo': 9,
    'Asia/Shanghai': 8,
    'UTC': 0,
    'America/New_York': -5,
    'Europe/London': 0
};

module.exports = {
    DATETIME_PATTERNS,
    WEEKDAY_NAMES,
    MONTH_NAMES,
    TIME_KEYWORDS,
    FUZZY_TIME_MAP,
    RECURRING_KEYWORDS,
    DURATION_PATTERNS,
    RELATIVE_TIME_PATTERNS,
    PRIORITY_KEYWORDS,
    LOCATION_PATTERNS,
    COMMAND_PATTERNS,
    DATE_FORMATS,
    TIME_FORMATS,
    VALIDATION_RULES,
    DEFAULT_TIMES,
    SPECIAL_DATES,
    ORDINAL_NUMBERS,
    NUMBER_WORDS,
    TIMEZONE_OFFSETS
};
