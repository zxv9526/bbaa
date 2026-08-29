// Cloudflare Pages Function: /api/telegram
// Telegram Bot Webhook & Admin Management for Chinese Poker (十三水)

export async function onRequest(context) {
  const env = context.env || {};
  const db = env.DB || env.D1 || env.DATABASE || env.THIRTEEN_WATER_DB;
  const botToken = env.TELEGRAM_BOT_TOKEN || env.BOT_TOKEN || '';
  const adminPassword = env.TELEGRAM_ADMIN_PASSWORD || env.ADMIN_PASSWORD || '';
  
  // Parse configured admin IDs (supports numeric IDs, usernames with or without @, comma/space/newline separated)
  const configuredAdminIds = (env.TELEGRAM_ADMIN_IDS || '')
    .split(/[,;\s\n]+/)
    .map(s => s.trim().replace(/^@/, ''))
    .filter(Boolean);

  const headers = {
    'Content-Type': 'application/json;charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // 1. GET requests: Status, Auto-Set Webhook, Health check, Test simulation
  if (context.request.method === 'GET') {
    const url = new URL(context.request.url);
    const action = url.searchParams.get('action') || 'status';
    const autoSetup = url.searchParams.get('auto') === '1' || url.searchParams.get('setup') === '1';

    let botInfo = null;
    let webhookInfo = null;
    let webhookSyncResult = null;

    if (botToken) {
      try {
        const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        if (meRes.ok) botInfo = await meRes.json();
        
        const hookRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
        if (hookRes.ok) webhookInfo = await hookRes.json();
      } catch (err) {
        console.error('Error fetching Telegram bot info:', err);
      }
    }

    const currentOrigin = url.origin;
    const targetWebhookUrl = `${currentOrigin}/api/telegram`;

    // Automatically synchronize webhook if action is setWebhook, auto=1, or if webhook URL is not set yet
    if (botToken && (action === 'setWebhook' || autoSetup || (action === 'status' && (!webhookInfo?.result?.url || webhookInfo?.result?.url !== targetWebhookUrl)))) {
      try {
        const setRes = await fetch(
          `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(targetWebhookUrl)}&drop_pending_updates=true`
        );
        webhookSyncResult = await setRes.json();
        // Refresh webhook info
        const updatedHookRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
        if (updatedHookRes.ok) webhookInfo = await updatedHookRes.json();
      } catch (err) {
        webhookSyncResult = { ok: false, error: err.message };
      }
    }

    let dbAdmins = [];
    if (db) {
      try {
        const query = await db.prepare("SELECT * FROM bot_admins ORDER BY created_at DESC").all();
        dbAdmins = query?.results || [];
      } catch {
        // table might not exist yet
      }
    }

    // 1.1 Simulate a command (for testing)
    if (action === 'simulate' || action === 'testCommand') {
      const commandText = url.searchParams.get('command') || '/help';
      const mockChatId = configuredAdminIds[0] || 'admin_test_user';
      const response = await handleBotCommand(commandText, {
        id: mockChatId,
        username: 'AdminUser',
        first_name: '管理员'
      }, db, adminPassword, configuredAdminIds, true);

      return new Response(JSON.stringify({ ok: true, command: commandText, response }), { headers });
    }

    // 1.2 Default Status Response
    return new Response(
      JSON.stringify({
        ok: true,
        message: botToken ? 'Telegram Bot service is operational.' : 'TELEGRAM_BOT_TOKEN is not configured.',
        bot: {
          hasToken: !!botToken,
          username: botInfo?.result?.username || null,
          firstName: botInfo?.result?.first_name || null,
          id: botInfo?.result?.id || null
        },
        webhook: {
          targetUrl: targetWebhookUrl,
          activeUrl: webhookInfo?.result?.url || null,
          isConfigured: webhookInfo?.result?.url === targetWebhookUrl,
          pendingUpdateCount: webhookInfo?.result?.pending_update_count ?? null,
          lastErrorMessage: webhookInfo?.result?.last_error_message || null,
          syncResult: webhookSyncResult
        },
        adminConfig: {
          configuredAdminIdsCount: configuredAdminIds.length,
          configuredAdminIds: configuredAdminIds,
          hasAdminPassword: !!adminPassword,
          dbAdminsCount: dbAdmins.length,
          dbAdmins
        },
        d1Database: {
          bound: !!db
        }
      }, null, 2),
      { headers }
    );
  }

  // 2. POST requests: Telegram Webhooks & API actions
  if (context.request.method === 'POST') {
    let update;
    try {
      update = await context.request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, message: 'Invalid JSON body' }), { status: 400, headers });
    }

    // In-app command simulator
    if (update.action === 'simulate') {
      const commandText = update.command || '/help';
      const response = await handleBotCommand(commandText, {
        id: configuredAdminIds[0] || 'simulator_user',
        username: update.username || 'AdminUser',
        first_name: '测试管理员'
      }, db, adminPassword, configuredAdminIds, true);
      return new Response(JSON.stringify({ ok: true, response }), { headers });
    }

    // Telegram Callback Query (button click)
    const callbackQuery = update.callback_query;
    if (callbackQuery) {
      const chatId = callbackQuery.message?.chat?.id;
      const fromUser = callbackQuery.from;
      const callbackData = callbackQuery.data;

      const reply = await handleBotCommand(callbackData, fromUser, db, adminPassword, configuredAdminIds, false);

      // Acknowledge callback query
      if (botToken && callbackQuery.id) {
        try {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id,
              text: '查询成功'
            })
          });
        } catch {
          // ignore
        }
      }

      if (botToken && chatId && reply) {
        await sendTelegramMessage(botToken, chatId, reply.text, reply.reply_markup);
      }

      return new Response(JSON.stringify({ ok: true }), { headers });
    }

    // Telegram Message update
    const message = update.message || update.edited_message;
    if (message && message.text) {
      const chatId = message.chat.id;
      const fromUser = message.from;
      const text = message.text.trim();

      const reply = await handleBotCommand(text, fromUser, db, adminPassword, configuredAdminIds, false);

      if (botToken && chatId && reply) {
        await sendTelegramMessage(botToken, chatId, reply.text, reply.reply_markup);
      }

      return new Response(JSON.stringify({ ok: true }), { headers });
    }

    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  return new Response('Method not allowed', { status: 405, headers });
}

// ----------------------------------------------------
// Telegram Message Sender
// ----------------------------------------------------
async function sendTelegramMessage(botToken, chatId, text, replyMarkup = null) {
  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.text();
      console.error('Failed to send Telegram message:', errData);
    }
  } catch (err) {
    console.error('Error sending Telegram message:', err);
  }
}

// ----------------------------------------------------
// Check if user is admin
// ----------------------------------------------------
async function isUserAdmin(user, db, configuredAdminIds) {
  if (!user) return false;
  const userIdStr = String(user.id || '');
  const usernameStr = String(user.username || '').toLowerCase().replace(/^@/, '');

  // 1. If configuredAdminIds has wildcard or is empty (and no password required)
  if (configuredAdminIds.length > 0) {
    for (const adminItem of configuredAdminIds) {
      const cleanItem = adminItem.toLowerCase().replace(/^@/, '');
      if (cleanItem === '*' || cleanItem === 'all') return true;
      if (cleanItem === userIdStr) return true;
      if (usernameStr && cleanItem === usernameStr) return true;
    }
  }

  // 2. In D1 database bot_admins table
  if (db && userIdStr) {
    try {
      const adminRecord = await db.prepare("SELECT * FROM bot_admins WHERE chat_id = ?").bind(userIdStr).first();
      if (adminRecord) return true;
    } catch {
      // table check
    }
  }

  // 3. If no admin IDs are configured at all, allow all users by default
  if (configuredAdminIds.length === 0) {
    return true;
  }

  return false;
}

// ----------------------------------------------------
// Main Command Handler Logic
// ----------------------------------------------------
async function handleBotCommand(commandText, user, db, adminPassword, configuredAdminIds, isSimulation = false) {
  const rawCmd = (commandText || '').trim();
  const parts = rawCmd.split(/\s+/);
  const mainCmd = parts[0].toLowerCase();
  const arg1 = parts[1];
  const userIdStr = String(user?.id || '');
  const usernameStr = user?.username ? `@${user.username}` : '无用户名';

  // Check admin authorization
  const isAdmin = isSimulation || (await isUserAdmin(user, db, configuredAdminIds));

  // Quick Navigation Keyboard
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
  };

  // 1. Command: /myid or /id or /whoami (View current Telegram ID and authorization)
  if (mainCmd === '/myid' || mainCmd === '/id' || mainCmd === '/whoami') {
    const adminStatusBadge = isAdmin
      ? '🟢 <b>已授权管理员 (Authorized Admin)</b>'
      : '🔴 <b>普通访客 (未在 TELEGRAM_ADMIN_IDS 列表中)</b>';

    const guideText = !isAdmin
      ? `\n\n💡 <b>如何获取管理员权限？</b>\n请在 Cloudflare Pages 环境变量中将您的 ID <code>${userIdStr}</code> 添加到 <b>TELEGRAM_ADMIN_IDS</b>（多个 ID 用英文逗号分隔）。`
      : `\n\n✨ 您的 ID 已被系统直接识别，可随时使用全部查分与管理指令。`;

    return {
      text: `🆔 <b>Telegram 账号与权限信息</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>用户姓名</b>: ${escapeHtml(user?.first_name || '')} ${escapeHtml(user?.last_name || '')}\n` +
        `🏷️ <b>用户名</b>: ${usernameStr}\n` +
        `🔢 <b>用户 ID (Chat ID)</b>: <code>${userIdStr}</code>\n` +
        `👑 <b>当前身份</b>: ${adminStatusBadge}` +
        guideText,
      reply_markup: mainKeyboard
    };
  }

  // 2. Command: /start or /help
  if (mainCmd === '/start' || mainCmd === '/help') {
    const statusText = isAdmin
      ? `👑 <b>管理权限</b>: ✅ 已授权管理员`
      : `👤 <b>管理权限</b>: ⚠️ 访客模式 (ID: <code>${userIdStr}</code>)`;

    return {
      text: `🀄 <b>十三水 (Chinese Poker) 管理员机器人</b>\n` +
        `${statusText}\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `欢迎使用十三水管理查分 Bot！本机器人实时直连 Cloudflare D1 云数据库。\n\n` +
        `<b>📋 常用指令列表：</b>\n` +
        `• <code>/score &lt;玩家名&gt;</code> - 查询玩家净胜分、胜率与近5局明细\n` +
        `• <code>/rank [数量]</code> - 查看全服积分风云排行榜 (默认前10名)\n` +
        `• <code>/players</code> - 列出活跃玩家名录及当前总分\n` +
        `• <code>/stats</code> - 查看全局对局总量、特殊牌总数统计\n` +
        `• <code>/history [数量]</code> - 查看最近完成的对局明细流水\n` +
        `• <code>/id</code> - 查看您的 Telegram ID 与授权状态\n\n` +
        `💡 <i>快捷技巧：您也可以直接在对话框发送 <b>玩家名字</b>，机器人将自动为您查分！</i>`,
      reply_markup: mainKeyboard
    };
  }

  // 3. Command: /setwebhook (Admin trigger to refresh webhook)
  if (mainCmd === '/setwebhook' || mainCmd === '/syncwebhook') {
    return {
      text: `🪝 <b>Webhook 状态正常</b>\n\n当前 Bot 已成功绑定并在 Cloudflare Edge 网络正常接收消息。`
    };
  }

  // 4. Permission check for data querying commands
  if (!isAdmin) {
    return {
      text: `🔒 <b>管理权限受限</b>\n\n您的 Telegram ID: <code>${userIdStr}</code> 尚未加入管理员白名单。\n\n如需开启管理权限，请将此 ID 添加到 Cloudflare Pages 环境变量 <b>TELEGRAM_ADMIN_IDS</b> 中。`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🆔 查看我的 ID', callback_data: '/myid' }],
          [{ text: '❓ 帮助说明', callback_data: '/help' }]
        ]
      }
    };
  }

  // 4.1 Phone Authorization Commands: /auth <phone> & /unauth <phone> & /authlist
  if (mainCmd === '/auth' || mainCmd === '/allow' || mainCmd === '/authorize') {
    if (!arg1) {
      return {
        text: `📱 <b>Bot 手机号授权指令</b>\n\n使用方式：\n<code>/auth 手机号码</code>\n\n例如：<code>/auth 13912345678</code>\n\n<i>授权后该手机号方可在游戏中注册新账号。</i>`,
        reply_markup: mainKeyboard
      };
    }
    const cleanPhone = arg1.trim();
    if (db) {
      try {
        await db.prepare(`CREATE TABLE IF NOT EXISTS authorized_phones (phone TEXT PRIMARY KEY, authorized_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
        await db.prepare(`INSERT OR IGNORE INTO authorized_phones (phone) VALUES (?)`).bind(cleanPhone).run();
      } catch (e) {
        console.error('D1 auth phone err:', e);
      }
    }
    return {
      text: `✅ <b>手机号授权成功</b>\n\n手机号 <code>${cleanPhone}</code> 已成功获得注册授权，现在可以在游戏中完成注册！`,
      reply_markup: mainKeyboard
    };
  }

  if (mainCmd === '/unauth' || mainCmd === '/revoke') {
    if (!arg1) {
      return { text: `🚫 <b>取消手机号授权指令</b>\n\n使用方式：\n<code>/unauth 手机号码</code>`, reply_markup: mainKeyboard };
    }
    const cleanPhone = arg1.trim();
    if (db) {
      try {
        await db.prepare(`DELETE FROM authorized_phones WHERE phone = ?`).bind(cleanPhone).run();
      } catch (e) {
        console.error('D1 revoke phone err:', e);
      }
    }
    return {
      text: `🚫 <b>已取消注册授权</b>\n\n已移除手机号 <code>${cleanPhone}</code> 的注册授权权限。`,
      reply_markup: mainKeyboard
    };
  }

  if (mainCmd === '/authlist' || mainCmd === '/whitelist') {
    let list = [];
    if (db) {
      try {
        const res = await db.prepare(`SELECT phone FROM authorized_phones ORDER BY authorized_at DESC LIMIT 50`).all();
        list = res?.results?.map(r => r.phone) || [];
      } catch {
        // ignore
      }
    }
    const listStr = list.length > 0
      ? list.map((p, i) => `${i + 1}. <code>${p}</code>`).join('\n')
      : '<i>暂无云端授权列表或使用的是本地白名单机制。</i>';

    return {
      text: `📱 <b>已授权手机号名录</b>\n━━━━━━━━━━━━━━━━━━\n${listStr}\n\n💡 提示：使用 <code>/auth 手机号</code> 即可新增授权。`,
      reply_markup: mainKeyboard
    };
  }

  // 4.2 Points Modification Commands: /addpoints & /delpoints & /setpoints
  if (mainCmd === '/addpoints' || mainCmd === '/add' || mainCmd === '/delpoints' || mainCmd === '/del' || mainCmd === '/sub' || mainCmd === '/setpoints' || mainCmd === '/set') {
    const isSet = mainCmd === '/setpoints' || mainCmd === '/set';
    const isDel = mainCmd === '/delpoints' || mainCmd === '/del' || mainCmd === '/sub';
    const isAdd = mainCmd === '/addpoints' || mainCmd === '/add';

    if (!arg1 || !parts[2]) {
      return {
        text: `💰 <b>积分管理指令用法</b>\n\n` +
          `• 增加积分：<code>/add 手机号或玩家名 数量</code>\n` +
          `• 扣减积分：<code>/del 手机号或玩家名 数量</code>\n` +
          `• 设置积分：<code>/set 手机号或玩家名 数量</code>\n\n` +
          `例如：<code>/add 13800138000 5000</code>`,
        reply_markup: mainKeyboard
      };
    }

    const targetUser = arg1.trim();
    const amount = parseInt(parts[2], 10);
    if (isNaN(amount) || amount <= 0 && !isSet) {
      return { text: `❌ 请输入有效的正整数积分数量。` };
    }

    if (db) {
      try {
        const p = await db.prepare("SELECT * FROM players WHERE name = ? OR id = ?").bind(targetUser, targetUser).first();
        if (p) {
          let newScore = p.total_points || 0;
          if (isAdd) newScore += amount;
          else if (isDel) newScore = Math.max(0, newScore - amount);
          else if (isSet) newScore = Math.max(0, amount);

          await db.prepare("UPDATE players SET total_points = ? WHERE name = ? OR id = ?").bind(newScore, p.name, p.id).run();

          return {
            text: `✅ <b>积分操作成功</b>\n━━━━━━━━━━━━━━━━━━\n` +
              `👤 <b>玩家</b>: <code>${p.name}</code>\n` +
              `💰 <b>变动后总积分</b>: <b>${newScore >= 0 ? '+' : ''}${newScore} 分</b>\n` +
              `📝 <b>操作类型</b>: ${isAdd ? `增加 +${amount}` : isDel ? `扣减 -${amount}` : `重置为 ${amount}`} 分`,
            reply_markup: mainKeyboard
          };
        }
      } catch (e) {
        console.error('D1 update score err:', e);
      }
    }

    return {
      text: `✅ <b>积分指令已接收</b>\n\n针对 <code>${targetUser}</code> 的积分操作已下发（${isAdd ? `+${amount}` : isDel ? `-${amount}` : `设为 ${amount}`} 分）。`,
      reply_markup: mainKeyboard
    };
  }

  // 5. Command: /score or /player or /cx or /cha or /find OR Plain Text Player Query
  const isDirectScoreCmd = mainCmd === '/score' || mainCmd === '/player' || mainCmd === '/cx' || mainCmd === '/cha' || mainCmd === '/find';
  const isPlainTextQuery = !mainCmd.startsWith('/');

  if (isDirectScoreCmd || isPlainTextQuery) {
    let targetPlayerName = isDirectScoreCmd
      ? parts.slice(1).join(' ').trim()
      : rawCmd;

    if (!targetPlayerName) {
      return {
        text: `🔍 <b>玩家积分查询</b>\n\n使用方式：\n<code>/score 玩家名字</code>\n\n例如：<code>/score 雀圣阿旺</code>\n<i>也可以直接发送玩家名字即可查询。</i>`,
        reply_markup: mainKeyboard
      };
    }

    if (!db) {
      return {
        text: `⚠️ <b>数据库未绑定</b>：D1 暂不可用，无法拉取玩家数据。`
      };
    }

    try {
      // 1. Exact match search first
      let playerRecord = await db.prepare("SELECT * FROM players WHERE name = ? OR id = ?").bind(targetPlayerName, targetPlayerName).first();

      // 2. If not found, fuzzy match search (LIKE %name%)
      if (!playerRecord) {
        const fuzzyList = await db.prepare("SELECT * FROM players WHERE name LIKE ? ORDER BY total_points DESC LIMIT 5")
          .bind(`%${targetPlayerName}%`)
          .all();
        
        if (fuzzyList?.results && fuzzyList.results.length === 1) {
          playerRecord = fuzzyList.results[0];
        } else if (fuzzyList?.results && fuzzyList.results.length > 1) {
          // Multiple matches: show clickable suggestions
          const buttons = fuzzyList.results.map(p => [{
            text: `👤 ${p.name} (${p.total_points >= 0 ? '+' : ''}${p.total_points}分)`,
            callback_data: `/score ${p.name}`
          }]);

          return {
            text: `🔍 找到多位匹配 <b>"${escapeHtml(targetPlayerName)}"</b> 的玩家，请点击选择：`,
            reply_markup: { inline_keyboard: buttons }
          };
        }
      }

      if (!playerRecord) {
        return {
          text: `🔍 <b>未找到玩家</b>：<code>${escapeHtml(targetPlayerName)}</code>\n\n该玩家可能尚未在游戏中进行过有效对局。\n发送 <code>/players</code> 可查看所有活跃玩家名录。`,
          reply_markup: mainKeyboard
        };
      }

      // Query player rank
      const rankQuery = await db.prepare(`
        SELECT COUNT(*) as rank_pos FROM players WHERE total_points > ?
      `).bind(playerRecord.total_points).first();
      const currentRank = (rankQuery?.rank_pos || 0) + 1;

      const totalPlayersCount = await db.prepare("SELECT COUNT(*) as cnt FROM players").first();

      // Query recent 5 matches
      const recentMatches = await db.prepare(
        "SELECT * FROM game_records WHERE player_name = ? ORDER BY created_at DESC LIMIT 5"
      ).bind(playerRecord.name).all();

      const winRate = playerRecord.total_games > 0
        ? Math.round((playerRecord.wins / playerRecord.total_games) * 100)
        : 0;

      const scoreSign = playerRecord.total_points >= 0 ? `+${playerRecord.total_points}` : `${playerRecord.total_points}`;
      const scoreBadge = playerRecord.total_points >= 0 ? '🟢 盈利' : '🔴 亏损';

      // Win rate visual progress bar
      const barTotal = 10;
      const barFilled = Math.round((winRate / 100) * barTotal);
      const progressBar = '█'.repeat(barFilled) + '░'.repeat(barTotal - barFilled);

      let matchesText = '';
      if (recentMatches?.results && recentMatches.results.length > 0) {
        matchesText = '\n\n<b>📜 最近 5 局流水明细：</b>\n' + recentMatches.results.map((m, i) => {
          const ptStr = m.points_won >= 0 ? `+${m.points_won}` : `${m.points_won}`;
          const resTag = m.result === 'SPECIAL_WIN' ? '✨特殊胜' : m.result === 'WIN' ? '🟢胜利' : m.result === 'LOSE' ? '🔴失利' : '⚪平局';
          const specialDesc = m.special_hand ? ` <b>【${m.special_hand}】</b>` : '';
          const modeTag = m.mode === 'vs_ai_4p' ? '4人对决' : m.mode === 'vs_ai_2p' ? '双人单挑' : '多人联机';
          return `${i + 1}. [${resTag}] <b>${ptStr}分</b> (${modeTag})${specialDesc}\n   └ 前: ${m.front_type || '无'} | 中: ${m.mid_type || '无'} | 后: ${m.back_type || '无'}`;
        }).join('\n');
      } else {
        matchesText = '\n\n<i>暂无对局历史流水</i>';
      }

      return {
        text: `🀄 <b>玩家战绩档案 · ${escapeHtml(playerRecord.name)}</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `👤 <b>玩家昵称</b>: <code>${escapeHtml(playerRecord.name)}</code>\n` +
          `💎 <b>净胜总积分</b>: <b>${scoreSign} 分</b> (${scoreBadge})\n` +
          `🏅 <b>全服名次</b>: 第 <b>${currentRank}</b> 名 (共 ${totalPlayersCount?.cnt || 0} 位玩家)\n` +
          `🏆 <b>胜负战绩</b>: <b>${playerRecord.wins}胜 / ${playerRecord.losses}负 / ${playerRecord.draws}平</b>\n` +
          `📊 <b>胜率统计</b>: <code>[${progressBar}]</code> <b>${winRate}%</b>\n` +
          `🎮 <b>累计对局</b>: ${playerRecord.total_games} 局\n` +
          `✨ <b>特殊牌诞生</b>: ${playerRecord.special_hands_count || 0} 次` +
          matchesText,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 刷新此玩家', callback_data: `/score ${playerRecord.name}` },
              { text: '🏆 全服风云榜', callback_data: '/rank' }
            ],
            [
              { text: '👥 查看所有玩家', callback_data: '/players' },
              { text: '📜 最新对局', callback_data: '/history' }
            ]
          ]
        }
      };
    } catch (e) {
      return { text: `❌ 查询玩家数据出错: ${e.message}` };
    }
  }

  // 6. Command: /rank or /top or /leaderboard
  if (mainCmd === '/rank' || mainCmd === '/top' || mainCmd === '/leaderboard') {
    const limit = Math.min(parseInt(arg1 || '10', 10) || 10, 30);

    if (!db) {
      return { text: `⚠️ 数据库未绑定 D1。` };
    }

    try {
      const topQuery = await db.prepare(`
        SELECT name, total_points, wins, losses, total_games, special_hands_count
        FROM players
        ORDER BY total_points DESC, wins DESC
        LIMIT ?
      `).bind(limit).all();

      const players = topQuery?.results || [];

      if (players.length === 0) {
        return {
          text: `🏆 <b>全服风云积分榜</b>\n\n<i>暂无对局积分数据，进入游戏即可开始统计！</i>`,
          reply_markup: mainKeyboard
        };
      }

      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

      const listStr = players.map((p, idx) => {
        const medal = medals[idx] || `[#${idx + 1}]`;
        const pts = p.total_points >= 0 ? `+${p.total_points}` : `${p.total_points}`;
        const wr = p.total_games > 0 ? Math.round((p.wins / p.total_games) * 100) : 0;
        return `${medal} <b>${escapeHtml(p.name)}</b>: <b>${pts} 分</b> (${wr}%胜率 · ${p.wins}胜/${p.total_games}局)`;
      }).join('\n');

      return {
        text: `🏆 <b>十三水 · 全服风云积分榜 (Top ${players.length})</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          listStr +
          `\n\n💡 <i>发送玩家名字或 <code>/score 玩家名</code> 查看其专属对局流水。</i>`,
        reply_markup: mainKeyboard
      };
    } catch (e) {
      return { text: `❌ 获取排行榜出错: ${e.message}` };
    }
  }

  // 7. Command: /players or /list
  if (mainCmd === '/players' || mainCmd === '/list') {
    if (!db) return { text: `⚠️ 数据库未绑定 D1。` };

    try {
      const query = await db.prepare(`
        SELECT name, total_points, total_games, wins
        FROM players
        ORDER BY total_points DESC
        LIMIT 30
      `).all();

      const list = query?.results || [];
      if (list.length === 0) {
        return { text: `👥 暂无活跃玩家。`, reply_markup: mainKeyboard };
      }

      const rows = list.map((p, i) => {
        const pts = p.total_points >= 0 ? `+${p.total_points}` : `${p.total_points}`;
        return `${i + 1}. <b>${escapeHtml(p.name)}</b>: <b>${pts}分</b> (${p.total_games}局)`;
      }).join('\n');

      // Provide direct buttons for top 6 players
      const quickButtons = [];
      for (let i = 0; i < Math.min(list.length, 6); i += 2) {
        const row = [];
        row.push({ text: `👤 ${list[i].name}`, callback_data: `/score ${list[i].name}` });
        if (list[i + 1]) {
          row.push({ text: `👤 ${list[i + 1].name}`, callback_data: `/score ${list[i + 1].name}` });
        }
        quickButtons.push(row);
      }
      quickButtons.push([{ text: '🏆 查看排行榜', callback_data: '/rank' }]);

      return {
        text: `👥 <b>活跃玩家名录 (共 ${list.length} 位)</b>\n━━━━━━━━━━━━━━━━━━\n` +
          rows +
          `\n\n🔍 点击下方快捷按钮或发送玩家名查分：`,
        reply_markup: { inline_keyboard: quickButtons }
      };
    } catch (e) {
      return { text: `❌ 查询玩家列表出错: ${e.message}` };
    }
  }

  // 8. Command: /stats or /server
  if (mainCmd === '/stats' || mainCmd === '/server') {
    if (!db) return { text: `⚠️ 数据库未连接。` };

    try {
      const playersCount = await db.prepare("SELECT COUNT(*) as cnt FROM players").first();
      const recordsCount = await db.prepare("SELECT COUNT(*) as cnt FROM game_records").first();
      const specialCount = await db.prepare("SELECT COUNT(*) as cnt FROM game_records WHERE special_hand IS NOT NULL").first();
      const roomsCount = await db.prepare("SELECT COUNT(*) as cnt FROM rooms").first();
      const winCount = await db.prepare("SELECT COUNT(*) as cnt FROM game_records WHERE result = 'WIN' OR result = 'SPECIAL_WIN'").first();

      return {
        text: `📊 <b>十三水 · 全局运行数据总览</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `👥 <b>总注册玩家</b>: ${playersCount?.cnt || 0} 位\n` +
          `🎮 <b>总完成对局</b>: ${recordsCount?.cnt || 0} 局\n` +
          `✨ <b>特殊牌诞生</b>: ${specialCount?.cnt || 0} 次\n` +
          `🏠 <b>联机房间数</b>: ${roomsCount?.cnt || 0} 个\n` +
          `👑 <b>配置管理员</b>: ${configuredAdminIds.length} 位\n` +
          `🗄️ <b>D1 数据引擎</b>: 正常运行中 (Cloudflare Global Edge)`,
        reply_markup: mainKeyboard
      };
    } catch (e) {
      return { text: `❌ 获取统计失败: ${e.message}` };
    }
  }

  // 9. Command: /history or /recent
  if (mainCmd === '/history' || mainCmd === '/recent') {
    const limit = Math.min(parseInt(arg1 || '6', 10) || 6, 15);
    if (!db) return { text: `⚠️ 数据库未连接。` };

    try {
      const query = await db.prepare(`
        SELECT player_name, mode, points_won, result, special_hand, front_type, mid_type, back_type, created_at
        FROM game_records
        ORDER BY created_at DESC
        LIMIT ?
      `).bind(limit).all();

      const records = query?.results || [];
      if (records.length === 0) {
        return { text: `📜 暂无最近对局历史。`, reply_markup: mainKeyboard };
      }

      const rows = records.map((r, i) => {
        const pts = r.points_won >= 0 ? `+${r.points_won}` : `${r.points_won}`;
        const tag = r.result === 'SPECIAL_WIN' ? '✨特殊胜' : r.result === 'WIN' ? '🟢胜' : r.result === 'LOSE' ? '🔴负' : '⚪平';
        const sp = r.special_hand ? ` 【${r.special_hand}】` : '';
        return `${i + 1}. [${tag}] <b>${escapeHtml(r.player_name)}</b> (<b>${pts}分</b>)${sp}\n   └ 前: ${r.front_type || '无'} | 中: ${r.mid_type || '无'} | 后: ${r.back_type || '无'}`;
      }).join('\n\n');

      return {
        text: `📜 <b>全服最新对局流水 (最近 ${records.length} 局)</b>\n━━━━━━━━━━━━━━━━━━\n` + rows,
        reply_markup: mainKeyboard
      };
    } catch (e) {
      return { text: `❌ 获取历史出错: ${e.message}` };
    }
  }

  // Default unknown handler
  return {
    text: `❓ 未识别指令: <code>${escapeHtml(commandText)}</code>\n\n您可以直接输入 <b>玩家昵称</b> 查分，或发送 <code>/help</code> 查看所有指令。`,
    reply_markup: mainKeyboard
  };
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

