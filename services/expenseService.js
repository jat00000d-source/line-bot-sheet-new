// services/expenseService.js - 記帳服務模組
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

class ExpenseService {
  constructor() {
    // Google Sheets 設定
    this.serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // 類別對應
    this.CATEGORY_MAPPING = {
      // 中文項目保持原樣
      '午餐': '午餐',
      '晚餐': '晚餐',
      '早餐': '早餐',
      '咖啡': '咖啡',
      '交通': '交通',
      '購物': '購物',
      '娛樂': '娛樂',
      '醫療': '醫療',
      
      // 日文項目對應到中文（保持Google Sheets一致）
      '昼食': '午餐',
      'ランチ': '午餐',
      '夕食': '晚餐',
      '夜食': '晚餐',
      '朝食': '早餐',
      'コーヒー': '咖啡',
      '珈琲': '咖啡',
      '交通費': '交通',
      '電車': '交通',
      'バス': '交通',
      'タクシー': '交通',
      '買い物': '購物',
      'ショッピング': '購物',
      '娯楽': '娛樂',
      '映画': '娛樂',
      'ゲーム': '娛樂',
      '医療': '醫療',
      '病院': '醫療',
      '薬': '醫療'
    };
  }

  // 建立 Google Spreadsheet 連接
  async getGoogleSheet() {
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID, this.serviceAccountAuth);
    await doc.loadInfo();
    return doc;
  }

  // 新增記帳記錄（基於解析後的數據）+ 預算提醒
  async addExpenseRecordFromParsed(parsedData, language = 'zh') {
    try {
      let { item, amount, note, dateOffset } = parsedData;

      // 項目名稱統一處理（日文轉中文）
      item = this.CATEGORY_MAPPING[item] || item;

      const doc = await this.getGoogleSheet();
      
      // 計算實際日期
      const targetDate = new Date();
      if (dateOffset) {
        targetDate.setDate(targetDate.getDate() + dateOffset);
      }
      
      const sheetName = this.formatDate(targetDate, 'YYYY-MM');
      
      // 取得或建立當月工作表
      let sheet = doc.sheetsByTitle[sheetName];
      if (!sheet) {
        sheet = await this.createNewMonthSheet(doc, sheetName);
      }

      // 加入記帳資料
      const dateStr = this.formatDate(targetDate, 'MM/DD');
      await sheet.addRow({
        '日期': dateStr,
        '項目': item,
        '金額': amount,
        '備註': note
      });

      // 獲取預算資訊並計算剩餘
      const budgetInfo = await this.calculateBudgetRemaining(language);
      
      // 組合基本回應
      const dateLabel = dateOffset === 0 ? 
        (language === 'ja' ? '今日' : '今天') :
        (dateOffset === -1 ? 
          (language === 'ja' ? '昨日' : '昨天') : 
          `${Math.abs(dateOffset)}${language === 'ja' ? '日前' : '天前'}`);
      
      let response;
      if (language === 'ja') {
        response = `✅ 記録完了！\n日付：${dateStr}（${dateLabel}）\n項目：${item}\n金額：${amount.toLocaleString('ja-JP')}円\n備考：${note}`;
      } else {
        response = `✅ 記帳成功！\n日期：${dateStr}（${dateLabel}）\n項目：${item}\n金額：${amount.toLocaleString('zh-TW')}円\n備註：${note}`;
      }

      // 添加預算資訊
      if (budgetInfo.hasBudget) {
        response += '\n\n' + budgetInfo.message;
      }

      return response;

    } catch (error) {
      console.error('添加記帳記錄時發生錯誤:', error);
      return language === 'ja' ? 
        '記録に失敗しました。しばらく後にもう一度お試しいただくか、形式を確認してください' : 
        '記帳失敗，請稍後再試或檢查格式是否正確';
    }
  }

  // 設定月度預算
  async setBudget(messageText, language = 'zh') {
    try {
      // 提取預算金額
      const budgetMatch = messageText.match(/(\d+)/);
      if (!budgetMatch) {
        return language === 'ja' ? 
          '予算金額を正しく入力してください。例：予算設定 50000' : 
          '請正確輸入預算金額，例如：設定預算 50000';
      }

      const budgetAmount = parseInt(budgetMatch[1]);
      const doc = await this.getGoogleSheet();
      const now = new Date();
      const sheetName = this.formatDate(now, 'YYYY-MM');

      // 取得或建立當月工作表
      let sheet = doc.sheetsByTitle[sheetName];
      if (!sheet) {
        sheet = await this.createNewMonthSheet(doc, sheetName);
      }

      // 尋找是否已有預算設定
      const rows = await sheet.getRows();
      const budgetRow = rows.find(row => row.get('項目') === '月度預算');

      if (budgetRow) {
        // 更新現有預算
        budgetRow.set('金額', budgetAmount);
        await budgetRow.save();
      } else {
        // 新增預算記錄（放在第一行）
        await sheet.addRow({
          '日期': '預算',
          '項目': '月度預算',
          '金額': budgetAmount,
          '備註': `${sheetName}月度預算設定`
        });
      }

      // 計算當前剩餘預算
      const remaining = await this.calculateBudgetRemaining(language);

      if (language === 'ja') {
        return `💰 今月の予算を${budgetAmount.toLocaleString('ja-JP')}円に設定しました！\n\n${remaining.message}`;
      } else {
        return `💰 本月預算已設定為 ${budgetAmount.toLocaleString('zh-TW')} 円！\n\n${remaining.message}`;
      }

    } catch (error) {
      console.error('設定預算時發生錯誤:', error);
      return language === 'ja' ? 
        '予算設定に失敗しました。しばらく後にもう一度お試しください' : 
        '預算設定失敗，請稍後再試';
    }
  }

  // 獲取預算資訊
  async getBudgetInfo(language = 'zh') {
    try {
      const budgetInfo = await this.calculateBudgetRemaining(language);
      return budgetInfo.message;
    } catch (error) {
      console.error('獲取預算資訊時發生錯誤:', error);
      return language === 'ja' ? 
        '予算情報の取得に失敗しました' : 
        '無法獲取預算資訊';
    }
  }

  // 計算剩餘預算
  async calculateBudgetRemaining(language = 'zh') {
    try {
      const doc = await this.getGoogleSheet();
      const now = new Date();
      const sheetName = this.formatDate(now, 'YYYY-MM');

      const sheet = doc.sheetsByTitle[sheetName];
      if (!sheet) {
        return {
          hasBudget: false,
          message: language === 'ja' ? 
            'まだ予算が設定されていません。「予算設定 金額」で設定してください' : 
            '尚未設定預算，請使用「設定預算 金額」來設定'
        };
      }

      const rows = await sheet.getRows();
      
      // 尋找預算設定
      const budgetRow = rows.find(row => row.get('項目') === '月度預算');
      if (!budgetRow) {
        return {
          hasBudget: false,
          message: language === 'ja' ? 
            'まだ予算が設定されていません。「予算設定 金額」で設定してください' : 
            '尚未設定預算，請使用「設定預算 金額」來設定'
        };
      }

      const budget = parseFloat(budgetRow.get('金額')) || 0;
      
      // 計算總支出（排除預算記錄）
      let totalExpense = 0;
      let expenseCount = 0;
      
      rows.forEach(row => {
        if (row.get('項目') !== '月度預算') {
          const amount = parseFloat(row.get('金額'));
          if (!isNaN(amount)) {
            totalExpense += amount;
            expenseCount++;
          }
        }
      });

      const remaining = budget - totalExpense;
      const usagePercentage = budget > 0 ? ((totalExpense / budget) * 100).toFixed(1) : 0;
      
      // 計算每日剩餘可用金額
      const today = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const remainingDays = daysInMonth - today + 1;
      const dailyAllowance = remaining > 0 && remainingDays > 0 ? Math.floor(remaining / remainingDays) : 0;

      // 預算狀態判斷
      let statusIcon = '💚';
      let warningMessage = '';
      
      if (usagePercentage >= 100) {
        statusIcon = '🚨';
        warningMessage = language === 'ja' ? 
          '\n⚠️ 予算をオーバーしています！' : 
          '\n⚠️ 已超出預算！';
      } else if (usagePercentage >= 80) {
        statusIcon = '🟡';
        warningMessage = language === 'ja' ? 
          '\n⚠️ 予算の80%を使用しました' : 
          '\n⚠️ 已使用80%預算';
      } else if (usagePercentage >= 60) {
        statusIcon = '🟠';
      }

      if (language === 'ja') {
        return {
          hasBudget: true,
          remaining: remaining,
          message: `${statusIcon} 今月の予算状況\n` +
                  `💰 予算：${budget.toLocaleString('ja-JP')}円\n` +
                  `💸 支出：${totalExpense.toLocaleString('ja-JP')}円 (${usagePercentage}%)\n` +
                  `💵 残り：${remaining.toLocaleString('ja-JP')}円\n` +
                  `📅 1日使用可能：${dailyAllowance.toLocaleString('ja-JP')}円\n` +
                  `📊 記録数：${expenseCount}件${warningMessage}`
        };
      } else {
        return {
          hasBudget: true,
          remaining: remaining,
          message: `${statusIcon} 本月預算狀況\n` +
                  `💰 預算：${budget.toLocaleString('zh-TW')} 円\n` +
                  `💸 支出：${totalExpense.toLocaleString('zh-TW')} 円 (${usagePercentage}%)\n` +
                  `💵 剩餘：${remaining.toLocaleString('zh-TW')} 円\n` +
                  `📅 每日可用：${dailyAllowance.toLocaleString('zh-TW')} 円\n` +
                  `📊 記錄筆數：${expenseCount} 筆${warningMessage}`
        };
      }

    } catch (error) {
      console.error('計算剩餘預算時發生錯誤:', error);
      return {
        hasBudget: false,
        message: language === 'ja' ? 
          '予算計算中にエラーが発生しました' : 
          '預算計算時發生錯誤'
      };
    }
  }

  // 建立新的月份工作表
  async createNewMonthSheet(doc, sheetName) {
    const sheet = await doc.addSheet({
      title: sheetName,
      headerValues: ['日期', '項目', '金額', '備註']
    });

    // 格式化工作表
    await sheet.loadCells('A1:D1');
    
    // 設定標題列格式
    for (let i = 0; i < 4; i++) {
      const cell = sheet.getCell(0, i);
      cell.textFormat = { bold: true };
      cell.backgroundColor = { red: 0.91, green: 0.94, blue: 0.996 };
      cell.horizontalAlignment = 'CENTER';
    }

    await sheet.saveUpdatedCells();

    // 設定欄位寬度
    await sheet.resize({ columnCount: 4 });
    
    return sheet;
  }

  // 取得月度支出總結（包含預算資訊）
  async getMonthlyExpenseSummary(language = 'zh') {
    try {
      const doc = await this.getGoogleSheet();
      const now = new Date();
      const sheetName = this.formatDate(now, 'YYYY-MM');

      const sheet = doc.sheetsByTitle[sheetName];
      if (!sheet) {
        return language === 'ja' ? 
          `今月（${sheetName}）はまだ記帳記録がありません` : 
          `本月（${sheetName}）尚未有任何記帳記錄`;
      }

      const rows = await sheet.getRows();
      if (rows.length === 0) {
        return language === 'ja' ? 
          `今月（${sheetName}）はまだ記帳記録がありません` : 
          `本月（${sheetName}）尚未有任何記帳記錄`;
      }

      // 計算總支出（排除預算記錄）
      let totalExpense = 0;
      let recordCount = 0;

      rows.forEach(row => {
        if (row.get('項目') !== '月度預算') {
          const amount = parseFloat(row.get('金額'));
          if (!isNaN(amount)) {
            totalExpense += amount;
            recordCount++;
          }
        }
      });

      const currentDay = now.getDate();
      const avgDaily = recordCount > 0 ? Math.round(totalExpense / currentDay) : 0;

      // 基本總結
      let summary;
      if (language === 'ja') {
        summary = `📊 ${sheetName} 支出まとめ\n` +
                 `💰 総支出：${totalExpense.toLocaleString('ja-JP')}円\n` +
                 `📝 記録数：${recordCount}件\n` +
                 `📅 1日平均：${avgDaily.toLocaleString('ja-JP')}円`;
      } else {
        summary = `📊 ${sheetName} 支出總結\n` +
                 `💰 總支出：${totalExpense.toLocaleString('zh-TW')}円\n` +
                 `📝 記錄筆數：${recordCount} 筆\n` +
                 `📅 平均每日：${avgDaily.toLocaleString('zh-TW')}円`;
      }

      // 添加預算資訊
      const budgetInfo = await this.calculateBudgetRemaining(language);
      if (budgetInfo.hasBudget) {
        summary += '\n\n' + budgetInfo.message;
      }

      return summary;

    } catch (error) {
      console.error('取得月總結時發生錯誤:', error);
      return language === 'ja' ? 
        'まとめ取得時にエラーが発生しました。しばらく後にもう一度お試しください' : 
        '取得總結時發生錯誤，請稍後再試';
    }
  }

  // 格式化日期
  formatDate(date, format) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    switch (format) {
      case 'YYYY-MM':
        return `${year}-${month}`;
      case 'MM/DD':
        return `${month}/${day}`;
      default:
        return date.toISOString();
    }
  }

  // 取得使用說明（包含預算功能說明）
  getHelpMessage(language = 'zh') {
    if (language === 'ja') {
      return `📝 記帳ボット使用説明\n\n` +
             `💡 記帳形式：\n` +
             `【従来形式】\n` +
             `項目　金額　[備考]（全角スペース対応）\n` +
             `項目 金額 [備考]（半角スペース対応）\n\n` +
             `【自然言語形式】NEW！\n` +
             `• 昨日ランチ100円食べた\n` +
             `• 今日コーヒー85円\n` +
             `• 交通費150\n` +
             `• 午餐100元（中国語もOK）\n\n` +
             `💰 予算管理：NEW！\n` +
             `• 予算設定 50000 （月度予算設定）\n` +
             `• 予算 （予算状況確認）\n` +
             `• 残り （残額確認）\n\n` +
             `📌 例：\n` +
             `• 昼食　150\n` +
             `• コーヒー　85　スターバックス\n` +
             `• 昨天午餐吃了200\n` +
             `• 前天買咖啡花80\n\n` +
             `📊 まとめ確認：\n` +
             `「集計」で今月の支出を確認\n\n` +
             `✨ 特長：\n` +
             `• 月度予算設定・管理\n` +
             `• 自動で残額・使用率計算\n` +
             `• 1日使用可能金額表示\n` +
             `• 予算警告機能\n` +
             `• 全角・半角スペース対応\n` +
             `• 自然言語理解\n` +
             `• 中国語・日本語対応`;
    } else {
      return `📝 記帳機器人使用說明\n\n` +
             `💡 記帳格式：\n` +
             `【傳統格式】\n` +
             `項目　金額　[備註]（支援全形空格）\n` +
             `項目 金額 [備註]（支援半形空格）\n\n` +
             `【自然語言格式】全新功能！\n` +
             `• 昨天午餐吃了100元\n` +
             `• 今天咖啡85円\n` +
             `• 交通費150\n` +
             `• ランチ200（日文也可以）\n\n` +
             `💰 預算管理：全新功能！\n` +
             `• 設定預算 50000 （設定月度預算）\n` +
             `• 預算 （查看預算狀況）\n` +
             `• 剩餘 （查看剩餘金額）\n\n` +
             `📌 範例：\n` +
             `• 午餐　150\n` +
             `• 咖啡　85　星巴克\n` +
             `• 昨天買東西花了200\n` +
             `• 前天搭車用50\n\n` +
             `📊 查看總結：\n` +
             `輸入「總結」查看本月支出\n\n` +
             `✨ 特色功能：\n` +
             `• 月度預算設定與管理\n` +
             `• 自動計算剩餘金額與使用率\n` +
             `• 每日可用金額顯示\n` +
             `• 預算警告提醒功能\n` +
             `• 支援全形、半形空格\n` +
             `• 自然語言理解\n` +
             `• 支援中日雙語指令`;
    }
  }
}

module.exports = ExpenseService;
