const fs = require('fs');
const file = 'functions/api/telegram.js';
let content = fs.readFileSync(file, 'utf8');

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

const newAuthList = `  if (mainCmd === '/authlist' || mainCmd === '/whitelist') {
    let list = [];
    if (db) {
      try {
        const res = await db.prepare(\`SELECT phone FROM authorized_phones ORDER BY authorized_at DESC LIMIT 30\`).all();
        list = res?.results?.map(r => r.phone) || [];
      } catch {
        // ignore
      }
    }
    
    const inlineBtns = [];
    if (list.length > 0) {
      // Create a grid: 2 columns for phones to save space, or just list text and minimal buttons
      // Let's limit inline buttons to top 15 to avoid telegram limits
      const limitList = list.slice(0, 15);
      limitList.forEach(p => {
         inlineBtns.push([
           { text: \`📱 \${p}\`, callback_data: \`ignore\` },
           { text: \`🚫 取消授权\`, callback_data: \`/unauth \${p}\` }
         ]);
      });
      if (list.length > 15) {
         inlineBtns.push([{ text: \`... 更多授权请在系统面板查看\`, callback_data: \`ignore\` }]);
      }
    }
    inlineBtns.push([{ text: '➕ 新增授权 (用法: /auth 手机号)', callback_data: '/help_auth' }]);
    inlineBtns.push([{ text: '🏠 返回主菜单', callback_data: '/start' }]);

    const listStr = list.length > 0
      ? \`当前共有 <b>\${list.length}</b> 个授权手机号，最近授权列表如下：\\n\` + list.map(p => \`• <code>\${p}</code>\`).join('\\n')
      : '<i>暂无云端授权手机号记录。</i>';

    return {
      text: \`📱 <b>已授权手机号名录</b>\\n━━━━━━━━━━━━━━━━━━\\n\${listStr}\\n\\n👇 <b>快捷管理区 (最近 15 条)：</b>\`,
      reply_markup: { inline_keyboard: inlineBtns }
    };
  }`;

content = content.replace(oldAuthList, newAuthList);
fs.writeFileSync(file, content);
