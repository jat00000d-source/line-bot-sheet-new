// constants/dateTimeConstants.js
// 時間解析相關的所有常數定義

const TIME_PATTERNS = {
  // 中文時間模式
  chinese: {
    // 絕對時間
    absoluteTime: [
      /(\d{1,2})點(\d{1,2})分?/,  // 8點30分
      /(\d{1,2})點/,              // 8點
      /上午(\d{1,2})點(\d{1,2})分?/, // 上午8點30分
      /下午(\d{1,2})點(\d{1,2})分?/, // 下午2點30分
      /晚上(\d{1,2})點(\d{1,2})分?/, // 晚上8點30分
      /(\d{1,2}):(\d{2})/,        // 8:30
    ],
    
    // 相對日期
    relativeDate: [
      /今天|今日/,
      /明天|明日/,
      /後天/,
      /大後天/,
      /下週|下星期/,
      /下個月|下月/,
      /下個禮拜/,
    ],
    
    // 星期
    weekdays: [
      /星期[一二三四五六日天]/,
      /週[一二三四五六日天]/,
      /禮拜[一二三四五六日天]/,
    ],
    
    // 日期格式
    dateFormats: [
      /(\d{4})[年\/\-](\d{1,2})[月\/\-](\d{1,2})日?/, // 2024年12月25日
      /(\d{1,2})[月\/\-](\d{1,2})日?/,               // 12月25日
      /(\d{1,2})號/,                                  // 25號
    ],
    
    // 重複模式
    repeatPatterns: [
      /每天|每日/,
      /每週|每星期|每禮拜/,
      /每月|每個月/,
      /每年|每一年/,
      /每(\d+)天/,
      /每(\d+)週/,
      /每(\d+)個月/,
    ]
  },
  
  // 日文時間模式
  japanese: {
    // 絕對時間
    absoluteTime: [
      /(\d{1,2})時(\d{1,2})分/,   // 8時30分
      /(\d{1,2})時/,              // 8時
      /午前(\d{1,2})時(\d{1,2})分?/, // 午前8時30分
      /午後(\d{1,2})時(\d{1,2})分?/, // 午後2時30分
      /夜(\d{1,2})時(\d{1,2})分?/,   // 夜8時30分
    ],
    
    // 相對日期
    relativeDate: [
      /今日|きょう/,
      /明日|あした|あす/,
      /明後日|あさって/,
      /明々後日|しあさって/,
      /来週|らいしゅう/,
      /来月|らいげつ/,
      /来年|らいねん/,
    ],
    
    // 星期
    weekdays: [
      /[月火水木金土日]曜日?/,
    ],
    
    // 日期格式
    dateFormats: [
      /(\d{4})年(\d{1,2})月(\d{1,2})日/, // 2024年12月25日
      /(\d{1,2})月(\d{1,2})日/,         // 12月25日
      /(\d{1,2})日/,                    // 25日
    ],
    
    // 重複模式
    repeatPatterns: [
      /毎日|まいにち/,
      /毎週|まいしゅう/,
      /毎月|まいつき/,
      /毎年|まいとし|まいねん/,
      /(\d+)日毎/,
      /(\d+)週間毎/,
      /(\d+)ヶ月毎/,
    ]
  }
};

// 時間關鍵字映射
const TIME_KEYWORDS = {
  chinese: {
    // 時間段
    morning: ['上午', '早上', '早晨', '清晨'],
    afternoon: ['下午', '午後'],
    evening: ['晚上', '夜晚', '傍晚'],
    night: ['深夜', '半夜'],
    
    // 相對時間
    relative: {
      '今天': 0,
      '今日': 0,
      '明天': 1,
      '明日': 1,
      '後天': 2,
      '大後天': 3,
    },
    
    // 星期映射
    weekdays: {
      '星期一': 1, '週一': 1, '禮拜一': 1,
      '星期二': 2, '週二': 2, '禮拜二': 2,
      '星期三': 3, '週三': 3, '禮拜三': 3,
      '星期四': 4, '週四': 4, '禮拜四': 4,
      '星期五': 5, '週五': 5, '禮拜五': 5,
      '星期六': 6, '週六': 6, '禮拜六': 6,
      '星期日': 0, '週日': 0, '禮拜日': 0,
      '星期天': 0, '週天': 0, '禮拜天': 0,
    },
    
    // 月份
    months: {
      '一月': 1, '二月': 2, '三月': 3, '四月': 4,
      '五月': 5, '六月': 6, '七月': 7, '八月': 8,
      '九月': 9, '十月': 10, '十一月': 11, '十二月': 12,
    }
  },
  
  japanese: {
    // 時間段
    morning: ['午前', 'ごぜん', '朝', 'あさ'],
    afternoon: ['午後', 'ごご', '昼', 'ひる'],
    evening: ['夕方', 'ゆうがた', '夜', 'よる'],
    night: ['深夜', 'しんや', '夜中', 'よなか'],
    
    // 相對時間
    relative: {
      '今日': 0, 'きょう': 0,
      '明日': 1, 'あした': 1, 'あす': 1,
      '明後日': 2, 'あさって': 2,
      '明々後日': 3, 'しあさって': 3,
    },
    
    // 星期映射
    weekdays: {
      '月曜日': 1, '月曜': 1,
      '火曜日': 2, '火曜': 2,
      '水曜日': 3, '水曜': 3,
      '木曜日': 4, '木曜': 4,
      '金曜日': 5, '金曜': 5,
      '土曜日': 6, '土曜': 6,
      '日曜日': 0, '日曜': 0,
    },
    
    // 月份
    months: {
      '一月': 1, '二月': 2, '三月': 3, '四月': 4,
      '五月': 5, '六月': 6, '七月': 7, '八月': 8,
      '九月': 9, '十月': 10, '十一月': 11, '十二月': 12,
    }
  }
};

// 重複間隔類型
const REPEAT_TYPES = {
  NONE: 'none',        // 不重複
  DAILY: 'daily',      // 每日
  WEEKLY: 'weekly',    // 每週
  MONTHLY: 'monthly',  // 每月
  YEARLY: 'yearly',    // 每年
  CUSTOM: 'custom',    // 自定義間隔
};

// 優先級定義
const PRIORITY_LEVELS = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

// 提醒狀態
const REMINDER_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// 時區設定
const TIMEZONE = 'Asia/Taipei';

// 日期時間格式
const DATE_FORMATS = {
  ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  DISPLAY: 'YYYY年MM月DD日 HH:mm',
  TIME_ONLY: 'HH:mm',
  DATE_ONLY: 'YYYY-MM-DD',
};

// 驗證規則
const VALIDATION_RULES = {
  // 時間範圍（24小時制）
  VALID_HOURS: { min: 0, max: 23 },
  VALID_MINUTES: { min: 0, max: 59 },
  
  // 日期範圍
  VALID_DAYS: { min: 1, max: 31 },
  VALID_MONTHS: { min: 1, max: 12 },
  
  // 重複間隔限制
  MAX_CUSTOM_INTERVAL_DAYS: 365,
  MIN_CUSTOM_INTERVAL_DAYS: 1,
  
  // 提醒數量限制
  MAX_REMINDERS_PER_USER: 100,
};

// 錯誤訊息類型
const ERROR_TYPES = {
  INVALID_TIME_FORMAT: 'invalid_time_format',
  INVALID_DATE_FORMAT: 'invalid_date_format',
  PAST_DATE_TIME: 'past_date_time',
  INVALID_REPEAT_PATTERN: 'invalid_repeat_pattern',
  MAX_REMINDERS_EXCEEDED: 'max_reminders_exceeded',
};

module.exports = {
  TIME_PATTERNS,
  TIME_KEYWORDS,
  REPEAT_TYPES,
  PRIORITY_LEVELS,
  REMINDER_STATUS,
  TIMEZONE,
  DATE_FORMATS,
  VALIDATION_RULES,
  ERROR_TYPES,
};
