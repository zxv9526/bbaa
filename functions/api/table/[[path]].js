// Cloudflare Pages Function: /api/table/[[path]]
// Supports /api/table/join, /api/table/state, /api/table/rooms, /api/table/action, /api/table/leave

// In-memory global fallback table storage for Cloudflare Workers
const globalTables = new Map();

function getOrCreateMemoryTable(rawRoomId, customName) {
  const roomId = String(rawRoomId || "888888").trim().replace(/^realtime_room_/, "") || "888888";
  let table = globalTables.get(roomId);
  if (!table) {
    table = {
      tableId: "tbl_" + roomId + "_" + Date.now().toString(36),
      roomId,
      roomName: customName || (roomId === "888888" ? "竞技大厅 888888" : `专属房间 ${roomId}`),
      round: 1,
      dealerIndex: 0,
      dealerId: "",
      status: "waiting",
      seats: [],
      shuffleCount: 0,
      cutSliderPos: 50,
      cutCard: null,
      lastUpdated: Date.now()
    };
    globalTables.set(roomId, table);
  }
  return table;
}

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

  const url = new URL(context.request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const subAction = pathParts[pathParts.length - 1] || 'state';

  // GET /api/table/rooms
  if (subAction === 'rooms' && context.request.method === 'GET') {
    getOrCreateMemoryTable("888888");
    const rooms = Array.from(globalTables.values()).map(t => ({
      roomId: t.roomId,
      roomName: t.roomName,
      playerCount: t.seats.length,
      maxPlayers: 8,
      round: t.round,
      status: t.status,
      dealerName: t.seats[t.dealerIndex]?.name || "待入座",
      lastUpdated: t.lastUpdated
    }));
    return new Response(JSON.stringify({ ok: true, rooms }), { headers });
  }

  // GET /api/table/state?roomId=...
  if ((subAction === 'state' || subAction === 'table') && context.request.method === 'GET') {
    const rawRoom = url.searchParams.get('roomId') || '888888';
    const roomId = rawRoom.replace(/^realtime_room_/, '') || '888888';

    // If D1 is available, try reading from rooms table
    if (db) {
      try {
        const row = await db.prepare("SELECT * FROM rooms WHERE room_code = ?").bind(roomId).first();
        if (row && row.players_json) {
          const seats = JSON.parse(row.players_json || '[]');
          const table = {
            tableId: "tbl_" + roomId,
            roomId,
            roomName: row.host_name ? `房间 ${roomId}` : "竞技大厅 888888",
            round: 1,
            dealerIndex: 0,
            dealerId: seats[0]?.id || "",
            status: row.status || "waiting",
            seats,
            shuffleCount: 0,
            cutSliderPos: 50,
            cutCard: null,
            lastUpdated: Date.now()
          };
          globalTables.set(roomId, table);
          return new Response(JSON.stringify({ ok: true, table }), { headers });
        }
      } catch {}
    }

    const table = getOrCreateMemoryTable(roomId);
    return new Response(JSON.stringify({ ok: true, table }), { headers });
  }

  // POST /api/table/join
  if (subAction === 'join' && context.request.method === 'POST') {
    try {
      const body = await context.request.json();
      const rawRoom = body.roomId || '888888';
      const roomId = String(rawRoom).trim().replace(/^realtime_room_/, "") || '888888';
      const player = body.player;

      if (!player || !player.id) {
        return new Response(JSON.stringify({ ok: false, error: "Missing player payload" }), { status: 400, headers });
      }

      const table = getOrCreateMemoryTable(roomId, body.roomName);

      // Check if already seated
      const existingIdx = table.seats.findIndex(
        s => s.id === player.id || (player.tabSessionId && s.tabSessionId === player.tabSessionId)
      );

      if (existingIdx !== -1) {
        table.seats[existingIdx].name = player.name || table.seats[existingIdx].name;
        table.seats[existingIdx].avatar = player.avatar || table.seats[existingIdx].avatar;
        table.seats[existingIdx].lastActive = Date.now();
        table.lastUpdated = Date.now();
        return new Response(JSON.stringify({ ok: true, table, seatIndex: existingIdx }), { headers });
      }

      if (table.seats.length >= 8) {
        return new Response(JSON.stringify({ ok: false, error: "牌桌已满员 (8/8)", table, isFull: true }), { headers });
      }

      const seatIndex = table.seats.length;
      let finalName = player.name || `玩家${seatIndex + 1}`;
      if (!finalName.includes('号位')) {
        finalName = `${finalName} (${seatIndex + 1}号位)`;
      }

      const newSeat = {
        id: String(player.id),
        tabSessionId: player.tabSessionId,
        name: finalName,
        avatar: player.avatar || "😎",
        isAi: false,
        score: 0,
        lastActive: Date.now()
      };

      table.seats.push(newSeat);

      if (table.seats.length === 1) {
        table.dealerIndex = 0;
        table.dealerId = newSeat.id;
      }

      table.lastAction = {
        type: "join",
        playerId: newSeat.id,
        text: `玩家【${newSeat.name}】入座第 ${seatIndex + 1} 席！`,
        timestamp: Date.now()
      };
      table.lastUpdated = Date.now();

      // Persist to D1 if available
      if (db) {
        try {
          await db.prepare(`
            INSERT INTO rooms (room_code, host_name, max_players, status, players_json, created_at, updated_at)
            VALUES (?, ?, 8, 'waiting', ?, datetime('now'), datetime('now'))
            ON CONFLICT(room_code) DO UPDATE SET
              players_json = ?, updated_at = datetime('now')
          `).bind(
            roomId, table.seats[0]?.name || 'Host', JSON.stringify(table.seats),
            JSON.stringify(table.seats)
          ).run();
        } catch {}
      }

      return new Response(JSON.stringify({ ok: true, table, seatIndex }), { headers });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers });
    }
  }

  // POST /api/table/leave
  if (subAction === 'leave' && context.request.method === 'POST') {
    try {
      const body = await context.request.json();
      const roomId = String(body.roomId || '888888').trim().replace(/^realtime_room_/, "") || '888888';
      const playerId = String(body.playerId || '');
      const table = getOrCreateMemoryTable(roomId);

      const idx = table.seats.findIndex(s => s.id === playerId || s.tabSessionId === playerId);
      if (idx !== -1) {
        table.seats.splice(idx, 1);
        if (table.seats.length === 0) {
          table.status = "waiting";
          table.dealerIndex = 0;
          table.dealerId = "";
        } else if (table.dealerIndex >= table.seats.length) {
          table.dealerIndex = 0;
          table.dealerId = table.seats[0]?.id || "";
        }
        table.lastUpdated = Date.now();
      }

      return new Response(JSON.stringify({ ok: true, table }), { headers });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers });
    }
  }

  // POST /api/table/action
  if (subAction === 'action' && context.request.method === 'POST') {
    try {
      const body = await context.request.json();
      const roomId = String(body.roomId || '888888').trim().replace(/^realtime_room_/, "") || '888888';
      const action = body.action;
      const table = getOrCreateMemoryTable(roomId);

      if (action) {
        if (action.type === 'DEALER_SHUFFLE') {
          table.shuffleCount = Number(action.shuffleCount || 0);
          table.status = 'shuffling';
        } else if (action.type === 'DEALER_CUT') {
          table.cutSliderPos = Number(action.cutSliderPos || 50);
          table.cutCard = action.cutCard || null;
          table.status = 'cutting';
        } else if (action.type === 'DEALER_DEAL') {
          table.dealtHands = action.dealtHands;
          table.status = 'arranging';
        } else if (action.type === 'NEXT_ROUND') {
          table.round = (table.round || 1) + 1;
          table.status = 'waiting';
        }
        table.lastUpdated = Date.now();
      }

      return new Response(JSON.stringify({ ok: true, table }), { headers });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers });
    }
  }

  return new Response(JSON.stringify({ ok: true }), { headers });
}
