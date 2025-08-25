// parsers/languageParser.js
// 智慧語言識別系統

class LanguageParser {
  constructor() {
    // 中文字元範圍
    this.chineseRegex = /[\u4e00-\u9fff]/;
    // 日文字元範圍（平假名、片假名、漢字）
    this.japaneseRegex = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/;
    // 平假名範圍
    this.hiraganaRegex = /[\u3040-\u309f]/;
    // 片假名範圍
    this.katakanaRegex = /[\u30a0-\u30ff]/;
    
    // 中文特有詞彙
    this.chineseKeywords = [
      '點', '分', '號', '天', '週', '月', '年',
      '上午', '下午', '晚上', '星期', '禮拜',
      '明天', '後天', '昨天', '每天', '每週',
      '提醒', '代辦', '待辦', '記帳', '帳務'
    ];
    
    // 日文特有詞彙
    this.japaneseKeywords = [
      '時', '分', '日', '曜日', '毎日', '毎週',
      '午前', '午後', '今日', '明日', 'あした',
      'きょう', 'らいしゅう', 'らいげつ',
      'リマインダー', 'タスク', '家計簿'
    ];
    
    // 混合語言常見模式
    this.mixedPatterns = {
      // 中文為主但包含日文
      chineseDominant: /^[\u4e00-\u9fff\s\d\-:：.,，。！？]+[\u3040-\u30ff]+/,
      // 日文為主但包含中文
      japaneseDominant: /^[\u3040-\u30ff\u4e00-\u9fff\s\d\-:：.,，。！？]*[\u3040-\u30ff]/
    };
  }

  /**
   * 檢測文本語言
   * @param {string} text - 要檢測的文本
   * @returns {Object} 語言檢測結果
   */
  detectLanguage(text) {
    if (!text || typeof text !== 'string') {
      return {
        primary: 'unknown',
        confidence: 0,
        hasMixed: false,
        details: { chinese: 0, japanese: 0, other: 0 }
      };
    }

    const analysis = this._analyzeText(text);
    const scores = this._calculateLanguageScores(text, analysis);
    
    return {
      primary: this._determinePrimaryLanguage(scores),
      confidence: this._calculateConfidence(scores),
      hasMixed: analysis.chineseChars > 0 && analysis.japaneseUniqueChars > 0,
      details: {
        chinese: scores.chinese,
        japanese: scores.japanese,
        other: scores.other
      },
      analysis
    };
  }

  /**
   * 分析文本字元組成
   * @private
   */
  _analyzeText(text) {
    let chineseChars = 0;
    let japaneseUniqueChars = 0; // 只計算平假名和片假名
    let kanjiChars = 0;          // 漢字（中日共用）
    let otherChars = 0;

    for (const char of text) {
      if (this.hiraganaRegex.test(char) || this.katakanaRegex.test(char)) {
        japaneseUniqueChars++;
      } else if (this.chineseRegex.test(char)) {
        // 漢字可能是中文也可能是日文，單獨計算
        kanjiChars++;
      } else if (/[a-zA-Z0-9\s\-:：.,，。！？]/.test(char)) {
        // 忽略數字、英文字母、標點符號
        continue;
      } else {
        otherChars++;
      }
    }

    // 通過關鍵字來判斷漢字的歸屬
    const chineseKeywordCount = this._countKeywords(text, this.chineseKeywords);
    const japaneseKeywordCount = this._countKeywords(text, this.japaneseKeywords);

    // 根據關鍵字比重來分配漢字
    const totalKeywords = chineseKeywordCount + japaneseKeywordCount;
    if (totalKeywords > 0) {
      const chineseRatio = chineseKeywordCount / totalKeywords;
      chineseChars = Math.round(kanjiChars * chineseRatio);
    } else {
      // 如果沒有明確關鍵字，預設傾向中文（因為漢字使用更頻繁）
      chineseChars = kanjiChars;
    }

    return {
      chineseChars,
      japaneseUniqueChars,
      kanjiChars,
      otherChars,
      chineseKeywordCount,
      japaneseKeywordCount,
      totalChars: text.length
    };
  }

  /**
   * 計算語言分數
   * @private
   */
  _calculateLanguageScores(text, analysis) {
    const {
      chineseChars,
      japaneseUniqueChars,
      chineseKeywordCount,
      japaneseKeywordCount,
      totalChars
    } = analysis;

    let chineseScore = 0;
    let japaneseScore = 0;

    // 基於字元比例的分數
    if (totalChars > 0) {
      chineseScore += (chineseChars / totalChars) * 50;
      japaneseScore += (japaneseUniqueChars / totalChars) * 50;
    }

    // 基於關鍵字的分數
    chineseScore += chineseKeywordCount * 10;
    japaneseScore += japaneseKeywordCount * 10;

    // 特殊模式加分
    if (this.mixedPatterns.chineseDominant.test(text)) {
      chineseScore += 15;
    }
    if (this.mixedPatterns.japaneseDominant.test(text)) {
      japaneseScore += 15;
    }

    // 特定字元模式加分
    if (/[\u3040-\u309f]/.test(text)) { // 平假名
      japaneseScore += 20;
    }
    if (/[\u30a0-\u30ff]/.test(text)) { // 片假名
      japaneseScore += 15;
    }

    const otherScore = Math.max(0, 100 - chineseScore - japaneseScore);

    return {
      chinese: Math.min(100, chineseScore),
      japanese: Math.min(100, japaneseScore),
      other: otherScore
    };
  }

  /**
   * 計算關鍵字出現次數
   * @private
   */
  _countKeywords(text, keywords) {
    return keywords.reduce((count, keyword) => {
      const regex = new RegExp(keyword, 'g');
      const matches = text.match(regex);
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  /**
   * 確定主要語言
   * @private
   */
  _determinePrimaryLanguage(scores) {
    const { chinese, japanese, other } = scores;
    
    if (chinese >= japanese && chinese >= other) {
      return chinese > 20 ? 'chinese' : 'unknown';
    } else if (japanese >= chinese && japanese >= other) {
      return japanese > 20 ? 'japanese' : 'unknown';
    } else {
      return other > 50 ? 'other' : 'unknown';
    }
  }

  /**
   * 計算信心度
   * @private
   */
  _calculateConfidence(scores) {
    const maxScore = Math.max(...Object.values(scores));
    const secondMaxScore = Object.values(scores)
      .sort((a, b) => b - a)[1] || 0;
    
    // 信心度基於最高分和第二高分的差距
    const confidence = Math.min(1, (maxScore - secondMaxScore) / 100);
    return Math.round(confidence * 100) / 100; // 保留兩位小數
  }

  /**
   * 判斷是否為時間相關文本
   * @param {string} text - 文本
   * @returns {boolean} 是否包含時間相關內容
   */
  isTimeRelated(text) {
    const timeKeywords = [
      // 中文時間關鍵字
      '點', '分', '時間', '明天', '後天', '星期', '週', '月', '日',
      '上午', '下午', '晚上', '早上', '提醒', '定時',
      
      // 日文時間關鍵字
      '時', '分', '時間', '明日', '曜日', '今日', '来週', '来月',
      '午前', '午後', 'あした', 'きょう', 'リマインダー',
      
      // 數字時間格式
      /\d{1,2}[：:]\d{2}/, // 8:30
      /\d{1,2}[點時]\d{0,2}[分]?/, // 8點30分
    ];

    return timeKeywords.some(keyword => {
      if (keyword instanceof RegExp) {
        return keyword.test(text);
      }
      return text.includes(keyword);
    });
  }

  /**
   * 獲取適合的解析器類型
   * @param {string} text - 文本
   * @returns {string} 解析器類型
   */
  getParserType(text) {
    const detection = this.detectLanguage(text);
    
    if (detection.hasMixed) {
      return 'mixed';
    }
    
    switch (detection.primary) {
      case 'chinese':
        return 'chinese';
      case 'japanese':
        return 'japanese';
      default:
        // 如果語言不明確，但包含時間相關內容，嘗試兩種解析器
        return this.isTimeRelated(text) ? 'universal' : 'unknown';
    }
  }

  /**
   * 標準化文本（清理和預處理）
   * @param {string} text - 原始文本
   * @returns {string} 標準化後的文本
   */
  normalizeText(text) {
    if (!text) return '';

    return text
      .trim()
      .replace(/\s+/g, ' ')           // 多個空格合併為一個
      .replace(/：/g, ':')            // 全角冒號轉半角
      .replace(/，/g, ',')            // 全角逗號轉半角
      .replace(/。/g, '.')            // 全角句號轉半角
      .replace(/！/g, '!')            // 全角驚嘆號轉半角
      .replace(/？/g, '?');           // 全角問號轉半角
  }
}

module.exports = LanguageParser;
