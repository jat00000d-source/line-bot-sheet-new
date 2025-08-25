const TODO_MESSAGES = {
    zh: {
        // 基本操作
        todoAdded: '✅ 代辦事項已新增',
        todoCompleted: '🎉 代辦事項已完成',
        todoDeleted: '🗑️ 代辦事項已刪除',
        todoUpdated: '✏️ 代辦事項已更新',
        todoNotFound: '❌ 找不到指定的代辦事項',
        noTodos: '📋 目前沒有代辦事項',
        
        // 提醒相關
        reminderSet: '⏰ 提醒已設定',
        reminderDeleted: '🔕 提醒已刪除',
        reminderNotFound: '❌ 找不到指定的提醒',
        noReminders: '🔕 目前沒有提醒',
        reminderTriggered: '🔔 提醒時間到了！',
        
        // 錯誤訊息
        invalidCommand: '❌ 指令格式錯誤，請重新輸入',
        invalidDate: '❌ 日期格式錯誤，請使用正確格式',
        invalidPriority: '❌ 優先級必須是：高、中、低',
        titleRequired: '❌ 代辦事項標題不能為空',
        
        // 指令說明
        help: {
            title: '📋 代辦功能說明',
            commands: [
                '📝 新增代辦：代辦 買菜',
                '✅ 完成代辦：完成 1',
                '📋 查看代辦：代辦列表',
                '🗑️ 刪除代辦：刪除代辦 1',
                '⏰ 設定提醒：提醒 1 明天8點',
                '🔍 查看提醒：提醒列表',
                '🔕 刪除提醒：刪除提醒 1'
            ]
        },
        
        // 時間表達式
        timeExpressions: {
            tomorrow: '明天',
            today: '今天',
            nextWeek: '下週',
            nextMonth: '下個月',
            everyday: '每天',
            weekly: '每週',
            monthly: '每月'
        },
        
        // 優先級
        priority: {
            high: '高',
            medium: '中', 
            low: '低'
        },
        
        // 狀態
        status: {
            pending: '待辦',
            completed: '已完成'
        },
        
        // 提醒類型
        reminderTypes: {
            once: '一次性',
            daily: '每日',
            weekly: '每週', 
            monthly: '每月',
            custom: '自定義'
        },
        
        // 星期
        weekdays: ['日', '一', '二', '三', '四', '五', '六'],
        
        // 按鈕文字
        buttons: {
            complete: '完成',
            delete: '刪除',
            setReminder: '設提醒',
            viewDetails: '查看詳情',
            back: '返回'
        }
    },
    
    ja: {
        // 基本操作
        todoAdded: '✅ タスクを追加しました',
        todoCompleted: '🎉 タスクを完了しました',
        todoDeleted: '🗑️ タスクを削除しました',
        todoUpdated: '✏️ タスクを更新しました',
        todoNotFound: '❌ 指定されたタスクが見つかりません',
        noTodos: '📋 現在タスクはありません',
        
        // 提醒相關
        reminderSet: '⏰ リマインダーを設定しました',
        reminderDeleted: '🔕 リマインダーを削除しました',
        reminderNotFound: '❌ 指定されたリマインダーが見つかりません',
        noReminders: '🔕 現在リマインダーはありません',
        reminderTriggered: '🔔 リマインダーの時間です！',
        
        // 錯誤訊息
        invalidCommand: '❌ コマンドの形式が間違っています。再入力してください',
        invalidDate: '❌ 日付の形式が間違っています。正しい形式を使用してください',
        invalidPriority: '❌ 優先度は「高」「中」「低」のいずれかでなければなりません',
        titleRequired: '❌ タスクのタイトルは空にできません',
        
        // 指令說明
        help: {
            title: '📋 タスク機能の説明',
            commands: [
                '📝 タスク追加：タスク 買い物',
                '✅ タスク完了：完了 1',
                '📋 タスク確認：タスクリスト',
                '🗑️ タスク削除：タスク削除 1',
                '⏰ リマインダー設定：リマインダー 1 明日8時',
                '🔍 リマインダー確認：リマインダーリスト',
                '🔕 リマインダー削除：リマインダー削除 1'
            ]
        },
        
        // 時間表達式
        timeExpressions: {
            tomorrow: '明日',
            today: '今日',
            nextWeek: '来週',
            nextMonth: '来月',
            everyday: '毎日',
            weekly: '毎週',
            monthly: '毎月'
        },
        
        // 優先級
        priority: {
            high: '高',
            medium: '中',
            low: '低'
        },
        
        // 狀態
        status: {
            pending: '未完了',
            completed: '完了'
        },
        
        // 提醒類型
        reminderTypes: {
            once: '一度だけ',
            daily: '毎日',
            weekly: '毎週',
            monthly: '毎月',
            custom: 'カスタム'
        },
        
        // 星期
        weekdays: ['日', '月', '火', '水', '木', '金', '土'],
        
        // 按鈕文字
        buttons: {
            complete: '完了',
            delete: '削除',
            setReminder: 'リマインダー設定',
            viewDetails: '詳細表示',
            back: '戻る'
        }
    }
};

// 指令關鍵字配對
const COMMAND_KEYWORDS = {
    zh: {
        // 新增代辦
        addTodo: ['代辦', '待辦', '任務', '新增', '加入', 'todo', 'task'],
        
        // 完成代辦
        completeTodo: ['完成', '完成代辦', '完成任務', 'complete', 'done'],
        
        // 刪除代辦
        deleteTodo: ['刪除', '刪除代辦', '移除', 'delete', 'remove'],
        
        // 查看代辦
        listTodos: ['代辦列表', '任務列表', '查看代辦', '列表', 'list'],
        
        // 設定提醒
        setReminder: ['提醒', '設定提醒', '鬧鐘', 'reminder', 'alert'],
        
        // 查看提醒
        listReminders: ['提醒列表', '查看提醒', '所有提醒'],
        
        // 刪除提醒
        deleteReminder: ['刪除提醒', '移除提醒', '取消提醒'],
        
        // 幫助
        help: ['說明', '幫助', '指令', 'help']
    },
    
    ja: {
        // 新增代辦
        addTodo: ['タスク', 'todo', '追加', '新規'],
        
        // 完成代辦
        completeTodo: ['完了', '完成', 'complete', 'done'],
        
        // 刪除代辦
        deleteTodo: ['削除', '消去', 'delete', 'remove'],
        
        // 查看代辦
        listTodos: ['タスクリスト', 'リスト', 'list'],
        
        // 設定提醒
        setReminder: ['リマインダー', '通知', 'reminder'],
        
        // 查看提醒
        listReminders: ['リマインダーリスト', 'リマインダー一覧'],
        
        // 刪除提醒
        deleteReminder: ['リマインダー削除', 'リマインダー消去'],
        
        // 幫助
        help: ['ヘルプ', '説明', 'help']
    }
};

// 時間解析的正則表達式
const TIME_PATTERNS = {
    zh: {
        // 相對時間
        relative: {
            今天: /今天|今日/,
            明天: /明天|明日/,
            後天: /後天|后天/,
            下週: /下週|下周|下星期|下礼拜/,
            下個月: /下個月|下月/,
            明年: /明年/
        },
        
        // 絕對時間
        absolute: {
            date: /(\d{1,2})月(\d{1,2})日?/,
            datetime: /(\d{1,2})月(\d{1,2})日?\s*(\d{1,2})[點时](\d{1,2})?分?/,
            time: /(\d{1,2})[點时](\d{1,2})?分?/
        },
        
        // 循環時間
        recurring: {
            每天: /每天|每日/,
            每週: /每週|每周/,
            每月: /每月/,
            每年: /每年/,
            工作日: /工作日|平日/,
            週末: /週末|周末/
        },
        
        // 星期
        weekdays: {
            週一: /週一|周一|星期一/,
            週二: /週二|周二|星期二/,
            週三: /週三|周三|星期三/,
            週四: /週四|周四|星期四/,
            週五: /週五|周五|星期五/,
            週六: /週六|周六|星期六/,
            週日: /週日|周日|星期日|星期天/
        }
    },
    
    ja: {
        // 相對時間
        relative: {
            今日: /今日|きょう/,
            明日: /明日|あした|あす/,
            明後日: /明後日|あさって/,
            来週: /来週|らいしゅう/,
            来月: /来月|らいげつ/,
            来年: /来年|らいねん/
        },
        
        // 絕對時間
        absolute: {
            date: /(\d{1,2})月(\d{1,2})日/,
            datetime: /(\d{1,2})月(\d{1,2})日\s*(\d{1,2})時(\d{1,2})?分?/,
            time: /(\d{1,2})時(\d{1,2})?分?/
        },
        
        // 循環時間
        recurring: {
            毎日: /毎日|まいにち/,
            毎週: /毎週|まいしゅう/,
            毎月: /毎月|まいつき/,
            毎年: /毎年|まいねん/,
            平日: /平日|へいじつ/,
            週末: /週末|しゅうまつ/
        },
        
        // 星期
        weekdays: {
            月曜日: /月曜日|げつようび/,
            火曜日: /火曜日|かようび/,
            水曜日: /水曜日|すいようび/,
            木曜日: /木曜日|もくようび/,
            金曜日: /金曜日|きんようび/,
            土曜日: /土曜日|どようび/,
            日曜日: /日曜日|にちようび/
        }
    }
};

// 優先級關鍵字
const PRIORITY_KEYWORDS = {
    zh: {
        high: ['高', '重要', '急', '緊急', 'high'],
        medium: ['中', '普通', '一般', 'medium'],
        low: ['低', '不急', '可延', 'low']
    },
    ja: {
        high: ['高', '重要', '急', '緊急', 'high'],
        medium: ['中', '普通', '通常', 'medium'], 
        low: ['低', '急がない', 'low']
    }
};

// Flex Message 模板
const FLEX_TEMPLATES = {
    todoList: {
        type: "carousel",
        contents: []
    },
    
    reminderList: {
        type: "carousel", 
        contents: []
    },
    
    todoItem: {
        type: "bubble",
        header: {
            type: "box",
            layout: "vertical",
            contents: []
        },
        body: {
            type: "box",
            layout: "vertical", 
            contents: []
        },
        footer: {
            type: "box",
            layout: "vertical",
            contents: []
        }
    }
};

// 快速回覆按鈕
const QUICK_REPLY_BUTTONS = {
    zh: [
        {
            type: "action",
            action: {
                type: "message",
                label: "📝 新增代辦",
                text: "代辦"
            }
        },
        {
            type: "action", 
            action: {
                type: "message",
                label: "📋 代辦列表",
                text: "代辦列表"
            }
        },
        {
            type: "action",
            action: {
                type: "message", 
                label: "⏰ 提醒列表",
                text: "提醒列表"
            }
        },
        {
            type: "action",
            action: {
                type: "message",
                label: "❓ 說明",
                text: "代辦說明"
            }
        }
    ],
    
    ja: [
        {
            type: "action",
            action: {
                type: "message",
                label: "📝 タスク追加",
                text: "タスク"
            }
        },
        {
            type: "action",
            action: {
                type: "message",
                label: "📋 タスクリスト", 
                text: "タスクリスト"
            }
        },
        {
            type: "action",
            action: {
                type: "message",
                label: "⏰ リマインダー",
                text: "リマインダーリスト"
            }
        },
        {
            type: "action",
            action: {
                type: "message",
                label: "❓ ヘルプ",
                text: "ヘルプ"
            }
        }
    ]
};

// Google Sheets 工作表設定
const SHEET_CONFIG = {
    todos: {
        name: 'Todos',
        headers: [
            'ID', 'Title', 'Description', 'UserID', 'CreatedAt', 'UpdatedAt',
            'Completed', 'CompletedAt', 'Priority', 'Tags', 'Location',
            'HasReminder', 'ReminderIDs', 'Language'
        ]
    },
    
    reminders: {
        name: 'Reminders', 
        headers: [
            'ID', 'TodoID', 'UserID', 'Title', 'Message', 'Type',
            'TriggerTime', 'CronPattern', 'Timezone', 'Interval',
            'Weekdays', 'MonthDates', 'Active', 'Completed',
            'CreatedAt', 'UpdatedAt', 'LastTriggered', 'NextTrigger',
            'Location', 'LocationRadius', 'Language', 'TriggerCount'
        ]
    }
};

// 語言檢測關鍵字
const LANGUAGE_DETECTION = {
    zh: [
        '代辦', '待辦', '任務', '完成', '刪除', '提醒', '明天', '今天',
        '每天', '每週', '每月', '星期', '月', '日', '點', '分'
    ],
    
    ja: [
        'タスク', '完了', '削除', 'リマインダー', '明日', '今日',
        '毎日', '毎週', '毎月', '曜日', '月', '日', '時', '分'
    ]
};

module.exports = {
    TODO_MESSAGES,
    COMMAND_KEYWORDS,
    TIME_PATTERNS,
    PRIORITY_KEYWORDS,
    FLEX_TEMPLATES,
    QUICK_REPLY_BUTTONS,
    SHEET_CONFIG,
    LANGUAGE_DETECTION
};
