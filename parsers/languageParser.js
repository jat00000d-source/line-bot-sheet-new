class LanguageParser {
    constructor() {
        // 日文字符範圍
        this.japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF]/;
        
        // 中文字符範圍
        this.chineseRegex = /[\u4e00-\u9fff]/;
        
        // 日文特有詞彙
        this.japaneseKeywords = [
            // 時間相關
            '時', '分', '秒', '今日', '明日', '昨日', '来週', '来月', '毎日', '毎週',
            '午前', '午後', '朝', '昼', '夜', '深夜', '夕方',
            
            // 動詞和助詞
            'する', 'です', 'ます', 'だ', 'である', 'の', 'が', 'を', 'に', 'へ', 'で', 'と',
            'から', 'まで', 'より', 'について', 'において', 'として',
            
            // 代辦相關
            'タスク', 'やること', 'リマインド', '予定', '忘れずに', '覚えている',
            '追加', '削除', '完了', '終了', '確認', '更新', '編集',
            
            // 頻率
            '毎', 'ごと', '回', '度', '間隔',
            
            // 優先級
            '重要', '緊急', '優先', '普通', '一般'
        ];
        
        // 中文特有詞彙
        this.chineseKeywords = [
            // 時間相關
            '點', '分', '秒', '今天', '明天', '昨天', '下週', '下月', '每天', '每週',
            '上午', '下午', '早上', '中午', '晚上', '深夜', '傍晚',
            
            // 動詞和語氣詞
            '的', '了', '是', '在', '有', '會', '要', '做', '去', '來',
            '從', '到', '給', '把', '被', '讓', '使', '對', '向', '往',
            
            // 代辦相關
            '代辦', '任務', '提醒', '要做', '記得', '別忘了', '不要忘記',
            '新增', '刪除', '完成', '結束', '查看', '修改', '更新',
            
            // 頻率
            '每', '每個', '每次', '次', '遍',
            
            // 優先級
            '重要', '緊急', '優先', '普通', '一般', '不急'
        ];
        
        // 語言特徵權重
        this.weights = {
            characters: 0.6,    // 字符類型權重
            keywords: 0.3,      // 關鍵詞權重
            grammar: 0.1        // 語法特徵權重
        };
    }

    /**
     * 檢測文本語言
     */
    detectLanguage(text) {
        if (!text || typeof text !== 'string') {
            return 'zh'; // 預設中文
        }

        const cleanText = text.trim().toLowerCase();
        if (cleanText.length === 0) {
            return 'zh';
        }

        const scores = {
            zh: 0,
            ja: 0
        };

        // 1. 字符分析
        const characterScores = this.analyzeCharacters(cleanText);
        scores.zh += characterScores.zh * this.weights.characters;
        scores.ja += characterScores.ja * this.weights.characters;

        // 2. 關鍵詞分析
        const keywordScores = this.analyzeKeywords(cleanText);
        scores.zh += keywordScores.zh * this.weights.keywords;
        scores.ja += keywordScores.ja * this.weights.keywords;

        // 3. 語法特徵分析
        const grammarScores = this.analyzeGrammar(cleanText);
        scores.zh += grammarScores.zh * this.weights.grammar;
        scores.ja += grammarScores.ja * this.weights.grammar;

        // 決定語言
        return scores.ja > scores.zh ? 'ja' : 'zh';
    }

    /**
     * 分析字符類型
     */
    analyzeCharacters(text) {
        const totalChars = text.length;
        if (totalChars === 0) return { zh: 0, ja: 0 };

        let japaneseChars = 0;
        let chineseChars = 0;

        // 計算日文字符
        const japaneseMatches = text.match(this.japaneseRegex);
        if (japaneseMatches) {
            japaneseChars = japaneseMatches.length;
        }

        // 計算中文字符
        const chineseMatches = text.match(this.chineseRegex);
        if (chineseMatches) {
            chineseChars = chineseMatches.length;
        }

        // 特殊情況：如果包含平假名或片假名，強烈偏向日文
        const hiraganaRegex = /[\u3040-\u309F]/;
        const katakanaRegex = /[\u30A0-\u30FF]/;
        
        let jaBonus = 0;
        if (hiraganaRegex.test(text)) jaBonus += 0.3;
        if (katakanaRegex.test(text)) jaBonus += 0.2;

        return {
            zh: chineseChars / totalChars,
            ja: (japaneseChars / totalChars) + jaBonus
        };
    }

    /**
     * 分析關鍵詞
     */
    analyzeKeywords(text) {
        let zhCount = 0;
        let jaCount = 0;

        // 檢查中文關鍵詞
        this.chineseKeywords.forEach(keyword => {
            if (text.includes(keyword)) {
                zhCount++;
            }
        });

        // 檢查日文關鍵詞
        this.japaneseKeywords.forEach(keyword => {
            if (text.includes(keyword)) {
                jaCount++;
            }
        });

        const total = zhCount + jaCount;
        if (total === 0) return { zh: 0, ja: 0 };

        return {
            zh: zhCount / total,
            ja: jaCount / total
        };
    }

    /**
     * 分析語法特徵
     */
    analyzeGrammar(text) {
        let zhScore = 0;
        let jaScore = 0;

        // 日文語法特徵
        const japaneseGrammar = [
            /です$|だ$/,           // 句尾
            /ます$|た$/,          // 動詞變位
            /の|が|を|に|で/,      // 助詞
            /して|される|れる/,     // 動詞形式
        ];

        // 中文語法特徵
        const chineseGrammar = [
            /的$|了$/,           // 句尾助詞
            /是|有|會|要/,        // 常用動詞
            /在|從|到|給/,        // 介詞
            /不|沒|別|不要/,      // 否定詞
        ];

        japaneseGrammar.forEach(pattern => {
            if (pattern.test(text)) {
                jaScore += 0.1;
            }
        });

        chineseGrammar.forEach(pattern => {
            if (pattern.test(text)) {
                zhScore += 0.1;
            }
        });

        return {
            zh: Math.min(zhScore, 1),
            ja: Math.min(jaScore, 1)
        };
    }

    /**
     * 檢測混合語言文本
     */
    detectMixedLanguage(text) {
        const sentences = text.split(/[。．！!？?]/);
        const results = [];

        sentences.forEach((sentence, index) => {
            if (sentence.trim().length > 0) {
                const lang = this.detectLanguage(sentence);
                results.push({
                    index,
                    text: sentence.trim(),
                    language: lang
                });
            }
        });

        return results;
    }

    /**
     * 獲取語言信心度
     */
    getLanguageConfidence(text) {
        const cleanText = text.trim();
        if (cleanText.length === 0) {
            return { language: 'zh', confidence: 0 };
        }

        const scores = {
            zh: 0,
            ja: 0
        };

        // 字符分析
        const characterScores = this.analyzeCharacters(cleanText);
        scores.zh += characterScores.zh * this.weights.characters;
        scores.ja += characterScores.ja * this.weights.characters;

        // 關鍵詞分析
        const keywordScores = this.analyzeKeywords(cleanText);
        scores.zh += keywordScores.zh * this.weights.keywords;
        scores.ja += keywordScores.ja * this.weights.keywords;

        // 語法分析
        const grammarScores = this.analyzeGrammar(cleanText);
        scores.zh += grammarScores.zh * this.weights.grammar;
        scores.ja += grammarScores.ja * this.weights.grammar;

        const language = scores.ja > scores.zh ? 'ja' : 'zh';
        const confidence = Math.max(scores.zh, scores.ja);

        return {
            language,
            confidence: Math.min(confidence, 1),
            scores: {
                chinese: scores.zh,
                japanese: scores.ja
            }
        };
    }

    /**
     * 批量語言檢測
     */
    detectLanguageBatch(texts) {
        return texts.map(text => ({
            text,
            ...this.getLanguageConfidence(text)
        }));
    }

    /**
     * 根據用戶ID獲取偏好語言
     */
    getUserPreferredLanguage(userId, defaultLang = 'zh') {
        // 這裡可以從用戶設定中獲取偏好語言
        // 目前返回預設值
        return defaultLang;
    }

    /**
     * 智能語言檢測（結合用戶偏好）
     */
    smartDetectLanguage(text, userId = null) {
        const detectionResult = this.getLanguageConfidence(text);
        
        // 如果檢測信心度很低，使用用戶偏好語言
        if (detectionResult.confidence < 0.3 && userId) {
            const preferredLang = this.getUserPreferredLanguage(userId);
            return {
                ...detectionResult,
                language: preferredLang,
                usedUserPreference: true
            };
        }

        return {
            ...detectionResult,
            usedUserPreference: false
        };
    }

    /**
     * 檢測文本中的語言混用情況
     */
    analyzeLanguageMixing(text) {
        const japaneseRatio = (text.match(this.japaneseRegex) || []).length / text.length;
        const chineseRatio = (text.match(this.chineseRegex) || []).length / text.length;
        
        return {
            isMixed: japaneseRatio > 0.1 && chineseRatio > 0.1,
            japaneseRatio,
            chineseRatio,
            dominantLanguage: japaneseRatio > chineseRatio ? 'ja' : 'zh'
        };
    }

    /**
     * 驗證語言檢測結果
     */
    validateDetection(text, detectedLanguage) {
        const verification = this.getLanguageConfidence(text);
        
        return {
            isValid: verification.language === detectedLanguage,
            confidence: verification.confidence,
            alternative: verification.language !== detectedLanguage ? verification.language : null
        };
    }

    /**
     * 獲取語言特定的處理建議
     */
    getProcessingSuggestions(language) {
        const suggestions = {
            zh: {
                timeFormat: '24小時制，使用"點"表示小時',
                dateFormat: 'YYYY年MM月DD日',
                weekdays: ['日', '一', '二', '三', '四', '五', '六'],
                commonPhrases: ['今天', '明天', '下週', '每天'],
                punctuation: ['。', '，', '！', '？']
            },
            ja: {
                timeFormat: '24小時制，使用"時"表示小時',
                dateFormat: 'YYYY年MM月DD日',
                weekdays: ['日', '月', '火', '水', '木', '金', '土'],
                commonPhrases: ['今日', '明日', '来週', '毎日'],
                punctuation: ['。', '、', '！', '？']
            }
        };

        return suggestions[language] || suggestions.zh;
    }

    /**
     * 語言統計分析
     */
    getLanguageStats(text) {
        const totalChars = text.length;
        const japaneseChars = (text.match(this.japaneseRegex) || []).length;
        const chineseChars = (text.match(this.chineseRegex) || []).length;
        const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
        const numbers = (text.match(/\d/g) || []).length;
        const punctuation = (text.match(/[。，、！？．,!?.]/g) || []).length;
        const other = totalChars - japaneseChars - chineseChars - englishChars - numbers - punctuation;

        return {
            total: totalChars,
            japanese: {
                count: japaneseChars,
                percentage: (japaneseChars / totalChars * 100).toFixed(2)
            },
            chinese: {
                count: chineseChars,
                percentage: (chineseChars / totalChars * 100).toFixed(2)
            },
            english: {
                count: englishChars,
                percentage: (englishChars / totalChars * 100).toFixed(2)
            },
            numbers: {
                count: numbers,
                percentage: (numbers / totalChars * 100).toFixed(2)
            },
            punctuation: {
                count: punctuation,
                percentage: (punctuation / totalChars * 100).toFixed(2)
            },
            other: {
                count: other,
                percentage: (other / totalChars * 100).toFixed(2)
            }
        };
    }
}

// 創建單例實例
const languageParser = new LanguageParser();

// 導出檢測函數
function detectLanguage(text) {
    return languageParser.detectLanguage(text);
}

function getLanguageConfidence(text) {
    return languageParser.getLanguageConfidence(text);
}

function smartDetectLanguage(text, userId = null) {
    return languageParser.smartDetectLanguage(text, userId);
}

module.exports = {
    LanguageParser,
    languageParser,
    detectLanguage,
    getLanguageConfidence,
    smartDetectLanguage
};
