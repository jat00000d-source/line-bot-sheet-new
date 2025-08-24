// controllers/todoController.js
const TodoService = require('../services/todoService');
const LanguageDetector = require('../utils/languageDetector');

class TodoController {
  constructor() {
    this.todoService = new TodoService();
  }

  /**
   * 處理待辦提醒相關指令
   * @param {Object} parsedData - 解析後的指令資料
   * @returns {Promise<string>} 回應訊息
   */
  async handleTodo(parsedData) {
    const { commandType, messageText, language, userId } = parsedData;

    try {
      switch (commandType) {
        case 'add_reminder':
          return await this.addReminder(messageText, userId, language);
        
        case 'list_reminders':
          return await this.listReminders(userId, language);
        
        case 'delete_reminder':
          return await this.deleteReminder(messageText, userId, language);
        
        case 'todo_help':
          return this.getHelpMessage(language);
        
        default:
          return language === 'ja' ? 
            '未対応の待辦指令です' : 
            '不支援的待辦指令';
      }
    } catch (error) {
      console.error('處理待辦指令時發生錯誤:', error);
      return language === 'ja' ? 
        'システムエラーが発生しました' : 
        '系統發生錯誤';
    }
  }

  /**
   * 新增提醒
   */
  async addReminder(messageText, userId, language) {
    const reminderData = this.todoService.parseReminderMessage(messageText, language);
    return await this.todoService.addReminder(reminderData, userId, language);
  }

  /**
   * 列出所有提醒
   */
  async listReminders(userId, language) {
    return await this.todoService.getUserReminders(userId, language);
  }

  /**
   * 刪除提醒
   */
  async deleteReminder(messageText, userId, language) {
    // 從訊息中提取提醒ID
    const idMatch = messageText.match(/([a-f0-9\-]{8,})/i);
    if (!idMatch) {
      return language === 'ja' ? 
        'リマインダーIDを指定してください' : 
        '請指定提醒ID';
    }

    const reminderId = idMatch[1];
    return await this.todoService.deleteReminder(reminderId, userId, language);
  }

  /**
   * 生成Flex Message格式的提醒回應
   */
  generateFlexMessage(reminders, language) {
    const flexMessage = {
      type: "flex",
      altText: language === 'ja' ? "リマインダー一覧" : "提醒列表",
      contents: {
        type: "carousel",
        contents: []
      }
    };

    reminders.forEach((reminder, index) => {
      const bubble = {
        type: "bubble",
        size: "kilo",
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: reminder.title,
              weight: "bold",
              size: "md",
              color: "#ffffff"
            }
          ],
          backgroundColor: this.getPriorityColor(reminder.priority),
          paddingAll: "12px"
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: language === 'ja' ? "種類:" : "類型:",
                  size: "sm",
                  color: "#666666",
                  flex: 2
                },
                {
                  type: "text",
                  text: this.todoService.getTypeDisplayName(reminder.type, language),
                  size: "sm",
                  flex: 3,
                  wrap: true
                }
              ],
              margin: "md"
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: language === 'ja' ? "次回:" : "下次:",
                  size: "sm",
                  color: "#666666",
                  flex: 2
                },
                {
                  type: "text",
                  text: reminder.next_trigger ? 
                    new Date(reminder.next_trigger).toLocaleString(language === 'ja' ? 'ja-JP' : 'zh-TW', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 
                    (language === 'ja' ? '未設定' : '未設定'),
                  size: "sm",
                  flex: 3,
                  wrap: true
                }
              ],
              margin: "md"
            }
          ]
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: {
                type: "message",
                label: language === 'ja' ? "削除" : "刪除",
                text: `${language === 'ja' ? 'リマインダー削除' : '刪除提醒'} ${reminder.id.substring(0, 8)}`
              }
            }
          ],
          spacing: "sm"
        }
      };

      flexMessage.contents.contents.push(bubble);
    });

    // 限制最多顯示10個
    if (flexMessage.contents.contents.length > 10) {
      flexMessage.contents.contents = flexMessage.contents.contents.slice(0, 10);
    }

    return flexMessage;
  }

  /**
   * 獲取優先級顏色
   */
  getPriorityColor(priority) {
    const colors = {
      high: "#FF6B6B",     // 紅色
      medium: "#4ECDC4",   // 青色
      low: "#45B7D1"       // 藍色
    };
    return colors[priority] || colors.medium;
  }

  /**
   * 獲取說明訊息
   */
  getHelpMessage(language) {
    if (language === 'ja') {
      return `📋 リマインダー機能の使い方

🔹 基本的な追加方法:
• 提醒 [時間] [内容]
• 例: 提醒 明日8時 会議

🔹 繰り返し設定:
• 毎日: 提醒 毎日9時 薬を飲む
• 毎週: 提醒 毎週月水金 運動
• 毎月: 提醒 毎月1日 家賃支払い
• カスタム: 提醒 7日おき 掃除

🔹 特殊な機能:
• 天気: 提醒 雨の日 傘を持つ
• 場所: 提醒 駅に着いたら 電話する

🔹 管理コマンド:
• 提醒一覧 - 全てのリマインダーを表示
• リマインダー削除 [ID] - 指定IDを削除

🔹 時間指定の例:
• 明日8時、来週月曜、来月15日
• 30分後、2時間後、3日後`;
    } else {
      return `📋 待辦提醒功能說明

🔹 基本新增方式:
• 提醒 [時間] [內容]
• 例: 提醒 明天8點 開會

🔹 重複設定:
• 每日: 提醒 每天9點 吃藥
• 每週: 提醒 每週一三五 運動
• 每月: 提醒 每月1號 繳房租
• 自訂: 提醒 每7天 大掃除

🔹 特殊功能:
• 天氣: 提醒 下雨天 帶雨傘
• 位置: 提醒 到車站 打電話

🔹 管理指令:
• 提醒列表 - 顯示所有提醒
• 刪除提醒 [ID] - 刪除指定提醒

🔹 時間範例:
• 明天8點、下週一、下個月15號
• 30分鐘後、2小時後、3天後`;
    }
  }

  /**
   * 創建新增提醒成功的Flex Message
   */
  createAddReminderSuccessMessage(todoRecord, language) {
    const triggerTime = new Date(todoRecord.next_trigger);
    const timeStr = triggerTime.toLocaleString(language === 'ja' ? 'ja-JP' : 'zh-TW');

    const flexMessage = {
      type: "flex",
      altText: language === 'ja' ? "リマインダー設定完了" : "提醒設定完成",
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "✅",
              size: "xxl",
              align: "center"
            },
            {
              type: "text",
              text: language === 'ja' ? "リマインダー設定完了" : "提醒設定完成",
              weight: "bold",
              size: "lg",
              align: "center",
              color: "#ffffff"
            }
          ],
          backgroundColor: "#42C2C2",
          paddingAll: "20px"
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: language === 'ja' ? "内容:" : "內容:",
                  size: "sm",
                  color: "#666666",
                  flex: 2
                },
                {
                  type: "text",
                  text: todoRecord.title,
                  size: "sm",
                  flex: 4,
                  wrap: true,
                  weight: "bold"
                }
              ]
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: language === 'ja' ? "種類:" : "類型:",
                  size: "sm",
                  color: "#666666",
                  flex: 2
                },
                {
                  type: "text",
                  text: this.todoService.getTypeDisplayName(todoRecord.type, language),
                  size: "sm",
                  flex: 4,
                  wrap: true
                }
              ],
              margin: "md"
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: language === 'ja' ? "次回:" : "下次:",
                  size: "sm",
                  color: "#666666",
                  flex: 2
                },
                {
                  type: "text",
                  text: timeStr,
                  size: "sm",
                  flex: 4,
                  wrap: true,
                  weight: "bold",
                  color: "#42C2C2"
                }
              ],
              margin: "md"
            }
          ],
          paddingAll: "20px"
        },
        footer: {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: {
                type: "message",
                label: language === 'ja' ? "一覧表示" : "查看列表",
                text: language === 'ja' ? "提醒一覧" : "提醒列表"
              }
            },
            {
              type: "button",
              style: "primary",
              height: "sm",
              action: {
                type: "message",
                label: language === 'ja' ? "削除" : "刪除",
                text: `${language === 'ja' ? 'リマインダー削除' : '刪除提醒'} ${todoRecord.id.substring(0, 8)}`
              }
            }
          ],
          spacing: "sm",
          paddingAll: "12px"
        }
      }
    };

    return flexMessage;
  }
}

module.exports = TodoController;
