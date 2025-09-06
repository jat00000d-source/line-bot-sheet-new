class DefaultService {
  static getDefaultResponse(language) {
    const helpMessage = language === 'ja' ? 
      'こんにちは！改良版家計簿とリマインダー機能をご利用いただけます。\n\n💰 家計簿機能:\n「食費 500円 昼食」\n「交通費 200円」\n「支出確認」または「集計」\n「予算設定 50000」\n\n⏰ リマインダー機能（NEW！）:\n「明日8時に薬を飲む」\n「毎日19時に運動」\n「毎週月曜日に会議」\n「30分後に買い物」\n\n📋 管理機能:\n「リマインダー一覧」\n「リマインダー削除 [番号]」\n\n✨ 新機能:\n• Google Sheets 自動保存\n• 自動リマインダー送信\n• 繰り返し設定対応\n• 自然言語理解向上\n\n「説明」で詳細な使用方法をご確認ください。' :
      '您好！我是改良版記帳和提醒助手。\n\n💰 記帳功能:\n「食物 50元 午餐」\n「交通 30元」\n「查看支出」或「總結」\n「設定預算 50000」\n\n⏰ 提醒功能（全新！）:\n「明天8點吃藥」\n「每天晚上7點運動」\n「每週一開會」\n「30分鐘後買東西」\n\n📋 管理功能:\n「查看提醒」\n「刪除提醒 [編號]」\n\n✨ 新功能:\n• Google Sheets 自動儲存\n• 自動提醒發送\n• 支援重複設定\n• 自然語言理解增強\n\n請輸入「說明」查看詳細使用方法。';
    
    return {
      type: 'text',
      text: helpMessage
    };
  }
}

module.exports = DefaultService;
