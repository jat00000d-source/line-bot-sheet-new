// utils/commandParser.js
const nlpProcessor = require('./nlpProcessor');
const dateUtils = require('./dateUtils');
const languageDetector = require('./languageDetector');

/**
 * 解析用戶命令
 * @param {string} userText 用戶輸入的文字
 * @param {string} userId 用戶ID
 * @returns {Object} 解析結果
 */
function parseCommand(userText, userId) {
    try {
        // 檢查必要的依賴是否存在
        if (!nlpProcessor) {
            throw new Error('NLP processor module not available');
        }
        
        if (!userText || typeof userText !== 'string') {
            return {
                success: false,
                error: '輸入文字無效'
            };
        }

        // 清理和預處理文字
        const cleanText = userText.trim();
        
        if (!cleanText) {
            return {
                success: false,
                error: '輸入文字為空'
            };
        }

        // 檢查是否為預定義命令
        const predefinedResult = parsePredefinedCommand(cleanText);
        if (predefinedResult.success) {
            return predefinedResult;
        }

        // 使用自然語言處理器解析
        if (nlpProcessor && typeof nlpProcessor.parsePredefinedCommand === 'function') {
            const nlpResult = nlpProcessor.parsePredefinedCommand(cleanText, userId);
            if (nlpResult && nlpResult.success) {
                return nlpResult;
            }
        }

        // 如果都失敗了，嘗試基本的文字解析
        return parseBasicCommand(cleanText, userId);

    } catch (error) {
        console.error('命令解析錯誤:', error);
        return {
            success: false,
            error: `解析失敗: ${error.message}`,
            type: 'error'
        };
    }
}

/**
 * 解析預定義命令
 * @param {string} text 命令文字
 * @returns {Object} 解析結果
 */
function parsePredefinedCommand(text) {
    const lowerText = text.toLowerCase().trim();
    
    // 預定義命令映射
    const commandMap = {
        // 查詢相關
        'help': { type: 'help', success: true },
        '幫助': { type: 'help', success: true },
        '說明': { type: 'help', success: true },
        'menu': { type: 'menu', success: true },
        '選單': { type: 'menu', success: true },
        '功能': { type: 'menu', success: true },
        
        // 記帳相關
        'balance': { type: 'query_balance', success: true },
        '餘額': { type: 'query_balance', success: true },
        '查詢': { type: 'query_balance', success: true },
        'summary': { type: 'summary', success: true },
        '總結': { type: 'summary', success: true },
        '統計': { type: 'summary', success: true },
        
        // 設定相關
        'settings': { type: 'settings', success: true },
        '設定': { type: 'settings', success: true },
        '設置': { type: 'settings', success: true }
    };

    if (commandMap[lowerText]) {
        return commandMap[lowerText];
    }

    return { success: false };
}

/**
 * 基本命令解析（作為後備方案）
 * @param {string} text 輸入文字
 * @param {string} userId 用戶ID
 * @returns {Object} 解析結果
 */
function parseBasicCommand(text, userId) {
    try {
        // 檢測語言
        const language = languageDetector ? languageDetector.detectLanguage(text) : 'zh';
        
        // 嘗試解析為記帳項目
        const expensePattern = /([+-]?)(\d+(?:\.\d+)?)\s*(.+)/;
        const match = text.match(expensePattern);
        
        if (match) {
            const [, sign, amount, description] = match;
            const numAmount = parseFloat(amount);
            const isIncome = sign === '+';
            const isExpense = sign === '-' || !sign;
            
            return {
                success: true,
                type: isIncome ? 'income' : 'expense',
                amount: numAmount,
                description: description.trim(),
                date: dateUtils ? dateUtils.getCurrentDate() : new Date().toISOString().split('T')[0],
                userId: userId,
                language: language
            };
        }

        // 如果無法解析，返回錯誤
        return {
            success: false,
            error: '無法識別的命令格式',
            suggestion: '請嘗試: 金額 描述 (例如: 100 午餐) 或輸入 "help" 查看說明'
        };
        
    } catch (error) {
        console.error('基本命令解析錯誤:', error);
        return {
            success: false,
            error: '解析過程中發生錯誤'
        };
    }
}

/**
 * 驗證解析結果
 * @param {Object} result 解析結果
 * @returns {boolean} 是否有效
 */
function validateParseResult(result) {
    if (!result || typeof result !== 'object') {
        return false;
    }
    
    if (!result.hasOwnProperty('success')) {
        return false;
    }
    
    if (result.success && !result.type) {
        return false;
    }
    
    return true;
}

/**
 * 格式化錯誤信息
 * @param {Error} error 錯誤對象
 * @returns {string} 格式化後的錯誤信息
 */
function formatError(error) {
    if (!error) return '未知錯誤';
    return error.message || error.toString() || '未知錯誤';
}

module.exports = {
    parseCommand,
    parsePredefinedCommand,
    parseBasicCommand,
    validateParseResult,
    formatError
};
