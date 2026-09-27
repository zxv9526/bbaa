// Cloudflare Pages Function: /api/table/[[path]]
// Serverless Authoritative Table Manager with Instant Zombie Eviction

const globalTables = new Map();

function normalizeRoomId(rawRoomId) {
  if (!rawRoomId) return "666666";
  const clean = String(rawRoomId).trim().replace(/^realtime_room_/, "");
  if (clean === "8888" || clean === "888888") return "666666";
  return clean || "666666";
}

function getOrCreateMemoryTable(rawRoomId, customName) {
  const roomId = normalizeRoomId(rawRoomId);
  let table = globalTables.get(roomId);
  if (!table) {
    table = {
      tableId: "tbl_" + roomId + "_" + Date.now().toString(36),
      roomId,
      roomName: customName || (roomId === "666666" ? "十三水巅峰大厅 666666" : `专属房间 ${roomId}`),
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

// Helper: Prune zombie seats inactive for > 2500ms
function pruneZombieSeats(table, activeThresholdMs = 2500) {
  if (!table || !Array.isArray(table.seats)) return 0;
  const now = Date.now();
  const beforeCount = table.seats.length;

  table.seats = table.seats.filter(s => {
    if (!s || s.isAi) return false;
    const lastActive = s.lastActive || 0;
    return (now - lastActive) < activeThresholdMs;
  });

  const removedCount = beforeCount - table.seats.length;
  if (removedCount > 0) {
    if (table.seats.length === 0) {
      table.status = "waiting";
      table.dealerIndex = 0;
      table.dealerId = "";
      table.shuffleCount = 0;
      table.cutCard = null;
      table.dealtHands = undefined;
    } else {
      table.seats.forEach((s, i) => {
        if (s.name) {
          s.name = s.name.replace(/\(\d+号位\)/g, '').trim() + ` (${i + 1}号位)`;
        }
      });
      table.dealerIndex = table.dealerIndex % table.seats.length;
      table.dealerId = table.seats[table.dealerIndex]?.id || table.seats[0].id;
    }
    table.lastUpdated = now;
  }
  return removedCount;
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

  // Auto delete 8888 & 888888
  globalTables.delete("888888");
  globalTables.delete("8888");

  const url = new URL(context.request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const subAction = pathParts[pathParts.length - 1] || 'state';

  // 1. GET /api/table/rooms
  if (subAction === 'rooms' && context.request.method === 'GET') {
    const mainTable = getOrCreateMemoryTable("666666");
    pruneZombieSeats(mainTable);

    const rooms = Array.from(globalTables.values()).map(t => {
      pruneZombieSeats(t);
      return {
        roomId: t.roomId,
        roomName: t.roomName,
        playerCount: t.seats.length,
        maxPlayers: 8,
        round: t.round,
        status: t.status,
        dealerName: t.seats[t.dealerIndex]?.name || "待入座",
        lastUpdated: t.lastUpdated
      };
    });
    return new Response(JSON.stringify({ ok: true, rooms }), { headers });
  }

  // 2. GET /api/table/state
  if ((subAction === 'state' || subAction === 'table') && context.request.method === 'GET') {
    const rawRoom = url.searchParams.get('roomId') || '666666';
    const roomId = normalizeRoomId(rawRoom);
    const playerId = url.searchParams.get('playerId');
    const deviceId = url.searchParams.get('deviceId');
    const tabSessionId = url.searchParams.get('tabSessionId');

    const table = getOrCreateMemoryTable(roomId);
    const now = Date.now();

    // Refresh active timestamp for requesting client
    if (playerId || deviceId || tabSessionId) {
      const s = table.seats.find(seat =>
        (playerId && seat.id === playerId) ||
        (tabSessionId && seat.tabSessionId === tabSessionId) ||
        (deviceId && seat.deviceId === deviceId)
      );
      if (s) {
        s.lastActive = now;
      }
    }

    // Always prune stale zombies (<2.5s)
    pruneZombieSeats(table, 2500);

    // Sync state with D1 database if bound
    if (db) {
      try {
        await db.prepare(`
          INSERT INTO rooms (room_code, host_name, max_players, status, players_json, created_at, updated_at)
          VALUES (?, ?, 8, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(room_code) DO UPDATE SET
            players_json = ?, status = ?, updated_at = datetime('now')
        `).bind(
          roomId, table.seats[0]?.name || 'Host', table.status, JSON.stringify(table.seats),
          JSON.stringify(table.seats), table.status
        ).run();
      } catch {}
    }

    return new Response(JSON.stringify({ ok: true, table }), { headers });
  }

  // 3. POST /api/table/join
  if (subAction === 'join' && context.request.method === 'POST') {
    try {
      const body = await context.request.json();
      const roomId = normalizeRoomId(body.roomId || '666666');
      const player = body.player;

      if (!player || !player.id) {
        return new Response(JSON.stringify({ ok: false, error: "Missing player payload" }), { status: 400, headers });
      }

      const table = getOrCreateMemoryTable(roomId, body.roomName);
      const now = Date.now();

      // 3.1 First prune zombies (< 2.5s)
      pruneZombieSeats(table, 2500);

      // 3.2 Check if player already seated
      const existingIdx = table.seats.findIndex(s =>
        s.id === player.id || (player.tabSessionId && s.tabSessionId === player.tabSessionId)
      );

      if (existingIdx !== -1) {
        table.seats[existingIdx].name = player.name || table.seats[existingIdx].name;
        table.seats[existingIdx].avatar = player.avatar || table.seats[existingIdx].avatar;
        table.seats[existingIdx].lastActive = now;
        table.lastUpdated = now;
        return new Response(JSON.stringify({ ok: true, table, seatIndex: existingIdx }), { headers });
      }

      // 3.3 If table is full (8/8), force evict the oldest inactive seat to make space for real active player
      if (table.seats.length >= 8) {
        table.seats.sort((a, b) => (a.lastActive || 0) - (b.lastActive || 0));
        table.seats.shift(); // Evict the least active player
      }

      const seatIndex = table.seats.length;
      let finalName = player.name || `玩家${seatIndex + 1}`;
      if (!finalName.includes('号位')) {
        finalName = `${finalName} (${seatIndex + 1}号位)`;
      }

      const newSeat = {
        id: String(player.id),
        tabSessionId: player.tabSessionId,
        deviceId: player.deviceId,
        name: finalName,
        avatar: player.avatar || "😎",
        isAi: false,
        score: 0,
        lastActive: now
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
        timestamp: now
      };
      table.lastUpdated = now;

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

  // 4. POST /api/table/leave
  if (subAction === 'leave' && context.request.method === 'POST') {
    try {
      const body = await context.request.json();
      const roomId = normalizeRoomId(body.roomId || '666666');
      const playerId = String(body.playerId || '');
      const tabSessionId = String(body.tabSessionId || '');
      const deviceId = String(body.deviceId || '');
      const table = getOrCreateMemoryTable(roomId);

      table.seats = table.seats.filter(s => {
        const matchDevice = deviceId && s.deviceId === deviceId;
        const matchPlayer = playerId && s.id === playerId;
        const matchTab = tabSessionId && s.tabSessionId === tabSessionId;
        return !(matchDevice || matchPlayer || matchTab);
      });

      if (table.seats.length === 0) {
        table.status = "waiting";
        table.dealerIndex = 0;
        table.dealerId = "";
      } else {
        table.seats.forEach((s, i) => {
          if (s.name) {
            s.name = s.name.replace(/\(\d+号位\)/g, '').trim() + ` (${i + 1}号位)`;
          }
        });
        table.dealerIndex = table.dealerIndex % table.seats.length;
        table.dealerId = table.seats[table.dealerIndex]?.id || table.seats[0].id;
      }
      table.lastUpdated = Date.now();

      if (db) {
        try {
          await db.prepare(`
            UPDATE rooms SET players_json = ?, updated_at = datetime('now') WHERE room_code = ?
          `).bind(JSON.stringify(table.seats), roomId).run();
        } catch {}
      }

      return new Response(JSON.stringify({ ok: true, table }), { headers });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers });
    }
  }

  // 5. POST /api/table/clean_stale & /api/table/reset
  if ((subAction === 'clean_stale' || subAction === 'reset') && context.request.method === 'POST') {
    try {
      const body = await context.request.json();
      const roomId = normalizeRoomId(body.roomId || '666666');
      const table = getOrCreateMemoryTable(roomId);

      if (subAction === 'reset') {
        table.seats = [];
        table.status = "waiting";
        table.dealerIndex = 0;
        table.dealerId = "";
        table.shuffleCount = 0;
        table.cutCard = null;
        table.dealtHands = undefined;
      } else {
        pruneZombieSeats(table, 2500);
      }

      table.lastUpdated = Date.now();

      if (db) {
        try {
          await db.prepare(`
            UPDATE rooms SET players_json = ?, updated_at = datetime('now') WHERE room_code = ?
          `).bind(JSON.stringify(table.seats), roomId).run();
        } catch {}
      }

      return new Response(JSON.stringify({ ok: true, table }), { headers });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers });
    }
  }

  // 6. POST /api/table/action
  if (subAction === 'action' && context.request.method === 'POST') {
    try {
      const body = await context.request.json();
      const roomId = normalizeRoomId(body.roomId || '666666');
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
