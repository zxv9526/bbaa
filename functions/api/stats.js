// Cloudflare Pages Function: /api/stats
// Retrieves global leaderboard and aggregated gameplay statistics from D1

export async function onRequest(context) {
  const env = context.env || {};
  const db = env.DB || env.D1 || env.DATABASE || env.THIRTEEN_WATER_DB;

  const headers = {
    'Content-Type': 'application/json;charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  if (!db) {
    return new Response(JSON.stringify({ ok: true, d1Bound: false, leaderboard: [], stats: {} }), { headers });
  }

  try {
    // 1. Top players by total points
    const topPlayersQuery = await db.prepare(`
      SELECT id, name, total_games, wins, losses, draws, total_points, special_hands_count
      FROM players
      ORDER BY total_points DESC, wins DESC
      LIMIT 25
    `).all();

    // 2. Global game count & total points dealt
    const globalStats = await db.prepare(`
      SELECT 
        COUNT(*) as total_matches,
        SUM(CASE WHEN result = 'SPECIAL_WIN' THEN 1 ELSE 0 END) as total_special_hands
      FROM game_records
    `).first();

    return new Response(
      JSON.stringify({
        ok: true,
        d1Bound: true,
        leaderboard: topPlayersQuery?.results || [],
        global: {
          totalMatches: globalStats?.total_matches || 0,
          totalSpecialHands: globalStats?.total_special_hands || 0
        }
      }),
      { headers }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers });
  }
}
