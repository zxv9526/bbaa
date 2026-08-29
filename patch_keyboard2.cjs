const fs = require('fs');
const file = 'functions/api/telegram.js';
let content = fs.readFileSync(file, 'utf8');

// Replace in /authlist
const authListRegex = /const inlineBtns = \[\];[\s\S]*?reply_markup: \{ inline_keyboard: inlineBtns \}\n    \};/s;
const authListNew = `const listStr = list.length > 0
      ? \`当前共有 <b>\${list.length}</b> 个授权手机号，最近授权列表如下：\\n\` + list.map(p => \`• <code>\${p}</code>\`).join('\\n')
      : '<i>暂无云端授权手机号记录。</i>';

    return {
      text: \`📱 <b>已授权手机号名录</b>\\n━━━━━━━━━━━━━━━━━━\\n\${listStr}\\n\\n👇 <b>快捷操作指南：</b>\\n直接在输入框输入 11位手机号码 即可快捷授权新用户。\\n如需取消授权，请回复：<code>/unauth 手机号码</code>\`,
      reply_markup: mainKeyboard
    };`;
content = content.replace(authListRegex, authListNew);

// Replace in /auth
content = content.replace(
  /reply_markup: \{\n\s*inline_keyboard: \[\[\{ text: '🔙 返回授权名录', callback_data: '\/authlist' \}\], \[\{ text: '🏠 返回主菜单', callback_data: '\/start' \}\]\]\n\s*\}/g,
  `reply_markup: mainKeyboard`
);

// Replace in /unauth
content = content.replace(
  /reply_markup: \{\n\s*inline_keyboard: \[\[\{ text: '🔙 返回授权名录', callback_data: '\/authlist' \}\], \[\{ text: '🏠 返回主菜单', callback_data: '\/start' \}\]\]\n\s*\}/g,
  `reply_markup: mainKeyboard`
);

// Replace in /help_auth
content = content.replace(
  /reply_markup: \{\n\s*inline_keyboard: \[\[\{ text: '🔙 返回授权名录', callback_data: '\/authlist' \}\], \[\{ text: '🏠 返回主菜单', callback_data: '\/start' \}\]\]\n\s*\}/g,
  `reply_markup: mainKeyboard`
);

// Replace in /players
const playersRegex = /const quickButtons = \[\];[\s\S]*?reply_markup: \{ inline_keyboard: quickButtons \}\n      \};/s;
const playersNew = `return {
        text: \`👥 <b>活跃玩家名录 (共 \${list.length} 位)</b>\\n━━━━━━━━━━━━━━━━━━\\n\` +
          rows +
          \`\\n\\n🔍 发送 <code>/score 玩家名</code> 或直接发送 <b>玩家名</b> 查看分数详情：\`,
        reply_markup: mainKeyboard
      };`;
content = content.replace(playersRegex, playersNew);

// Replace in /score
const scoreRegex = /reply_markup: \{\n\s*inline_keyboard: \[[\s\S]*?\]\n\s*\}/g;
content = content.replace(scoreRegex, 'reply_markup: mainKeyboard');

fs.writeFileSync(file, content);
