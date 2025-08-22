// utils/dateHelper.js

class DateHelper {
  /**
   * 格式化日期
   * @param {Date} date - 日期物件
   * @param {string} format - 格式字串
   * @returns {string} 格式化後的日期字串
   */
  static formatDate(date, format) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    switch (format) {
      case 'YYYY-MM':
        return `${year}-${month}`;
      case 'MM/DD':
        return `${month}/${day}`;
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      default:
        return date.toISOString();
    }
  }

  /**
   * 根據偏移量計算目標日期
   * @param {number} dateOffset - 日期偏移量（負數表示過去）
   * @returns {Date} 目標日期
   */
  static getTargetDate(dateOffset = 0) {
    const targetDate = new Date();
    if (dateOffset !== 0) {
      targetDate.setDate(targetDate.getDate() + dateOffset);
    }
    return targetDate;
  }

  /**
   * 取得當前月份的工作表名稱
   * @param {number} monthOffset - 月份偏移量
   * @returns {string} 工作表名稱 (YYYY-MM格式)
   */
  static getCurrentMonthSheetName(monthOffset = 0) {
    const date = new Date();
    if (monthOffset !== 0) {
      date.setMonth(date.getMonth() + monthOffset);
    }
    return this.formatDate(date, 'YYYY-MM');
  }

  /**
   * 取得日期的顯示標籤
   * @param {number} dateOffset - 日期偏移量
   * @param {string} language - 語言代碼
   * @returns {string} 日期標籤
   */
  static getDateLabel(dateOffset, language = 'zh') {
    if (dateOffset === 0) {
      return language === 'ja' ? '今日' : '今天';
    } else if (dateOffset === -1) {
      return language === 'ja' ? '昨日' : '昨天';
    } else if (dateOffset < 0) {
      const days = Math.abs(dateOffset);
      return language === 'ja' ? `${days}日前` : `${days}天前`;
    } else {
      const days = dateOffset;
      return language === 'ja' ? `${days}日後` : `${days}天後`;
    }
  }

  /**
   * 取得本月剩餘天數
   * @returns {number} 剩餘天數
   */
  static getRemainingDaysInMonth() {
    const now = new Date();
    const today = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return daysInMonth - today + 1;
  }
}

module.exports = DateHelper;
