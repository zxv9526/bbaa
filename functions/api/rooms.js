// Cloudflare Pages Function: /api/rooms
// Multi-player Room lifecycle (Create, Join, Ready/Deal, Submit cards, Settle)

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

  // GET ?code=XXXXXX
  if (context.request.method === 'GET') {
    const url = new URL(context.request.url);
    const roomCode = url.searchParams.get('code');

    if (!roomCode) {
      return new Response(JSON.stringify({ ok: false, message: 'Missing room code' }), { status: 400, headers });
    }

    if (!db) {
      return new Response(JSON.stringify({ ok: true, d1Bound: false, message: 'D1 not bound' }), { headers });
    }

    try {
      const room = await db.prepare("SELECT * FROM rooms WHERE room_code = ?").bind(roomCode.toUpperCase()).first();
      if (!room) {
        return new Response(JSON.stringify({ ok: false, message: 'Room not found' }), { status: 404, headers });
      }

      return new Response(
        JSON.stringify({
          ok: true,
          d1Bound: true,
          room: {
            roomCode: room.room_code,
            hostName: room.host_name,
            maxPlayers: room.max_players,
            status: room.status,
            players: JSON.parse(room.players_json || '[]'),
            deckSeed: room.deck_seed,
            createdAt: room.created_at,
            updatedAt: room.updated_at
          }
        }),
        { headers }
      );
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers });
    }
  }

  // POST: Room mutations
  if (context.request.method === 'POST') {
    if (!db) {
      return new Response(JSON.stringify({ ok: true, d1Bound: false, message: 'D1 not bound' }), { headers });
    }

    try {
      const body = await context.request.json();
      const { action, roomCode, playerId, playerName, avatar, maxPlayers, arrangement, cards } = body;

      // 1. CREATE ROOM
      if (action === 'create') {
        const code = (roomCode || Math.floor(100000 + Math.random() * 900000).toString()).toUpperCase();
        const host = playerName || 'Host';
        const initialPlayers = [
          {
            id: playerId || `p_${Date.now()}`,
            name: host,
            avatar: avatar || '🀄',
            isReady: true,
            hasSubmitted: false
          }
        ];

        await db.prepare(`
          INSERT INTO rooms (room_code, host_name, max_players, status, players_json, created_at, updated_at)
          VALUES (?, ?, ?, 'waiting', ?, datetime('now'), datetime('now'))
          ON CONFLICT(room_code) DO UPDATE SET
            host_name = ?, max_players = ?, status = 'waiting', players_json = ?, updated_at = datetime('now')
        `).bind(
          code, host, maxPlayers || 4, JSON.stringify(initialPlayers),
          host, maxPlayers || 4, JSON.stringify(initialPlayers)
        ).run();

        return new Response(JSON.stringify({ ok: true, roomCode: code }), { headers });
      }

      // 2. JOIN ROOM
      if (action === 'join') {
        const code = (roomCode || '').toUpperCase();
        const room = await db.prepare("SELECT * FROM rooms WHERE room_code = ?").bind(code).first();
        if (!room) {
          return new Response(JSON.stringify({ ok: false, message: 'Room not found' }), { status: 404, headers });
        }

        const players = JSON.parse(room.players_json || '[]');
        const existingIdx = players.findIndex(p => p.id === playerId || p.name === playerName);

        if (existingIdx === -1) {
          if (players.length >= room.max_players) {
            return new Response(JSON.stringify({ ok: false, message: 'Room is full' }), { status: 400, headers });
          }
          players.push({
            id: playerId || `p_${Date.now()}`,
            name: playerName || `Player ${players.length + 1}`,
            avatar: avatar || '🎲',
            isReady: false,
            hasSubmitted: false
          });
        }

        await db.prepare("UPDATE rooms SET players_json = ?, updated_at = datetime('now') WHERE room_code = ?")
          .bind(JSON.stringify(players), code).run();

        return new Response(JSON.stringify({ ok: true, roomCode: code, players }), { headers });
      }

      // 3. START GAME / DEAL
      if (action === 'start') {
        const code = (roomCode || '').toUpperCase();
        const room = await db.prepare("SELECT * FROM rooms WHERE room_code = ?").bind(code).first();
        if (!room) return new Response(JSON.stringify({ ok: false, message: 'Room not found' }), { status: 404, headers });

        let players = JSON.parse(room.players_json || '[]');
        // Reset submitted status
        players = players.map(p => ({ ...p, hasSubmitted: false, arrangement: null }));

        await db.prepare("UPDATE rooms SET status = 'arranging', players_json = ?, updated_at = datetime('now') WHERE room_code = ?")
          .bind(JSON.stringify(players), code).run();

        return new Response(JSON.stringify({ ok: true }), { headers });
      }

      // 4. SUBMIT ARRANGEMENT
      if (action === 'submit') {
        const code = (roomCode || '').toUpperCase();
        const room = await db.prepare("SELECT * FROM rooms WHERE room_code = ?").bind(code).first();
        if (!room) return new Response(JSON.stringify({ ok: false, message: 'Room not found' }), { status: 404, headers });

        let players = JSON.parse(room.players_json || '[]');
        const pIdx = players.findIndex(p => p.id === playerId);
        if (pIdx !== -1) {
          players[pIdx].hasSubmitted = true;
          players[pIdx].arrangement = arrangement;
          if (cards) players[pIdx].cards = cards;
        }

        // Check if all players submitted
        const allSubmitted = players.length > 1 && players.every(p => p.hasSubmitted);
        const newStatus = allSubmitted ? 'revealing' : room.status;

        await db.prepare("UPDATE rooms SET status = ?, players_json = ?, updated_at = datetime('now') WHERE room_code = ?")
          .bind(newStatus, JSON.stringify(players), code).run();

        return new Response(JSON.stringify({ ok: true, allSubmitted }), { headers });
      }

      return new Response(JSON.stringify({ ok: false, message: 'Unknown action' }), { status: 400, headers });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers });
    }
  }

  return new Response('Method not allowed', { status: 405, headers });
}
