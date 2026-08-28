// Cloudflare Pages Function: /api/history
// Retrieves game records or saves a completed game into D1

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

  // GET: Fetch recent game records
  if (context.request.method === 'GET') {
    if (!db) {
      return new Response(JSON.stringify({ ok: true, d1Bound: false, records: [] }), { headers });
    }

    try {
      const url = new URL(context.request.url);
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);
      const playerName = url.searchParams.get('player');

      let stmt;
      if (playerName) {
        stmt = db.prepare(`
          SELECT * FROM game_records 
          WHERE player_name = ? 
          ORDER BY created_at DESC 
          LIMIT ?
        `).bind(playerName, limit);
      } else {
        stmt = db.prepare(`
          SELECT * FROM game_records 
          ORDER BY created_at DESC 
          LIMIT ?
        `).bind(limit);
      }

      const { results } = await stmt.all();
      return new Response(JSON.stringify({ ok: true, d1Bound: true, records: results || [] }), { headers });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers });
    }
  }

  // POST: Save match record & update player statistics
  if (context.request.method === 'POST') {
    if (!db) {
      return new Response(JSON.stringify({ ok: true, d1Bound: false, saved: false, message: 'D1 not bound' }), { headers });
    }

    try {
      const body = await context.request.json();
      const {
        id,
        playerName,
        mode,
        pointsWon,
        result,
        specialHand,
        frontType,
        midType,
        backType,
        opponentsSummary
      } = body;

      const recordId = id || `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const pName = (playerName || 'Player').trim();
      const pts = typeof pointsWon === 'number' ? pointsWon : 0;
      const isWin = result === 'WIN' || result === 'SPECIAL_WIN' ? 1 : 0;
      const isLoss = result === 'LOSE' ? 1 : 0;
      const isDraw = result === 'DRAW' ? 1 : 0;
      const isSpecial = specialHand ? 1 : 0;

      // 1. Insert record
      await db.prepare(`
        INSERT INTO game_records (
          id, player_name, mode, points_won, result, 
          special_hand, front_type, mid_type, back_type, opponents_summary, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        recordId,
        pName,
        mode || 'vs_ai_2p',
        pts,
        result || 'WIN',
        specialHand || null,
        frontType || 'High Card',
        midType || 'High Card',
        backType || 'High Card',
        opponentsSummary || ''
      ).run();

      // 2. Upsert player summary stats
      await db.prepare(`
        INSERT INTO players (
          id, name, total_games, wins, losses, draws, total_points, special_hands_count, updated_at
        ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          total_games = total_games + 1,
          wins = wins + ?,
          losses = losses + ?,
          draws = draws + ?,
          total_points = total_points + ?,
          special_hands_count = special_hands_count + ?,
          updated_at = datetime('now')
      `).bind(
        pName, pName, isWin, isLoss, isDraw, pts, isSpecial,
        isWin, isLoss, isDraw, pts, isSpecial
      ).run();

      return new Response(JSON.stringify({ ok: true, d1Bound: true, saved: true, recordId }), { headers });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers });
    }
  }

  return new Response('Method not allowed', { status: 405, headers });
}
