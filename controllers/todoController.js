// controllers/todoController.js - 代辦提醒控制器
const line = require('@line/bot-sdk');

class TodoController {
  constructor() {
    this.client = new line.Client({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
      channelSecret: process.env.LINE_CHANNEL_SECRET,
    });
    
    // 動態載入依賴模組
    this.loadDependencies();
  }

  // 動態載入依賴模組（容錯處理）
  loadDependencies() {
    try {
      const ReminderService = require('../services/reminderService');
      this.reminderService = new ReminderService();
      console.log('✅ ReminderService 載入成功');
    } catch (error) {
      console.log('⚠️ ReminderService 載入失敗:', error.message);
      this.reminderService = null;
    }

    try {
      const DateTimeParser = require('../parsers/dateTimeParser');
      this.dateTimeParser = new DateTimeParser();
      console.log('✅ DateTimeParser 載入成功');
    } catch (error) {
      console.log('⚠️ DateTimeParser 載入失敗:', error.message);
      this.dateTimeParser = null;
    }

    try {
      this.todoMessages = require('../constants/todoMessage');
      console.log('✅ TodoMessages 載入成功');
    } catch (error) {
      console.log('⚠️ TodoMessages 載入失敗:', error.message);
      this.todoMessages = null;
    }
  }

  // 主要指令處理函數
  async handleCommand(event, message, commandInfo) {
    const { language } = commandInfo;
    
    try {
      // 檢查必要依賴
      if (!this.reminderService) {
        return this.sendErrorMessage(event.replyToken, 
          language === 'ja' ? 
          '⚠️ リマインダーサービスが利用できません' : 
          '⚠️ 提醒服務暫時無法使用'
        );
      }

      // 解析指令類型
      const commandType = this.parseCommandType(message, language);
      
      switch (commandType.action) {
        case 'add':
          return await this.handleAddReminder(event, commandType, language);
          
        case 'list':
          return await this.handleListReminders(event, language);
          
        case 'complete':
          return await this.handleCompleteReminder(event, commandType, language);
          
        case 'delete':
          return await this.handleDeleteReminder(event, commandType, language);
          
        case 'help':
          return await this.handleHelp(event, language);
          
        default:
          return await this.handleUnknownCommand(event, message, language);
      }
      
    } catch (error) {
      console.error('TodoController 處理錯誤:', error);
      return this.sendErrorMessage(event.replyToken,
        language === 'ja' ? 
        'リマインダー処理中にエラーが発生しました' : 
        '提醒功能處理時發生錯誤'
      );
    }
  }

  // 解析指令類型
  parseCommandType(message, language) {
    // 新增提醒指令
    const addPatterns = [
      // 中文模式
      /^新增提醒[：:\s　]*(.+)$/,
      /^提醒我[：:\s　]*(.+)$/,
      /^新增代辦[：:\s　]*(.+)$/,
      /^代辦[：:\s　]*(.+)$/,
      // 日文模式
      /^リマインダー追加[：:\s　]*(.+)$/,
      /^リマインダー[：:\s　]*(.+)$/,
      /^タスク追加[：:\s　]*(.+)$/,
      /^タスク[：:\s　]*(.+)$/,
    ];

    // 查看提醒指令
    const listPatterns = [
      /^查看提醒$/, /^查看代辦$/, /^提醒列表$/, /^代辦列表$/,
      /^リマインダー確認$/, /^リマインダーリスト$/, /^タスクリスト$/
    ];

    // 完成提醒指令
    const completePatterns = [
      /^完成提醒[：:\s　]*(\d+)$/,
      /^完成代辦[：:\s　]*(\d+)$/,
      /^完成[：:\s　]*(\d+)$/,
      /^リマインダー完了[：:\s　]*(\d+)$/,
      /^タスク完了[：:\s　]*(\d+)$/,
      /^完了[：:\s　]*(\d+)$/
    ];

    // 刪除提醒指令
    const deletePatterns = [
      /^刪除提醒[：:\s　]*(\d+)$/,
      /^刪除代辦[：:\s　]*(\d+)$/,
      /^刪除[：:\s　]*(\d+)$/,
      /^リマインダー削除[：:\s　]*(\d+)$/,
      /^タスク削除[：:\s　]*(\d+)$/,
      /^削除[：:\s　]*(\d+)$/
    ];

    // 幫助指令
    const helpPatterns = [
      /^提醒說明$/, /^提醒幫助$/, /^代辦說明$/,
      /^リマインダーヘルプ$/, /^タスクヘルプ$/
    ];

    // 檢查各種模式
    for (let pattern of addPatterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          action: 'add',
          content: match[1].trim()
        };
      }
    }

    for (let pattern of listPatterns) {
      if (pattern.test(message)) {
        return { action: 'list' };
      }
    }

    for (let pattern of completePatterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          action: 'complete',
          id: parseInt(match[1])
        };
      }
    }

    for (let pattern of deletePatterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          action: 'delete',
          id: parseInt(match[1])
        };
      }
    }

    for (let pattern of helpPatterns) {
      if (pattern.test(message)) {
        return { action: 'help' };
      }
    }

    // 如果包含提醒關鍵字但不匹配具體格式，嘗試智能解析
    if (this.containsTodoKeywords(message)) {
      return {
        action: 'add',
        content: message,
        needsParsing: true
      };
    }

    return { action: 'unknown', content: message };
  }

  // 檢查是否包含提醒關鍵字
  containsTodoKeywords(message) {
    const todoKeywords = [
      // 中文
      '提醒', '代辦', '待辦', '任務', '記住', '別忘記',
      // 日文
      'リマインダー', 'タスク', '忘れずに', '覚えて'
    ];
    
    return todoKeywords.some(keyword => message.includes(keyword));
  }

  // 處理新增提醒
  async handleAddReminder(event, commandType, language) {
    try {
      let reminderData;
      
      if (commandType.needsParsing && this.dateTimeParser) {
        // 使用自然語言解析
        reminderData = await this.dateTimeParser.parseNaturalLanguage(commandType.content, language);
        if (!reminderData.success) {
          return this.sendErrorMessage(event.replyToken, reminderData.error);
        }
      } else {
        // 基本解析
        reminderData = this.parseBasicReminder(commandType.content, language);
      }

      // 創建提醒
      const result = await this.reminderService.createReminder(reminderData);
      
      if (result.success) {
        const response = language === 'ja' ? 
          `✅ リマインダーを追加しました！\n\n📋 内容：${result.reminder.title}\n⏰ 時間：${result.reminder.datetime}\n🔔 タイプ：${result.reminder.type}` :
          `✅ 提醒已新增！\n\n📋 內容：${result.reminder.title}\n⏰ 時間：${result.reminder.datetime}\n🔔 類型：${result.reminder.type}`;
          
        return this.client.replyMessage(event.replyToken, {
          type: 'text',
          text: response
        });
      } else {
        return this.sendErrorMessage(event.replyToken, result.error);
      }
      
    } catch (error) {
      console.error('新增提醒錯誤:', error);
      return this.sendErrorMessage(event.replyToken,
        language === 'ja' ? 
        'リマインダーの追加に失敗しました' : 
        '新增提醒失敗'
      );
    }
  }

  // 基本提醒解析（當進階解析器不可用時）
  parseBasicReminder(content, language) {
    // 提取時間相關關鍵字
    const timeKeywords = {
      '明天': { type: 'once', offset: 1 },
      '後天': { type: 'once', offset: 2 },
      '每天': { type: 'daily' },
      '每日': { type: 'daily' },
      '每週': { type: 'weekly' },
      '每月': { type: 'monthly' },
      '明日': { type: 'once', offset: 1 },
      '毎日': { type: 'daily' },
      '毎週': { type: 'weekly' },
      '毎月': { type: 'monthly' }
    };

    let reminderType = 'once';
    let reminderTime = new Date();
    reminderTime.setDate(reminderTime.getDate() + 1); // 預設明天
    reminderTime.setHours(9, 0, 0, 0); // 預設早上9點

    // 檢查時間關鍵字
    for (let [keyword, config] of Object.entries(timeKeywords)) {
      if (content.includes(keyword)) {
        reminderType = config.type;
        if (config.offset) {
          reminderTime.setDate(reminderTime.getDate() + config.offset - 1);
        }
        // 移除時間關鍵字，剩下的作為提醒內容
        content = content.replace(keyword, '').trim();
        break;
      }
    }

    // 提取時間（如果有）
    const timeMatch = content.match(/(\d{1,2})[：:點点时](\d{0,2})/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        reminderTime.setHours(hour, minute, 0, 0);
        content = content.replace(timeMatch[0], '').trim();
      }
    }

    return {
      success: true,
      title: content || (language === 'ja' ? 'リマインダー' : '提醒事項'),
      description: '',
      type: reminderType,
      datetime: reminderTime.toISOString(),
      language: language
    };
  }

  // 處理查看提醒列表
  async handleListReminders(event, language) {
    try {
      const reminders = await this.reminderService.getActiveReminders();
      
      if (reminders.length === 0) {
        const response = language === 'ja' ? 
          '📝 現在アクティブなリマインダーはありません' :
          '📝 目前沒有活躍的提醒事項';
          
        return this.client.replyMessage(event.replyToken, {
          type: 'text',
          text: response
        });
      }

      // 格式化提醒列表
      let response = language === 'ja' ? 
        '📋 アクティブなリマインダー：\n\n' :
        '📋 活躍提醒列表：\n\n';

      reminders.forEach((reminder, index) => {
        const datetime = new Date(reminder.datetime).toLocaleString(
          language === 'ja' ? 'ja-JP' : 'zh-TW', 
          { timeZone: 'Asia/Taipei' }
        );
        
        response += `${index + 1}. 📌 ${reminder.title}\n`;
        response += `   ⏰ ${datetime}\n`;
        response += `   🔔 ${this.getTypeLabel(reminder.type, language)}\n\n`;
      });

      return this.client.replyMessage(event.replyToken, {
        type: 'text',
        text: response.trim()
      });
      
    } catch (error) {
      console.error('查看提醒列表錯誤:', error);
      return this.sendErrorMessage(event.replyToken,
        language === 'ja' ? 
        'リマインダーリストの取得に失敗しました' : 
        '無法獲取提醒列表'
      );
    }
  }

  // 處理完成提醒
  async handleCompleteReminder(event, commandType, language) {
    try {
      const result = await this.reminderService.completeReminder(commandType.id);
      
      if (result.success) {
        const response = language === 'ja' ? 
          `✅ リマインダー ${commandType.id} を完了しました！` :
          `✅ 提醒 ${commandType.id} 已完成！`;
          
        return this.client.replyMessage(event.replyToken, {
          type: 'text',
          text: response
        });
      } else {
        return this.sendErrorMessage(event.replyToken, result.error);
      }
      
    } catch (error) {
      console.error('完成提醒錯誤:', error);
      return this.sendErrorMessage(event.replyToken,
        language === 'ja' ? 
        'リマインダーの完了処理に失敗しました' : 
        '完成提醒處理失敗'
      );
    }
  }

  // 處理刪除提醒
  async handleDeleteReminder(event, commandType, language) {
    try {
      const result = await this.reminderService.deleteReminder(commandType.id);
      
      if (result.success) {
        const response = language === 'ja' ? 
          `🗑️ リマインダー ${commandType.id} を削除しました` :
          `🗑️ 提醒 ${commandType.id} 已刪除`;
          
        return this.client.replyMessage(event.replyToken, {
          type: 'text',
          text: response
        });
      } else {
        return this.sendErrorMessage(event.replyToken, result.error);
      }
      
    } catch (error) {
      console.error('刪除提醒錯誤:', error);
      return this.sendErrorMessage(event.replyToken,
        language === 'ja' ? 
        'リマインダーの削除に失敗しました' : 
        '刪除提醒失敗'
      );
    }
  }

  // 處理幫助指令
  async handleHelp(event, language) {
    const helpText = this.getHelpText(language);
    
    return this.client.replyMessage(event.replyToken, {
      type: 'text',
      text: helpText
    });
  }

  // 處理未知指令
  async handleUnknownCommand(event, message, language) {
    const response = language === 'ja' ? 
      `❓ 「${message}」は認識できませんでした。\n\n「リマインダーヘルプ」で使用方法を確認してください。` :
      `❓ 無法識別「${message}」\n\n請輸入「提醒說明」查看使用方法`;
      
    return this.client.replyMessage(event.replyToken, {
      type: 'text',
      text: response
    });
  }

  // 獲取類型標籤
  getTypeLabel(type, language) {
    const labels = {
      once: language === 'ja' ? '一回限り' : '一次性',
      daily: language === 'ja' ? '毎日' : '每日',
      weekly: language === 'ja' ? '毎週' : '每週', 
      monthly: language === 'ja' ? '毎月' : '每月',
      custom: language === 'ja' ? 'カスタム' : '自定義'
    };
    
    return labels[type] || type;
  }

  // 獲取幫助文字
  getHelpText(language) {
    if (language === 'ja') {
      return `📋 リマインダー機能使用説明

🔧 基本コマンド：
• リマインダー追加 [内容] - 新しいリマインダーを追加
• リマインダーリスト - アクティブなリマインダーを表示
• リマインダー完了 [番号] - リマインダーを完了
• リマインダー削除 [番号] - リマインダーを削除

⏰ 時間指定例：
• 明日9時 買い物に行く
• 毎日8時 薬を飲む
• 毎週月曜日 会議の準備
• 毎月1日 家賃の支払い

📌 使用例：
• リマインダー追加 明日の会議資料準備
• 提醒我 每天8點吃藥
• 新增代辦 週五交報告

💡 自然言語対応で、柔軟な入力が可能です！`;
    } else {
      return `📋 提醒功能使用說明

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
• リマインダー追加 毎日薬を飲む
• 代辦 週五要交報告

💡 支援自然語言，輸入更彈性！`;
    }
  }

  // 發送錯誤訊息
  async sendErrorMessage(replyToken, message) {
    return this.client.replyMessage(replyToken, {
      type: 'text',
      text: message
    });
  }
}

module.exports = TodoController;
