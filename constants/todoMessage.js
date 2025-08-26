// constants/todoMessage.js - 提醒訊息模板和常數
const REMINDER_TYPES = {
  ONCE: 'once',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  CUSTOM: 'custom'
};

const REMINDER_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DELETED: 'deleted',
  PAUSED: 'paused'
};

const LANGUAGES = {
  CHINESE: 'zh',
  JAPANESE: 'ja'
};

// 提醒類型標籤
const TYPE_LABELS = {
  [LANGUAGES.CHINESE]: {
    [REMINDER_TYPES.ONCE]: '一次性',
    [REMINDER_TYPES.DAILY]: '每日',
    [REMINDER_TYPES.WEEKLY]: '每週',
    [REMINDER_TYPES.MONTHLY]: '每月',
    [REMINDER_TYPES.CUSTOM]: '自定義'
  },
  [LANGUAGES.JAPANESE]: {
    [REMINDER_TYPES.ONCE]: '一回限り',
    [REMINDER_TYPES.DAILY]: '毎日',
    [REMINDER_TYPES.WEEKLY]: '毎週',
    [REMINDER_TYPES.MONTHLY]: '毎月',
    [REMINDER_TYPES.CUSTOM]: 'カスタム'
  }
};

// 狀態標籤
const STATUS_LABELS = {
  [LANGUAGES.CHINESE]: {
    [REMINDER_STATUS.ACTIVE]: '活躍',
    [REMINDER_STATUS.COMPLETED]: '已完成',
    [REMINDER_STATUS.DELETED]: '已刪除',
    [REMINDER_STATUS.PAUSED]: '已暫停'
  },
  [LANGUAGES.JAPANESE]: {
    [REMINDER_STATUS.ACTIVE]: 'アクティブ',
    [REMINDER_STATUS.COMPLETED]: '完了',
    [REMINDER_STATUS.DELETED]: '削除済み',
    [REMINDER_STATUS.PAUSED]: '一時停止'
  }
};

// 成功訊息模板
const SUCCESS_MESSAGES = {
  [LANGUAGES.CHINESE]: {
    REMINDER_CREATED: (title, datetime, type) => 
      `✅ 提醒已建立！\n\n📋 標題：${title}\n⏰ 時間：${datetime}\n🔔 類型：${TYPE_LABELS[LANGUAGES.CHINESE][type]}`,
    
    REMINDER_COMPLETED: (id) => 
      `✅ 提醒 ${id} 已完成！`,
    
    REMINDER_DELETED: (id) => 
      `🗑️ 提醒 ${id} 已刪除`,
    
    REMINDER_UPDATED: (id) => 
      `✏️ 提醒 ${id} 已更新`,
    
    REMINDER_LIST_EMPTY: '📝 目前沒有活躍的提醒事項',
    
    REMINDER_STATS: (stats) => 
      `📊 提醒統計\n總計：${stats.total}\n活躍：${stats.active}\n已完成：${stats.completed}`
  },
  
  [LANGUAGES.JAPANESE]: {
    REMINDER_CREATED: (title, datetime, type) => 
      `✅ リマインダーを作成しました！\n\n📋 タイトル：${title}\n⏰ 時間：${datetime}\n🔔 タイプ：${TYPE_LABELS[LANGUAGES.JAPANESE][type]}`,
    
    REMINDER_COMPLETED: (id) => 
      `✅ リマインダー ${id} を完了しました！`,
    
    REMINDER_DELETED: (id) => 
      `🗑️ リマインダー ${id} を削除しました`,
    
    REMINDER_UPDATED: (id) => 
      `✏️ リマインダー ${id} を更新しました`,
    
    REMINDER_LIST_EMPTY: '📝 現在アクティブなリマインダーはありません',
    
    REMINDER_STATS: (stats) => 
      `📊 リマインダー統計\n総数：${stats.total}\nアクティブ：${stats.active}\n完了：${stats.completed}`
  }
};

// 錯誤訊息模板
const ERROR_MESSAGES = {
  [LANGUAGES.CHINESE]: {
    INVALID_FORMAT: '❌ 輸入格式無效，請檢查格式是否正確',
    REMINDER_NOT_FOUND: '❌ 找不到指定的提醒',
    INVALID_DATETIME: '❌ 日期時間格式無效',
    TITLE_REQUIRED: '❌ 提醒標題為必填項目',
    TITLE_TOO_LONG: '❌ 標題長度不能超過100字符',
    DESCRIPTION_TOO_LONG: '❌ 描述長度不能超過500字符',
    INVALID_TYPE: '❌ 無效的提醒類型',
    PAST_DATETIME: '❌ 提醒時間不能早於當前時間',
    SERVICE_UNAVAILABLE: '❌ 提醒服務暫時無法使用',
    CREATION_FAILED: '❌ 建立提醒失敗',
    UPDATE_FAILED: '❌ 更新提醒失敗',
    DELETE_FAILED: '❌ 刪除提醒失敗',
    PARSE_FAILED: '❌ 無法解析輸入內容',
    UNKNOWN_COMMAND: '❌ 無法識別的指令'
  },
  
  [LANGUAGES.JAPANESE]: {
    INVALID_FORMAT: '❌ 入力形式が無効です。形式を確認してください',
    REMINDER_NOT_FOUND: '❌ 指定されたリマインダーが見つかりません',
    INVALID_DATETIME: '❌ 日時の形式が無効です',
    TITLE_REQUIRED: '❌ リマインダーのタイトルは必須項目です',
    TITLE_TOO_LONG: '❌ タイトルの長さは100文字を超えることはできません',
    DESCRIPTION_TOO_LONG: '❌ 説明の長さは500文字を超えることはできません',
    INVALID_TYPE: '❌ 無効なリマインダータイプです',
    PAST_DATETIME: '❌ リマインダー時間は現在時刻より前にはできません',
    SERVICE_UNAVAILABLE: '❌ リマインダーサービスは一時的に利用できません',
    CREATION_FAILED: '❌ リマインダーの作成に失敗しました',
    UPDATE_FAILED: '❌ リマインダーの更新に失敗しました',
    DELETE_FAILED: '❌ リマインダーの削除に失敗しました',
    PARSE_FAILED: '❌ 入力内容を解析できません',
    UNKNOWN_COMMAND: '❌ 認識できないコマンドです'
  }
};

// 幫助訊息
const HELP_MESSAGES = {
  [LANGUAGES.CHINESE]: {
    BASIC_HELP: `📋 提醒功能使用說明

🔧 基本指令：
• 新增提醒 [內容] - 新增提醒事項
• 查看提醒 - 顯示所有活躍提醒
• 完成提醒 [編號] - 完成指定提醒
• 刪除提醒 [編號] - 刪除指定提醒

⏰ 時間設定範例：
• 明天9點 去買菜
• 每天8點 吃藥
• 每週一 準備會議
• 每月1號 繳房租

📌 使用範例：
• 新增提醒 明天的會議資料準備
• 提醒我 每天8點吃藥
• 代辦 週五要交報告

💡 支援自然語言，輸入更彈性！`,

    ADVANCED_HELP: `📋 提醒功能進階說明

🕒 時間格式支援：
• 具體時間：9點、14:30、下午2點
• 相對日期：明天、後天、下週一
• 重複模式：每天、每週、每月

📅 重複模式詳解：
• 每天 8點 - 每日重複
• 每週一三五 - 指定星期重複
• 每月1號15號 - 指定日期重複
• 每3天 - 自定義間隔重複

📍 位置提醒：
• 在公司提醒我開會
• 到醫院記得拿藥

🌐 語言支援：
• 完整支援中文和日文
• 可混合使用兩種語言`,

    EXAMPLES: `📌 提醒功能使用範例

⏰ 一次性提醒：
• 明天9點開會
• 後天下午2點看醫生
• 下週五交報告

🔄 重複提醒：
• 每天8點吃藥
• 每週一準備會議資料
• 每月1號繳房租
• 每3天澆花

📍 位置提醒：
• 到公司提醒我開會
• 在醫院記得拿藥
• 去超市買菜

🎯 智能解析：
• 記住明天要買牛奶
• 別忘記週三的聚餐
• 下個月要續約保險`
  },
  
  [LANGUAGES.JAPANESE]: {
    BASIC_HELP: `📋 リマインダー機能使用説明

🔧 基本コマンド：
• リマインダー追加 [内容] - 新しいリマインダーを追加
• リマインダーリスト - アクティブなリマインダーを表示
• リマインダー完了 [番号] - リマインダーを完了
• リマインダー削除 [番号] - リマインダーを削除

⏰ 時間設定例：
• 明日9時 買い物に行く
• 毎日8時 薬を飲む
• 毎週月曜日 会議の準備
• 毎月1日 家賃の支払い

📌 使用例：
• リマインダー追加 明日の会議資料準備
• 提醒我 毎日薬を飲む
• タスク 金曜日レポート提出

💡 自然言語対応で、柔軟な入力が可能です！`,

    ADVANCED_HELP: `📋 リマインダー機能詳細説明

🕒 時間形式サポート：
• 具体的時間：9時、14:30、午後2時
• 相対日付：明日、明後日、来週月曜日
• 繰り返しパターン：毎日、毎週、毎月

📅 繰り返しパターン詳解：
• 毎日 8時 - 毎日繰り返し
• 毎週月水金 - 指定曜日繰り返し
• 毎月1日15日 - 指定日付繰り返し
• 3日毎 - カスタム間隔繰り返し

📍 場所リマインダー：
• 会社で会議を思い出させて
• 病院で薬をもらうのを忘れずに

🌐 言語サポート：
• 日本語と中国語完全対応
• 両言語の混在使用可能`,

    EXAMPLES: `📌 リマインダー機能使用例

⏰ 一回限りリマインダー：
• 明日9時会議
• 明後日午後2時病院
• 来週金曜日レポート提出

🔄 繰り返しリマインダー：
• 毎日8時薬を飲む
• 毎週月曜日会議資料準備
• 毎月1日家賃支払い
• 3日毎花に水やり

📍 場所リマインダー：
• 会社で会議を思い出させて
• 病院で薬をもらうのを忘れずに
• スーパーで買い物

🎯 スマート解析：
• 明日牛乳を買うのを覚えて
• 水曜日の食事会を忘れずに
• 来月保険の更新`
  }
};

// 提醒觸發訊息模板
const REMINDER_TRIGGER_MESSAGES = {
  [LANGUAGES.CHINESE]: {
    BASIC_TRIGGER: (title, location) => {
      let message = `🔔 提醒通知\n\n📋 ${title}`;
      if (location) {
        message += `\n📍 地點：${location}`;
      }
      message += `\n\n⏰ 提醒時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`;
      return message;
    },
    
    RECURRING_TRIGGER: (title, type, nextTime) => 
      `🔔 定期提醒\n\n📋 ${title}\n🔄 類型：${type}\n⏰ 下次提醒：${nextTime}`,
    
    LOCATION_TRIGGER: (title, location) => 
      `📍 位置提醒\n\n📋 ${title}\n🗺️ 已到達：${location}`
  },
  
  [LANGUAGES.JAPANESE]: {
    BASIC_TRIGGER: (title, location) => {
      let message = `🔔 リマインダー通知\n\n📋 ${title}`;
      if (location) {
        message += `\n📍 場所：${location}`;
      }
      message += `\n\n⏰ 通知時刻：${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Taipei' })}`;
      return message;
    },
    
    RECURRING_TRIGGER: (title, type, nextTime) => 
      `🔔 定期リマインダー\n\n📋 ${title}\n🔄 タイプ：${type}\n⏰ 次回通知：${nextTime}`,
    
    LOCATION_TRIGGER: (title, location) => 
      `📍 場所リマインダー\n\n📋 ${title}\n🗺️ 到着：${location}`
  }
};

// Flex Message 模板（進階功能）
const FLEX_MESSAGE_TEMPLATES = {
  REMINDER_CARD: (reminder, language) => ({
    type: 'flex',
    altText: language === LANGUAGES.JAPANESE ? 
      `リマインダー: ${reminder.title}` : 
      `提醒: ${reminder.title}`,
    contents: {
      type: 'bubble',
      hero: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '🔔',
            size: 'xxl',
            align: 'center'
          },
          {
            type: 'text',
            text: language === LANGUAGES.JAPANESE ? 'リマインダー' : '提醒通知',
            weight: 'bold',
            size: 'xl',
            align: 'center',
            margin: 'sm'
          }
        ],
        backgroundColor: '#4A90E2',
        paddingAll: 'lg'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: reminder.title,
            weight: 'bold',
            size: 'lg',
            wrap: true
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            action: {
              type: 'postback',
              label: language === LANGUAGES.JAPANESE ? '完了' : '完成',
              data: `action=complete&id=${reminder.id}`
            }
          },
          {
            type: 'button',
            style: 'secondary',
            height: 'sm',
            action: {
              type: 'postback',
              label: language === LANGUAGES.JAPANESE ? '延期' : '延期',
              data: `action=snooze&id=${reminder.id}`
            },
            margin: 'sm'
          }
        ]
      }
    }
  }),

  REMINDER_LIST: (reminders, language) => ({
    type: 'flex',
    altText: language === LANGUAGES.JAPANESE ? 
      'リマインダーリスト' : 
      '提醒列表',
    contents: {
      type: 'carousel',
      contents: reminders.slice(0, 10).map(reminder => ({
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: reminder.title,
              weight: 'bold',
              size: 'md',
              wrap: true
            },
            {
              type: 'text',
              text: new Date(reminder.next_trigger).toLocaleString(
                language === LANGUAGES.JAPANESE ? 'ja-JP' : 'zh-TW',
                { timeZone: 'Asia/Taipei' }
              ),
              size: 'sm',
              color: '#888888',
              margin: 'sm'
            },
            {
              type: 'text',
              text: TYPE_LABELS[language][reminder.type],
              size: 'xs',
              color: '#4A90E2',
              margin: 'sm'
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'button',
              style: 'primary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: language === LANGUAGES.JAPANESE ? '完了' : '完成',
                data: `action=complete&id=${reminder.id}`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              flex: 1,
              action: {
                type: 'postback',
                label: language === LANGUAGES.JAPANESE ? '削除' : '刪除',
                data: `action=delete&id=${reminder.id}`
              },
              margin: 'sm'
            }
          ]
        }
      }))
    }
  })
};

// 指令關鍵字映射
const COMMAND_KEYWORDS = {
  [LANGUAGES.CHINESE]: {
    ADD: ['新增提醒', '提醒我', '新增代辦', '代辦', '記住', '別忘記'],
    LIST: ['查看提醒', '查看代辦', '提醒列表', '代辦列表', '我的提醒'],
    COMPLETE: ['完成提醒', '完成代辦', '完成'],
    DELETE: ['刪除提醒', '刪除代辦', '刪除', '移除提醒'],
    HELP: ['提醒說明', '提醒幫助', '代辦說明', '使用說明'],
    STATS: ['提醒統計', '統計資料', '我的統計']
  },
  
  [LANGUAGES.JAPANESE]: {
    ADD: ['リマインダー追加', 'リマインダー', 'タスク追加', 'タスク', '覚えて', '忘れずに'],
    LIST: ['リマインダー確認', 'リマインダーリスト', 'タスクリスト', '私のリマインダー'],
    COMPLETE: ['リマインダー完了', 'タスク完了', '完了'],
    DELETE: ['リマインダー削除', 'タスク削除', '削除', 'リマインダー除去'],
    HELP: ['リマインダーヘルプ', 'タスクヘルプ', '使用方法', 'ヘルプ'],
    STATS: ['リマインダー統計', '統計データ', '私の統計']
  }
};

// 時間相關常數
const TIME_CONSTANTS = {
  TIMEZONE: 'Asia/Taipei',
  DEFAULT_REMINDER_HOUR: 9,
  DEFAULT_REMINDER_MINUTE: 0,
  MAX_FUTURE_YEARS: 1,
  CLEANUP_DAYS: 30
};

// 驗證規則
const VALIDATION_RULES = {
  TITLE_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
  LOCATION_MAX_LENGTH: 100,
  MIN_FUTURE_MINUTES: 1
};

module.exports = {
  REMINDER_TYPES,
  REMINDER_STATUS,
  LANGUAGES,
  TYPE_LABELS,
  STATUS_LABELS,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  HELP_MESSAGES,
  REMINDER_TRIGGER_MESSAGES,
  FLEX_MESSAGE_TEMPLATES,
  COMMAND_KEYWORDS,
  TIME_CONSTANTS,
  VALIDATION_RULES
};
