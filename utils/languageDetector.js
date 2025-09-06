class BasicLanguageDetector {
  detect(text) {
    const japaneseChars = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    return japaneseChars.test(text) ? 'ja' : 'zh';
  }
}

module.exports = BasicLanguageDetector;
