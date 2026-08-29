const fs = require('fs');
const file = 'functions/api/telegram.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Update mainKeyboard
const oldKeyboard = `  // Quick Navigation Keyboard
  const mainKeyboard = {
    inline_keyboard: [
      [
        { text: '🏆 全服风云榜', callback_data: '/rank' },
        { text: '📊 游戏数据总览', callback_data: '/stats' }
      ],
      [
        { text: '👥 活跃玩家名录', callback_data: '/players' },
        { text: '📜 最新对局流水', callback_data: '/history' }
      ],
      [
        { text: '🆔 我的账号状态', callback_data: '/myid' },
        { text: '❓ 帮助与指令说明', callback_data: '/help' }
      ]
    ]
  };`;

const newKeyboard = `  // Quick Navigation Keyboard
  const mainKeyboard = {
    inline_keyboard: [
      [
        { text: '📱 授权手机号名录', callback_data: '/authlist' },
        { text: '👥 活跃玩家名录', callback_data: '/players' }
      ],
      [
        { text: '🏆 全服风云榜', callback_data: '/rank' },
        { text: '📊 游戏数据总览', callback_data: '/stats' }
      ],
      [
        { text: '📜 最新对局流水', callback_data: '/history' },
        { text: '🆔 我的账号状态', callback_data: '/myid' }
      ],
      [
        { text: '❓ 帮助与指令说明', callback_data: '/help' }
      ]
    ]
  };`;
content = content.replace(oldKeyboard, newKeyboard);

// 2. Add /help_auth response
content = content.replace(
  /if \(mainCmd === '\/start' \|\| mainCmd === '\/help'\) \{/,
  `if (mainCmd === '/help_auth') {
    return {
      text: \`📱 <b>Bot 手机号授权指令</b>\\n\\n使用方式：\\n<code>/auth 手机号码</code>\\n\\n例如：<code>/auth 13912345678</code>\\n\\n<i>授权后该手机号方可在游戏中注册新账号。</i>\`,
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 返回授权名录', callback_data: '/authlist' }], [{ text: '🏠 返回主菜单', callback_data: '/start' }]]
      }
    };
  }
  
  if (mainCmd === '/start' || mainCmd === '/help') {`
);

// 3. Update /authlist response to include interactive buttons
const oldAuthList = `  if (mainCmd === '/authlist' || mainCmd === '/whitelist') {
    let list = [];
    if (db) {
      try {
        const res = await db.prepare(\`SELECT phone FROM authorized_phones ORDER BY authorized_at DESC LIMIT 50\`).all();
        list = res?.results?.map(r => r.phone) || [];
      } catch {
        // ignore
      }
    }
    const listStr = list.length > 0
      ? list.map((p, i) => \`\${i + 1}. <code>\${p}</code>\`).join('\\n')
      : '<i>暂无云端授权列表或使用的是本地白名单机制。</i>';

    return {
      text: \`📱 <b>已授权手机号名录</b>\\n━━━━━━━━━━━━━━━━━━\\n\${listStr}\\n\\n💡 提示：使用 <code>/auth 手机号</code> 即可新增授权。\`,
      reply_markup: mainKeyboard
    };
  }`;

const newAuthList = `  if (mainCmd === '/authlist' || mainCmd === '/whitelist') {
    let list = [];
    if (db) {
      try {
        const res = await db.prepare(\`SELECT phone FROM authorized_phones ORDER BY authorized_at DESC LIMIT 50\`).all();
        list = res?.results?.map(r => r.phone) || [];
      } catch {
        // ignore
      }
    }
    
    const inlineBtns = [];
    if (list.length > 0) {
      list.forEach(p => {
         inlineBtns.push([
           { text: \`📱 \${p}\`, callback_data: \`/myid\` }, // dummy target to show id
           { text: \`🚫 取消授权\`, callback_data: \`/unauth \${p}\` }
         ]);
      });
    }
    inlineBtns.push([{ text: '➕ 新增授权 (用法: /auth 手机号)', callback_data: '/help_auth' }]);
    inlineBtns.push([{ text: '🏠 返回主菜单', callback_data: '/start' }]);

    const listStr = list.length > 0
      ? \`当前共有 <b>\${list.length}</b> 个授权手机号，点击下方按钮可快捷取消授权：\`
      : '<i>暂无云端授权手机号记录。</i>';

    return {
      text: \`📱 <b>已授权手机号名录</b>\\n━━━━━━━━━━━━━━━━━━\\n\${listStr}\`,
      reply_markup: { inline_keyboard: inlineBtns }
    };
  }`;

content = content.replace(oldAuthList, newAuthList);

// 4. Update /unauth response to return to authlist
const oldUnauth = `    return {
      text: \`🚫 <b>已取消注册授权</b>\\n\\n已移除手机号 <code>\${cleanPhone}</code> 的注册授权权限。\`,
      reply_markup: mainKeyboard
    };`;
    
const newUnauth = `    return {
      text: \`🚫 <b>已取消注册授权</b>\\n\\n已移除手机号 <code>\${cleanPhone}</code> 的注册授权权限。\`,
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 返回授权名录', callback_data: '/authlist' }], [{ text: '🏠 返回主菜单', callback_data: '/start' }]]
      }
    };`;

content = content.replace(oldUnauth, newUnauth);

// 5. Update /auth response to return to authlist
const oldAuth = `    return {
      text: \`✅ <b>手机号授权成功</b>\\n\\n手机号 <code>\${cleanPhone}</code> 已成功获得注册授权，现在可以在游戏中完成注册！\`,
      reply_markup: mainKeyboard
    };`;
const newAuth = `    return {
      text: \`✅ <b>手机号授权成功</b>\\n\\n手机号 <code>\${cleanPhone}</code> 已成功获得注册授权，现在可以在游戏中完成注册！\`,
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 返回授权名录', callback_data: '/authlist' }], [{ text: '🏠 返回主菜单', callback_data: '/start' }]]
      }
    };`;
content = content.replace(oldAuth, newAuth);

fs.writeFileSync(file, content);
