const fs = require('fs');
const file = 'functions/api/telegram.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /const buttons = fuzzyList\.results\.map\([\s\S]*?reply_markup: \{ inline_keyboard: buttons \}\n          \};/s;
const newStr = `return {
            text: \`🔍 找到多位匹配 <b>"\${escapeHtml(targetPlayerName)}"</b> 的玩家：\\n\` + fuzzyList.results.map(p => \`• \${escapeHtml(p.name)}\`).join('\\n') + \`\\n\\n请直接回复输入准确的玩家全名进行查询。\`,
            reply_markup: mainKeyboard
          };`;

content = content.replace(regex, newStr);
fs.writeFileSync(file, content);
