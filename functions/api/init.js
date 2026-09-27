// Cloudflare Pages Function: /api/init
// Automatically runs table initialization on Cloudflare D1 database

export async function onRequest(context) {
  const env = context.env || {};
  const db = env.DB || env.D1 || env.DATABASE || env.THIRTEEN_WATER_DB;

  const headers = {
    'Content-Type': 'application/json;charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  if (!db) {
    return new Response(
      JSON.stringify({
        ok: true,
        d1Bound: false,
        message: 'D1 database binding "DB" not detected. The application will use high-speed local persistence fallback.',
        setupGuide: 'To bind D1 on Cloudflare Pages: Go to Project Settings -> Functions -> D1 Database Bindings -> Add binding with variable name: "DB".'
      }),
      { headers }
    );
  }

  try {
    // Execute D1 table creation statements (Auto Migration)
    const queries = [
      `CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        total_games INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        total_points INTEGER DEFAULT 0,
        special_hands_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS game_records (
        id TEXT PRIMARY KEY,
        player_name TEXT NOT NULL,
        mode TEXT NOT NULL,
        points_won INTEGER NOT NULL,
        result TEXT NOT NULL,
        special_hand TEXT,
        front_type TEXT,
        mid_type TEXT,
        back_type TEXT,
        opponents_summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS rooms (
        room_code TEXT PRIMARY KEY,
        host_name TEXT NOT NULL,
        max_players INTEGER DEFAULT 4,
        status TEXT DEFAULT 'waiting',
        players_json TEXT NOT NULL,
        deck_seed TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS system_meta (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS bot_admins (
        chat_id TEXT PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        role TEXT DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `CREATE TABLE IF NOT EXISTS authorized_phones (
        phone TEXT PRIMARY KEY,
        authorized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`,
      `DELETE FROM authorized_phones WHERE phone IN ('13900000000', '13800138000', '18888888888', '13800138001', '13800138002') OR phone LIKE '%13900000000%' OR phone LIKE '%13800138000%';`
    ];

    for (const sql of queries) {
      await db.prepare(sql).run();
    }

    // Record auto-init timestamp
    await db.prepare(`
      INSERT INTO system_meta (key, value, updated_at) 
      VALUES ('last_init_at', datetime('now'), datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = datetime('now'), updated_at = datetime('now')
    `).run();

    // Auto-configure Telegram webhook if bot token is present
    const botToken = env.TELEGRAM_BOT_TOKEN || env.BOT_TOKEN;
    let botWebhookStatus = null;
    if (botToken) {
      try {
        const urlObj = new URL(context.request.url);
        const webhookUrl = `${urlObj.origin}/api/telegram`;
        const hookCheck = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
        const hookData = await hookCheck.json();
        if (hookData?.result?.url !== webhookUrl) {
          const syncRes = await fetch(
            `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=true`
          );
          botWebhookStatus = await syncRes.json();
        } else {
          botWebhookStatus = { ok: true, activeUrl: webhookUrl };
        }
      } catch (err) {
        botWebhookStatus = { ok: false, error: err.message };
      }
    }

    // Query stats to confirm
    const recordsCountResult = await db.prepare("SELECT COUNT(*) as count FROM game_records").first();
    const playersCountResult = await db.prepare("SELECT COUNT(*) as count FROM players").first();
    const adminsCountResult = await db.prepare("SELECT COUNT(*) as count FROM bot_admins").first();

    return new Response(
      JSON.stringify({
        ok: true,
        d1Bound: true,
        tablesCreated: true,
        message: 'Cloudflare D1 tables verified and initialized successfully!',
        botWebhookStatus,
        stats: {
          totalGames: recordsCountResult?.count || 0,
          totalPlayers: playersCountResult?.count || 0,
          totalAdmins: adminsCountResult?.count || 0
        },
        timestamp: new Date().toISOString()
      }),
      { headers }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        d1Bound: true,
        error: error.message || 'Error initializing D1 tables'
      }),
      { status: 500, headers }
    );
  }
}
