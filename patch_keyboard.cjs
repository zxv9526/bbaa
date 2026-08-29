const fs = require('fs');
const file = 'functions/api/telegram.js';
let content = fs.readFileSync(file, 'utf8');

// Replace keyboard definition
const oldKeyboard = /const mainKeyboard = \{[\s\S]*?    \]\n  \};/;
const newKeyboard = `const mainKeyboard = {
    keyboard: [
      [
        { text: '📱 授权手机号' },
        { text: '👥 活跃玩家' }
      ],
      [
        { text: '🏆 全服风云榜' },
        { text: '📊 数据总览' }
      ],
      [
        { text: '📜 最新对局' },
        { text: '🆔 我的状态' }
      ],
      [
        { text: '❓ 帮助说明' }
      ]
    ],
    resize_keyboard: true,
    is_persistent: true
  };`;

content = content.replace(oldKeyboard, newKeyboard);

// Handle natural language and phone numbers
const cmdParsingOld = `  const rawCmd = (commandText || '').trim();
  const parts = rawCmd.split(/\\s+/);
  const mainCmd = parts[0].toLowerCase();
  const arg1 = parts[1];
  const userIdStr = String(user?.id || '');
  const usernameStr = user?.username ? \`@\${user.username}\` : '无用户名';`;

const cmdParsingNew = `  const rawCmd = (commandText || '').trim();
  const parts = rawCmd.split(/\\s+/);
  let mainCmd = parts[0].toLowerCase();
  let arg1 = parts[1];
  const userIdStr = String(user?.id || '');
  const usernameStr = user?.username ? \`@\${user.username}\` : '无用户名';

  if (rawCmd === '📱 授权手机号') mainCmd = '/authlist';
  else if (rawCmd === '👥 活跃玩家') mainCmd = '/players';
  else if (rawCmd === '🏆 全服风云榜') mainCmd = '/rank';
  else if (rawCmd === '📊 数据总览') mainCmd = '/stats';
  else if (rawCmd === '📜 最新对局') mainCmd = '/history';
  else if (rawCmd === '🆔 我的状态') mainCmd = '/myid';
  else if (rawCmd === '❓ 帮助说明') mainCmd = '/help';
  else if (/^1[3-9]\\d{9}$/.test(rawCmd)) {
    mainCmd = '/auth';
    arg1 = rawCmd;
  }`;

content = content.replace(cmdParsingOld, cmdParsingNew);

// Remove the inline_keyboard from other places that returned it (like /auth, /unauth, /help_auth, etc)
// Actually if they are ReplyKeyboards they don't need inline_keyboard except for specific flows like "Cancel Auth" button.
// For the auth list, keeping inline buttons to "Cancel Auth" is fine, but they wanted "bot不要帖子按钮，我要的是键盘菜单".
// So let's replace all reply_markup: { inline_keyboard: ... } with reply_markup: mainKeyboard if they just mean no inline keyboards at all.
// Wait, for /authlist, we have a list of recent phones and inline buttons to cancel them.
// If we don't have inline buttons, how do they cancel?
// They can type `/unauth 139...`.
// Let's rewrite /authlist so it doesn't use inline keyboards either.

fs.writeFileSync(file, content);
