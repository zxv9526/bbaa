// Cloudflare Pages Function: /api/telegram
// Telegram Bot Webhook & Admin Management for Chinese Poker (十三水)

export async function onRequest(context) {
  const env = context.env || {};
  const db = env.DB || env.D1 || env.DATABASE || env.THIRTEEN_WATER_DB;
  const botToken = env.TELEGRAM_BOT_TOKEN || env.BOT_TOKEN || '';
  const adminPassword = env.TELEGRAM_ADMIN_PASSWORD || env.ADMIN_PASSWORD || '13poker888';
  const configuredAdminIds = (env.TELEGRAM_ADMIN_IDS || '')
    .split(',')
    .map(s => s.trim())
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

  // 1. GET requests: Status, Webhook setup, Command test simulation
  if (context.request.method === 'GET') {
    const url = new URL(context.request.url);
    const action = url.searchParams.get('action');

    // 1.1 Telegram Bot Config Status
    if (action === 'status' || !action) {
      let botInfo = null;
      let webhookInfo = null;

      if (botToken) {
        try {
          const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
          if (meRes.ok) botInfo = await meRes.json();
          const hookRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
          if (hookRes.ok) webhookInfo = await hookRes.json();
        } catch {
          // ignore external fetch error
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

      const currentOrigin = url.origin;
      const recommendedWebhookUrl = `${currentOrigin}/api/telegram`;

      return new Response(
        JSON.stringify({
          ok: true,
          hasBotToken: !!botToken,
          botUsername: botInfo?.result?.username || null,
          botFirstName: botInfo?.result?.first_name || null,
          webhookInfo: webhookInfo?.result || null,
          recommendedWebhookUrl,
          configuredAdminIdsCount: configuredAdminIds.length,
          dbAdminsCount: dbAdmins.length,
          dbAdmins,
          d1Bound: !!db,
          hasAdminPassword: !!adminPassword
        }),
        { headers }
      );
    }

    // 1.2 Set Webhook via Cloudflare Function
    if (action === 'setWebhook') {
      if (!botToken) {
        return new Response(
          JSON.stringify({ ok: false, message: 'TELEGRAM_BOT_TOKEN environment variable is not set.' }),
          { status: 400, headers }
        );
      }

      const targetUrl = url.searchParams.get('url') || `${url.origin}/api/telegram`;
      try {
        const tgRes = await fetch(
          `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(targetUrl)}`
        );
        const tgData = await tgRes.json();
        return new Response(JSON.stringify(tgData), { headers });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers });
      }
    }

    // 1.3 Simulate a command (for in-browser Command Terminal testing)
    if (action === 'simulate' || action === 'testCommand') {
      const commandText = url.searchParams.get('command') || '/help';
      const mockChatId = 'simulator_admin_user';
      const response = await handleBotCommand(commandText, {
        id: mockChatId,
        username: 'AdminPreview',
        first_name: '管理员'
      }, db, adminPassword, configuredAdminIds, true);

      return new Response(JSON.stringify({ ok: true, command: commandText, response }), { headers });
    }
  }

  // 2. POST requests: Telegram Webhook or In-App Actions
  if (context.request.method === 'POST') {
    let update;
    try {
      update = await context.request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, message: 'Invalid JSON' }), { status: 400, headers });
    }

    // Check if it's an internal test or web-based trigger
    if (update.action === 'simulate') {
      const commandText = update.command || '/help';
      const response = await handleBotCommand(commandText, {
        id: 'web_simulator',
        username: update.username || 'AdminUser',
        first_name: '测试管理员'
      }, db, adminPassword, configuredAdminIds, true);
      return new Response(JSON.stringify({ ok: true, response }), { headers });
    }

    // Handle Telegram Update
    const message = update.message || update.edited_message;
    const callbackQuery = update.callback_query;

    if (callbackQuery) {
      const chatId = callbackQuery.message?.chat?.id;
      const fromUser = callbackQuery.from;
      const callbackData = callbackQuery.data;

      const reply = await handleBotCommand(callbackData, fromUser, db, adminPassword, configuredAdminIds, false);

      // Answer Callback Query to dismiss loading
      if (botToken && callbackQuery.id) {
        try {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackQuery.id })
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

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('Error sending Telegram message:', err);
  }
}

// ----------------------------------------------------
// Check if user is admin
// ----------------------------------------------------
async function isUserAdmin(user, db, configuredAdminIds) {
  if (!user || !user.id) return false;
  const userIdStr = String(user.id);

  // 1. In environment variable whitelist
  if (configuredAdminIds && configuredAdminIds.includes(userIdStr)) {
    return true;
  }

  // 2. In D1 database bot_admins table
  if (db) {
    try {
      const adminRecord = await db.prepare("SELECT * FROM bot_admins WHERE chat_id = ?").bind(userIdStr).first();
      if (adminRecord) return true;
    } catch {
      // table check
    }
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
  const userIdStr = String(user.id);

  // Check admin status
  const isAdmin = isSimulation || (await isUserAdmin(user, db, configuredAdminIds));

  // Quick Navigation Keyboard Markup
  const mainKeyboard = {
    inline_keyboard: [
      [
        { text: '🏆 全服风云榜', callback_data: '/rank' },
        { text: '📊 游戏全局统计', callback_data: '/stats' }
      ],
      [
        { text: '👥 活跃玩家列表', callback_data: '/players' },
        { text: '📜 最新对局历史', callback_data: '/history' }
      ],
      [
        { text: '❓ 帮助与指令说明', callback_data: '/help' }
      ]
    ]
  };

  // 1. Command: /auth <password> (Admin registration)
  if (mainCmd === '/auth' || mainCmd === '/bind' || mainCmd === '/login') {
    if (!arg1) {
      return {
        text: `🔐 <b>管理员身份验证</b>\n\n请输入授权密码完成绑定：\n<code>/auth &lt;管理员密码&gt;</code>\n\n<i>绑定成功后即可通过本 Bot 查看玩家积分流水与全服数据。</i>`
      };
    }

    if (arg1 === adminPassword) {
      if (db) {
        try {
          await db.prepare(`
            INSERT INTO bot_admins (chat_id, username, first_name, role, created_at)
            VALUES (?, ?, ?, 'admin', datetime('now'))
            ON CONFLICT(chat_id) DO UPDATE SET
              username = ?, first_name = ?
          `).bind(
            userIdStr,
            user.username || '',
            user.first_name || '',
            user.username || '',
            user.first_name || ''
          ).run();
        } catch (e) {
          console.error('Error saving admin to DB:', e);
        }
      }

      return {
        text: `🎉 <b>验证成功！</b>\n\n您已成功绑定为 <b>十三水游戏管理员</b>。\n当前用户 ID: <code>${userIdStr}</code>\n\n您可以随时输入下方指令或点击快捷菜单查看数据：`,
        reply_markup: mainKeyboard
      };
    } else {
      return {
        text: `❌ <b>验证失败</b>：密码错误，请联系系统管理员获取正确授权。`
      };
    }
  }

  // 2. Command: /start or /help
  if (mainCmd === '/start' || mainCmd === '/help') {
    const adminStatusText = isAdmin
      ? `✅ <b>管理员状态</b>: 已授权 (Authorized)`
      : `⚠️ <b>管理员状态</b>: 未授权 (请使用 <code>/auth 密码</code> 绑定)`;

    return {
      text: `🃏 <b>十三水 (Chinese Poker) 管理员机器人</b>\n${adminStatusText}\n\n` +
        `<b>常用管理指令：</b>\n` +
        `• <code>/rank</code> 或 <code>/top</code> - 查看全服积分风云榜\n` +
        `• <code>/score &lt;玩家名&gt;</code> - 精确查询指定玩家的净胜积分、胜率及近况\n` +
        `• <code>/players</code> - 列出所有活跃玩家及当前积分\n` +
        `• <code>/stats</code> - 查看全局对局数、特殊牌总数及 D1 状态\n` +
        `• <code>/history [数量]</code> - 查看最近对局明细流水\n` +
        `• <code>/auth &lt;密码&gt;</code> - 输入管理员密码授权绑定\n\n` +
        `👇 <i>点击下方按钮快速查询数据：</i>`,
      reply_markup: mainKeyboard
    };
  }

  // Permission Check for Data Queries
  if (!isAdmin) {
    return {
      text: `🔒 <b>权限受限</b>\n\n您尚未获得十三水管理员授权，无法直接查看玩家积分与后台数据。\n\n请发送：\n<code>/auth 您的管理员密码</code>\n完成身份绑定。`
    };
  }

  // 3. Command: /score or /player or /cx (Check specific player)
  if (mainCmd === '/score' || mainCmd === '/player' || mainCmd === '/cx') {
    const targetPlayerName = parts.slice(1).join(' ').trim();
    if (!targetPlayerName) {
      return {
        text: `🔍 <b>玩家积分查询</b>\n\n使用方式：\n<code>/score 玩家昵称</code>\n例如：<code>/score 大侠_123</code>`
      };
    }

    if (!db) {
      return {
        text: `⚠️ <b>数据库未绑定</b>：当前运行在本地无 D1 环境，无法查询远程玩家数据。`
      };
    }

    try {
      // Query player summary
      const playerRecord = await db.prepare("SELECT * FROM players WHERE name = ? OR id = ?").bind(targetPlayerName, targetPlayerName).first();

      if (!playerRecord) {
        return {
          text: `🔍 <b>未找到玩家</b>：<code>${escapeHtml(targetPlayerName)}</code>\n\n该玩家可能尚未完成任何有效对局。`
        };
      }

      // Query recent matches
      const recentMatches = await db.prepare(
        "SELECT * FROM game_records WHERE player_name = ? ORDER BY created_at DESC LIMIT 5"
      ).bind(playerRecord.name).all();

      const winRate = playerRecord.total_games > 0
        ? Math.round((playerRecord.wins / playerRecord.total_games) * 100)
        : 0;

      const scoreSign = playerRecord.total_points >= 0 ? `+${playerRecord.total_points}` : `${playerRecord.total_points}`;

      let matchesText = '';
      if (recentMatches?.results && recentMatches.results.length > 0) {
        matchesText = '\n\n<b>📜 最近 5 局流水：</b>\n' + recentMatches.results.map((m, i) => {
          const ptStr = m.points_won >= 0 ? `+${m.points_won}` : `${m.points_won}`;
          const resTag = m.result === 'SPECIAL_WIN' ? '✨特殊牌胜' : m.result === 'WIN' ? '🟢胜利' : m.result === 'LOSE' ? '🔴失利' : '⚪平局';
          const specialDesc = m.special_hand ? ` [${m.special_hand}]` : '';
          return `${i + 1}. ${resTag} <b>${ptStr}分</b>${specialDesc} | 前:${m.front_type}/中:${m.mid_type}/后:${m.back_type}`;
        }).join('\n');
      } else {
        matchesText = '\n\n<i>暂无详细历史流水</i>';
      }

      return {
        text: `🃏 <b>玩家积分与档案详情</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `👤 <b>玩家昵称</b>: <code>${escapeHtml(playerRecord.name)}</code>\n` +
          `💎 <b>净胜总积分</b>: <b>${scoreSign} 分</b>\n` +
          `🏆 <b>胜率统计</b>: <b>${winRate}%</b> (${playerRecord.wins}胜 / ${playerRecord.losses}负 / ${playerRecord.draws}平)\n` +
          `🎮 <b>总对局数</b>: ${playerRecord.total_games} 局\n` +
          `✨ <b>特殊牌次数</b>: ${playerRecord.special_hands_count || 0} 次` +
          matchesText,
        reply_markup: mainKeyboard
      };
    } catch (e) {
      return { text: `❌ 查询玩家数据出错: ${e.message}` };
    }
  }

  // 4. Command: /rank or /top or /leaderboard (Leaderboard)
  if (mainCmd === '/rank' || mainCmd === '/top' || mainCmd === '/leaderboard') {
    const limit = Math.min(parseInt(arg1 || '10', 10) || 10, 25);

    if (!db) {
      return {
        text: `⚠️ <b>数据库未绑定</b>：D1 暂不可用，无法拉取全服排行榜。`
      };
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
          text: `🏆 <b>全服风云积分榜</b>\n\n<i>暂无玩家积分数据，快进入游戏开始对局吧！</i>`,
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
        text: `🏆 <b>十三水 · 全服积分排行榜 (Top ${players.length})</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          listStr +
          `\n\n💡 <i>提示: 输入 <code>/score 玩家名</code> 可查询单个玩家历史明细。</i>`,
        reply_markup: mainKeyboard
      };
    } catch (e) {
      return { text: `❌ 获取排行榜出错: ${e.message}` };
    }
  }

  // 5. Command: /players or /list (All players)
  if (mainCmd === '/players' || mainCmd === '/list') {
    if (!db) {
      return { text: `⚠️ 数据库未绑定 D1。` };
    }

    try {
      const query = await db.prepare(`
        SELECT name, total_points, total_games, wins
        FROM players
        ORDER BY updated_at DESC, total_points DESC
        LIMIT 30
      `).all();

      const list = query?.results || [];
      if (list.length === 0) {
        return { text: `👥 暂无活跃玩家。`, reply_markup: mainKeyboard };
      }

      const rows = list.map((p, i) => {
        const pts = p.total_points >= 0 ? `+${p.total_points}` : `${p.total_points}`;
        return `${i + 1}. <code>${escapeHtml(p.name)}</code> - <b>${pts}分</b> (${p.total_games}局)`;
      }).join('\n');

      return {
        text: `👥 <b>活跃玩家总览 (共 ${list.length} 人)</b>\n━━━━━━━━━━━━━━━━━━\n` +
          rows +
          `\n\n🔍 发送 <code>/score &lt;玩家名&gt;</code> 查看指定玩家牌型与流水。`,
        reply_markup: mainKeyboard
      };
    } catch (e) {
      return { text: `❌ 查询玩家列表出错: ${e.message}` };
    }
  }

  // 6. Command: /stats or /summary (Global stats)
  if (mainCmd === '/stats' || mainCmd === '/summary') {
    if (!db) {
      return { text: `⚠️ 数据库未连接。` };
    }

    try {
      const playersCount = await db.prepare("SELECT COUNT(*) as cnt FROM players").first();
      const recordsCount = await db.prepare("SELECT COUNT(*) as cnt FROM game_records").first();
      const specialCount = await db.prepare("SELECT COUNT(*) as cnt FROM game_records WHERE special_hand IS NOT NULL").first();
      const roomsCount = await db.prepare("SELECT COUNT(*) as cnt FROM rooms").first();
      const adminCount = await db.prepare("SELECT COUNT(*) as cnt FROM bot_admins").first();

      return {
        text: `📊 <b>十三水 · 全局服务器统计</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `👥 <b>总注册玩家</b>: ${playersCount?.cnt || 0} 位\n` +
          `🎮 <b>总完成局数</b>: ${recordsCount?.cnt || 0} 局\n` +
          `✨ <b>特殊牌诞生</b>: ${specialCount?.cnt || 0} 次\n` +
          `🏠 <b>联机房间数</b>: ${roomsCount?.cnt || 0} 个\n` +
          `🤖 <b>已授权管理</b>: ${adminCount?.cnt || 0} 位\n` +
          `🗄️ <b>D1 数据引擎</b>: 正常运行中 (Cloudflare Global)`,
        reply_markup: mainKeyboard
      };
    } catch (e) {
      return { text: `❌ 获取统计失败: ${e.message}` };
    }
  }

  // 7. Command: /history or /recent (Recent game records)
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
        const tag = r.result === 'SPECIAL_WIN' ? '✨特殊牌' : r.result === 'WIN' ? '🟢胜' : r.result === 'LOSE' ? '🔴负' : '⚪平';
        return `${i + 1}. [${tag}] <b>${escapeHtml(r.player_name)}</b> (${pts}分)\n   └ 前: ${r.front_type} | 中: ${r.mid_type} | 后: ${r.back_type}`;
      }).join('\n\n');

      return {
        text: `📜 <b>全服最新对局记录 (前 ${records.length} 局)</b>\n━━━━━━━━━━━━━━━━━━\n` + rows,
        reply_markup: mainKeyboard
      };
    } catch (e) {
      return { text: `❌ 获取历史出错: ${e.message}` };
    }
  }

  // Unknown command
  return {
    text: `❓ 未知指令: <code>${escapeHtml(commandText)}</code>\n\n请发送 <code>/help</code> 查看可用指令。`,
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
