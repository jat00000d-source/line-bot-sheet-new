const dateTimeParser = require('../parsers/dateTimeParser');
const { detectLanguage } = require('../parsers/languageParser');
const { COMMAND_PATTERNS, PRIORITY_KEYWORDS, LOCATION_PATTERNS } = require('../constants/dateTimeConstants');

class CommandParser {
    constructor() {
        this.patterns = COMMAND_PATTERNS;
    }

    /**
     * 主要解析函數
     */
    parseCommand(text) {
        const language = detectLanguage(text);
        const cleanText = text.trim();

        // 檢查是否為記帳指令（優先檢查，保持現有功能）
        const accountingResult = this.parseAccountingCommand(cleanText, language);
        if (accountingResult) {
            return accountingResult;
        }

        // 檢查是否為代辦/提醒指令
        const todoResult = this.parseTodoCommand(cleanText, language);
        if (todoResult) {
            return todoResult;
        }

        // 檢查是否為系統指令
        const systemResult = this.parseSystemCommand(cleanText, language);
        if (systemResult) {
            return systemResult;
        }

        return null;
    }

    /**
     * 解析記帳指令（保持現有邏輯）
     */
    parseAccountingCommand(text, language) {
        // 這裡保持你現有的記帳解析邏輯
        // 檢查是否包含金額、類別等記帳相關關鍵字
        const amountPattern = /[￥$€£¥]?\s*\d+(\.\d{1,2})?/;
        const categoryKeywords = {
            zh: ['早餐', '午餐', '晚餐', '交通', '購物', '娛樂', '醫療', '房租', '水電'],
            ja: ['朝食', '昼食', '夕食', '交通', '買い物', '娯楽', '医療', '家賃', '光熱費']
        };

        if (amountPattern.test(text)) {
            const keywords = categoryKeywords[language] || categoryKeywords.zh;
            const hasCategory = keywords.some(keyword => text.includes(keyword));
            
            if (hasCategory) {
                return {
                    type: 'accounting',
                    confidence: 0.9,
                    language: language,
                    originalText: text
                };
            }
        }

        return null;
    }

    /**
     * 解析代辦/提醒指令
     */
    parseTodoCommand(text, language) {
        const patterns = this.patterns[language] || this.patterns.zh;
        
        // 檢查動作類型
        let action = null;
        let confidence = 0;

        for (const [actionType, pattern] of Object.entries(patterns)) {
            if (pattern.test(text)) {
                action = actionType;
                confidence = 0.8;
                break;
            }
        }

        // 如果沒有明確動作，但包含提醒相關關鍵字，則判斷為新增
        if (!action) {
            const reminderKeywords = {
                zh: ['提醒', '代辦', '任務', '要做', '記得', '別忘了'],
                ja: ['リマインド', 'タスク', '予定', 'やること', '忘れずに', '覚えている']
            };

            const keywords = reminderKeywords[language] || reminderKeywords.zh;
            if (keywords.some(keyword => text.includes(keyword))) {
                action = 'add';
                confidence = 0.6;
            }
        }

        if (!action) return null;

        // 解析具體內容
        const parsedContent = this.parseContentDetails(text, language);
        
        return {
            type: 'todo',
            action: action,
            confidence: confidence,
            language: language,
            originalText: text,
            ...parsedContent
        };
    }

    /**
     * 解析內容詳情
     */
    parseContentDetails(text, language) {
        const result = {
            title: null,
            description: null,
            datetime: null,
            recurring: null,
            priority: null,
            location: null,
            tags: []
        };

        // 解析時間
        const datetimeResult = dateTimeParser.parse(text, language);
        if (datetimeResult) {
            if (datetimeResult.type === 'recurring') {
                result.recurring = datetimeResult.recurring;
            } else {
                result.datetime = datetimeResult.dateTime;
            }
        }

        // 解析優先級
        result.priority = this.parsePriority(text, language);

        // 解析地點
        result.location = this.parseLocation(text, language);

        // 解析標題和描述
        const titleDesc = this.extractTitleAndDescription(text, language);
        result.title = titleDesc.title;
        result.description = titleDesc.description;

        // 解析標籤
        result.tags = this.extractTags(text, language);

        return result;
    }

    /**
     * 解析優先級
     */
    parsePriority(text, language) {
        const keywords = PRIORITY_KEYWORDS[language] || PRIORITY_KEYWORDS.zh;
        
        for (const [level, words] of Object.entries(keywords)) {
            if (words.some(word => text.includes(word))) {
                return level;
            }
        }
        
        return 'medium'; // 預設中等優先級
    }

    /**
     * 解析地點
     */
    parseLocation(text, language) {
        const patterns = LOCATION_PATTERNS[language] || LOCATION_PATTERNS.zh;
        
        for (const [type, pattern] of Object.entries(patterns)) {
            const match = text.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }
        
        return null;
    }

    /**
     * 提取標題和描述
     */
    extractTitleAndDescription(text, language) {
        // 移除時間、地點、優先級等已解析的部分
        let cleanText = text;
        
        // 移除時間表達
        const timePatterns = {
            zh: [
                /\d{1,2}[點点时]\d{0,2}分?/g,
                /明天|後天|下[週周]/g,
                /每[天日週周月]/g
            ],
            ja: [
                /\d{1,2}[時时]\d{0,2}分?/g,
                /明日|来[週周月]/g,
                /毎[日週月]/g
            ]
        };

        const patterns = timePatterns[language] || timePatterns.zh;
        patterns.forEach(pattern => {
            cleanText = cleanText.replace(pattern, ' ');
        });

        // 移除動作詞
        const actionWords = {
            zh: ['提醒', '代辦', '新增', '創建', '要做', '記得', '別忘了'],
            ja: ['リマインド', 'タスク', '追加', '作成', 'やること', '忘れずに']
        };

        const actions = actionWords[language] || actionWords.zh;
        actions.forEach(word => {
            cleanText = cleanText.replace(new RegExp(word, 'g'), ' ');
        });

        // 清理多餘空白
        cleanText = cleanText.replace(/\s+/g, ' ').trim();

        // 簡單的標題描述分離（以第一個句號或換行為界）
        const sentences = cleanText.split(/[。．\n]/);
        const title = sentences[0]?.trim() || cleanText;
        const description = sentences.slice(1).join(' ').trim() || null;

        return {
            title: title || text, // 如果無法提取，使用原文
            description: description
        };
    }

    /**
     * 提取標籤
     */
    extractTags(text, language) {
        const tagPatterns = {
            zh: /#(\w+)/g,
            ja: /#(\w+)/g
        };

        const pattern = tagPatterns[language] || tagPatterns.zh;
        const matches = text.matchAll(pattern);
        const tags = [];

        for (const match of matches) {
            tags.push(match[1]);
        }

        return tags;
    }

    /**
     * 解析系統指令
     */
    parseSystemCommand(text, language) {
        const systemCommands = {
            zh: {
                help: ['幫助', '說明', '指令', '怎麼用'],
                settings: ['設定', '設置', '配置'],
                status: ['狀態', '統計', '報告'],
                export: ['匯出', '導出', '備份'],
                import: ['匯入', '導入', '恢復']
            },
            ja: {
                help: ['ヘルプ', '説明', 'コマンド', '使い方'],
                settings: ['設定', '設置', '構成'],
                status: ['ステータス', '統計', 'レポート'],
                export: ['エクスポート', 'バックアップ'],
                import: ['インポート', '復元']
            }
        };

        const commands = systemCommands[language] || systemCommands.zh;
        
        for (const [command, keywords] of Object.entries(commands)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                return {
                    type: 'system',
                    action: command,
                    confidence: 0.9,
                    language: language,
                    originalText: text
                };
            }
        }

        return null;
    }

    /**
     * 解析查詢指令的詳細參數
     */
    parseQueryParameters(text, language) {
        const params = {
            status: null,
            dateRange: null,
            priority: null,
            keyword: null,
            limit: null
        };

        // 解析狀態篩選
        const statusKeywords = {
            zh: {
                pending: ['待做', '未完成', '進行中'],
                completed: ['已完成', '完成了', '做完了'],
                overdue: ['逾期', '過期', '延誤']
            },
            ja: {
                pending: ['未完了', '進行中', 'やること'],
                completed: ['完了', '終了', '済み'],
                overdue: ['期限切れ', '遅延']
            }
        };

        const statuses = statusKeywords[language] || statusKeywords.zh;
        for (const [status, keywords] of Object.entries(statuses)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                params.status = status;
                break;
            }
        }

        // 解析日期範圍
        const dateRangeKeywords = {
            zh: ['今天', '明天', '本週', '下週', '本月', '下月'],
            ja: ['今日', '明日', '今週', '来週', '今月', '来月']
        };

        const ranges = dateRangeKeywords[language] || dateRangeKeywords.zh;
        for (const range of ranges) {
            if (text.includes(range)) {
                params.dateRange = range;
                break;
            }
        }

        // 解析數量限制
        const limitMatch = text.match(/(\d+)[個项]?/);
        if (limitMatch) {
            params.limit = parseInt(limitMatch[1]);
        }

        // 提取關鍵字（移除其他已解析的部分）
        let keyword = text;
        Object.values(params).forEach(value => {
            if (value && typeof value === 'string') {
                keyword = keyword.replace(new RegExp(value, 'g'), '');
            }
        });
        
        // 清理關鍵字
        keyword = keyword.replace(/[查看列出顯示搜尋搜索]/g, '').trim();
        if (keyword && keyword.length > 0) {
            params.keyword = keyword;
        }

        return params;
    }

    /**
     * 驗證解析結果
     */
    validateParseResult(result) {
        if (!result) return false;

        // 檢查必要欄位
        if (!result.type || !result.language) {
            return false;
        }

        // 檢查信心度
        if (result.confidence < 0.3) {
            return false;
        }

        // 針對不同類型進行特定驗證
        switch (result.type) {
            case 'todo':
                return this.validateTodoResult(result);
            case 'accounting':
                return this.validateAccountingResult(result);
            case 'system':
                return this.validateSystemResult(result);
            default:
                return true;
        }
    }

    validateTodoResult(result) {
        if (!result.action) return false;
        
        if (result.action === 'add') {
            return result.title && result.title.length > 0;
        }
        
        return true;
    }

    validateAccountingResult(result) {
        // 保持現有的記帳驗證邏輯
        return true;
    }

    validateSystemResult(result) {
        return result.action && typeof result.action === 'string';
    }

    /**
     * 獲取解析信心度
     */
    getConfidenceScore(text, result) {
        if (!result) return 0;

        let score = result.confidence || 0;

        // 根據解析到的元素數量增加信心度
        const elements = [
            result.datetime,
            result.recurring,
            result.priority,
            result.location,
            result.title
        ].filter(Boolean);

        score += elements.length * 0.1;

        // 確保不超過1.0
        return Math.min(1.0, score);
    }
}

module.exports = new CommandParser();
