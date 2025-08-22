// test-config.js (測試完可以刪除)
const config = require('./config/config');
const { COMMAND_MAPPING } = require('./constants/commands');
const LanguageDetector = require('./utils/languageDetector');
const CommandParser = require('./utils/commandParser');

console.log('🧪 測試基礎配置...');

// 測試配置載入
console.log('✓ 配置載入成功');

// 測試語言檢測
console.log('語言檢測測試:');
console.log('  "總結" ->', LanguageDetector.detectLanguage('總結'));
console.log('  "集計" ->', LanguageDetector.detectLanguage('集計'));
console.log('  "ランチ 150" ->', LanguageDetector.detectLanguage('ランチ 150'));

// 測試指令解析
console.log('指令解析測試:');
console.log('  "總結" ->', CommandParser.parseCommand('總結'));
console.log('  "設定預算 50000" ->', CommandParser.parseCommand('設定預算 50000'));

console.log('🎉 基礎配置測試完成！');
