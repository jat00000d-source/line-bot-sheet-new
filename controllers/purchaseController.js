const { GoogleSpreadsheet } = require('google-spreadsheet');
const { createServiceAccountAuth } = require('../utils/envValidator');

class GoogleSheetsPurchaseController {
  constructor() {
    this.doc = null;
    this.SHEET_NAME = '代購記錄';
  }

  async getGoogleSheet() {
    if (!this.doc) {
      const serviceAccountAuth = createServiceAccountAuth();
      this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID, serviceAccountAuth);
      await this.doc.loadInfo();
    }
    return this.doc;
  }

  async handlePurchase(event, command) {
    try {
      const { friendName, productName, amount, note } = command;
      
      const doc = await this.getGoogleSheet();
      
      // 取得或建立代購記錄工作表
      let sheet = doc.sheetsByTitle[this.SHEET_NAME];
      if (!sheet) {
        sheet = await this.createPurchaseSheet(doc);
      }

      // 取得當前日期
      const now = new Date();
      const dateStr = this.formatDate(now, 'YYYY/MM/DD');
      const timeStr = this.formatDate(now, 'HH:mm');

      // 加入代購記錄
      await sheet.addRow({
        '日期': dateStr,
        '時間': timeStr,
        '朋友': friendName || '朋友',
        '商品名稱': productName,
        '價格': amount,
        '備註': note || '',
        '狀態': '已代購'
      });

      // 計算朋友的剩餘金額
      const balanceInfo = await this.calculateFriendBalance(friendName || '朋友');

      let response = `✅ 代購記錄成功！\n` +
                   `📅 日期：${dateStr}\n` +
                   `👤 朋友：${friendName || '朋友'}\n` +
                   `🛍️ 商品：${productName}\n` +
                   `💰 價格：${amount.toLocaleString('zh-TW')}円\n` +
                   `📝 備註：${note || '無'}`;

      // 添加餘額資訊（如果有設定預付金額）
      if (balanceInfo.hasBalance) {
        response += `\n\n💳 帳戶狀況：\n${balanceInfo.message}`;
      } else {
        response += `\n\n💡 提示：可使用「預付 [朋友] [金額]」設定朋友的預付金額`;
      }

      return {
        type: 'text',
        text: response
      };
    } catch (error) {
      console.error('代購記錄錯誤:', error);
      return {
        type: 'text',
        text: '代購記錄時發生錯誤，請稍後再試。'
      };
    }
  }

  async handlePrepayment(event, command) {
    try {
      const { friendName, amount } = command;
      
      const doc = await this.getGoogleSheet();
      
      // 取得或建立代購記錄工作表
      let sheet = doc.sheetsByTitle[this.SHEET_NAME];
      if (!sheet) {
        sheet = await this.createPurchaseSheet(doc);
      }

      // 取得當前日期
      const now = new Date();
      const dateStr = this.formatDate(now, 'YYYY/MM/DD');
      const timeStr = this.formatDate(now, 'HH:mm');

      // 加入預付金記錄
      await sheet.addRow({
        '日期': dateStr,
        '時間': timeStr,
        '朋友': friendName || '朋友',
        '商品名稱': '預付金',
        '價格': -amount, // 負數表示收到錢
        '備註': `收到預付金 ${amount.toLocaleString('zh-TW')}円`,
        '狀態': '預付'
      });

      // 計算更新後的餘額
      const balanceInfo = await this.calculateFriendBalance(friendName || '朋友');

      let response = `💰 預付金記錄成功！\n` +
                   `📅 日期：${dateStr}\n` +
                   `👤 朋友：${friendName || '朋友'}\n` +
                   `💵 預付金額：${amount.toLocaleString('zh-TW')}円\n\n` +
                   `💳 更新後帳戶狀況：\n${balanceInfo.message}`;

      return {
        type: 'text',
        text: response
      };
    } catch (error) {
      console.error('預付金記錄錯誤:', error);
      return {
        type: 'text',
        text: '預付金記錄時發生錯誤，請稍後再試。'
      };
    }
  }

  async handlePurchaseQuery(event, command) {
    try {
      const { friendName } = command;
      const doc = await this.getGoogleSheet();
      
      const sheet = doc.sheetsByTitle[this.SHEET_NAME];
      if (!sheet) {
        return {
          type: 'text',
          text: '尚未有任何代購記錄'
        };
      }

      const rows = await sheet.getRows();
      if (rows.length === 0) {
        return {
          type: 'text',
          text: '尚未有任何代購記錄'
        };
      }

      let filteredRows = rows;
      let titlePrefix = '📋 所有代購記錄';

      // 如果指定朋友名稱，則篩選
      if (friendName) {
        filteredRows = rows.filter(row => 
          row.get('朋友') && row.get('朋友').includes(friendName)
        );
        titlePrefix = `📋 ${friendName}的代購記錄`;
      }

      if (filteredRows.length === 0) {
        return {
          type: 'text',
          text: friendName ? `${friendName}尚未有代購記錄` : '尚未有任何代購記錄'
        };
      }

      // 計算總計
      let totalPurchases = 0;
      let totalPrepayments = 0;
      let purchaseCount = 0;
      let prepaymentCount = 0;

      const records = [];
      
      filteredRows.slice(-10).reverse().forEach((row, index) => { // 最近10筆，倒序顯示
        const date = row.get('日期') || '';
        const friend = row.get('朋友') || '';
        const product = row.get('商品名稱') || '';
        const price = parseFloat(row.get('價格')) || 0;
        const note = row.get('備註') || '';
        const status = row.get('狀態') || '';

        if (product === '預付金') {
          totalPrepayments += Math.abs(price);
          prepaymentCount++;
        } else {
          totalPurchases += price;
          purchaseCount++;
        }

        const recordStr = `${index + 1}. ${date} ${friend}\n   ${product} ${price > 0 ? '+' : ''}${price.toLocaleString('zh-TW')}円${note ? ` (${note})` : ''}`;
        records.push(recordStr);
      });

      // 計算餘額（如果是特定朋友）
      let balanceInfo = '';
      if (friendName) {
        const balance = await this.calculateFriendBalance(friendName);
        if (balance.hasBalance) {
          balanceInfo = `\n\n💳 ${friendName}帳戶餘額：\n${balance.message}`;
        }
      }

      let summary = `${titlePrefix}\n\n` +
                   records.join('\n\n') +
                   `\n\n📊 統計資訊：\n` +
                   `🛍️ 代購次數：${purchaseCount} 次\n` +
                   `💰 代購總額：${totalPurchases.toLocaleString('zh-TW')}円\n` +
                   `💵 預付總額：${totalPrepayments.toLocaleString('zh-TW')}円${balanceInfo}`;

      return {
        type: 'text',
        text: summary
      };
    } catch (error) {
      console.error('查詢代購記錄錯誤:', error);
      return {
        type: 'text',
        text: '查詢代購記錄時發生錯誤。'
      };
    }
  }

  async calculateFriendBalance(friendName) {
    try {
      const doc = await this.getGoogleSheet();
      const sheet = doc.sheetsByTitle[this.SHEET_NAME];
      
      if (!sheet) {
        return {
          hasBalance: false,
          balance: 0,
          message: '尚無代購記錄'
        };
      }

      const rows = await sheet.getRows();
      
      // 篩選該朋友的記錄
      const friendRows = rows.filter(row => 
        row.get('朋友') && row.get('朋友').includes(friendName)
      );

      if (friendRows.length === 0) {
        return {
          hasBalance: false,
          balance: 0,
          message: `${friendName}尚無記錄`
        };
      }

      // 計算餘額（預付金為負數，購買為正數）
      let balance = 0;
      let purchaseTotal = 0;
      let prepaymentTotal = 0;
      let purchaseCount = 0;
      let prepaymentCount = 0;

      friendRows.forEach(row => {
        const price = parseFloat(row.get('價格')) || 0;
        const product = row.get('商品名稱') || '';
        
        if (product === '預付金') {
          balance += price; // 預付金是負數，所以加起來
          prepaymentTotal += Math.abs(price);
          prepaymentCount++;
        } else {
          balance += price; // 購買金額是正數
          purchaseTotal += price;
          purchaseCount++;
        }
      });

      const actualBalance = -balance; // 剩餘金額 = 預付總額 - 購買總額

      let statusIcon = '💚';
      let warningMessage = '';
      
      if (actualBalance <= 0) {
        statusIcon = '🚨';
        warningMessage = '\n⚠️ 餘額不足或已用完！';
      } else if (actualBalance <= 1000) {
        statusIcon = '🟡';
        warningMessage = '\n⚠️ 餘額偏低';
      }

      return {
        hasBalance: prepaymentCount > 0,
        balance: actualBalance,
        message: `${statusIcon} ${friendName}的帳戶狀況\n` +
                `💵 預付總額：${prepaymentTotal.toLocaleString('zh-TW')}円\n` +
                `💰 已消費：${purchaseTotal.toLocaleString('zh-TW')}円\n` +
                `💳 剩餘金額：${actualBalance.toLocaleString('zh-TW')}円\n` +
                `📊 代購次數：${purchaseCount}次${warningMessage}`
      };
    } catch (error) {
      console.error('計算朋友餘額錯誤:', error);
      return {
        hasBalance: false,
        balance: 0,
        message: '計算餘額時發生錯誤'
      };
    }
  }

  async createPurchaseSheet(doc) {
    const sheet = await doc.addSheet({
      title: this.SHEET_NAME,
      headerValues: ['日期', '時間', '朋友', '商品名稱', '價格', '備註', '狀態']
    });

    // 格式化工作表
    await sheet.loadCells('A1:G1');
    
    // 設定標題列格式
    for (let i = 0; i < 7; i++) {
      const cell = sheet.getCell(0, i);
      cell.textFormat = { bold: true };
      cell.backgroundColor = { red: 0.85, green: 0.92, blue: 0.83 }; // 淡綠色背景
      cell.horizontalAlignment = 'CENTER';
    }

    await sheet.saveUpdatedCells();
    await sheet.resize({ columnCount: 7 });
    
    console.log('✅ 代購記錄工作表建立成功');
    return sheet;
  }

  formatDate(date, format) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');

    switch (format) {
      case 'YYYY/MM/DD':
        return `${year}/${month}/${day}`;
      case 'MM/DD':
        return `${month}/${day}`;
      case 'HH:mm':
        return `${hour}:${minute}`;
      default:
        return date.toISOString();
    }
  }
}

module.exports = GoogleSheetsPurchaseController;
