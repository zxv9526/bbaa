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

// Helper: Prune zombie seats inactive for > 25000ms (25 seconds) to handle mobile sleep & network jitter gracefully
function pruneZombieSeats(table, activeThresholdMs = 25000) {
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
      table.seats.forEach(s => {
        if (s.name) {
          s.name = s.name.replace(/\(\d+号位\)/g, '').trim();
        }
      });
      table.dealerIndex = table.dealerIndex % table.seats.length;
      table.dealerId = table.seats[table.dealerIndex]?.id || table.seats[0]?.id || "";
    }
    table.lastUpdated = now;
  }
  return removedCount;
}

// Load authoritative table from D1 DB or memory
async function loadAuthoritativeTable(db, roomId, customName) {
  const normRoom = normalizeRoomId(roomId);
  let table = globalTables.get(normRoom);

  if (db) {
    try {
      const row = await db.prepare('SELECT players_json, status FROM rooms WHERE room_code = ?').bind(normRoom).first();
      if (row && row.players_json) {
        const dbSeats = JSON.parse(row.players_json);
        if (Array.isArray(dbSeats)) {
          if (!table) {
            table = getOrCreateMemoryTable(normRoom, customName);
          }
          // Merge seats from D1
          table.seats = dbSeats;
          if (row.status) table.status = row.status;
        }
      }
    } catch {}
  }

  if (!table) {
    table = getOrCreateMemoryTable(normRoom, customName);
  }
  return table;
}

export async function onRequest(context) {
  const env = context.env || {};
  const db = env.DB || env.D1 || env.DATABASE || env.THIRTEEN_WATER_DB;
  const serv00Base = (env.SERV00_SERVER_URL || env.SERV00_CHAT_HTTP_URL || env.SERV00_URL || '').trim().replace(/\/+$/, '');

  const headers = {
    'Content-Type': 'application/json;charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store, no-cache, must-revalidate'
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

  // 🚀 If Serv00 Node Server is configured, proxy table requests to maintain single authoritative state across all edge nodes!
  if (serv00Base) {
    try {
      const targetUrl = `${serv00Base}/api/table/${subAction}${url.search}`;
      let remoteRes;
      if (context.request.method === 'POST') {
        const bodyClone = await context.request.clone().text();
        remoteRes = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyClone,
          signal: AbortSignal.timeout(4000)
        });
      } else {
        remoteRes = await fetch(targetUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(4000)
        });
      }

      if (remoteRes && remoteRes.ok) {
        const data = await remoteRes.json();
        return new Response(JSON.stringify(data), { headers });
      }
    } catch {}
  }

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

    const table = await loadAuthoritativeTable(db, roomId);
    const now = Date.now();

    // Refresh active timestamp for requesting client
    if (playerId || deviceId || tabSessionId) {
      const s = table.seats.find(seat =>
        (playerId && (seat.id === playerId || seat.id.includes(playerId) || playerId.includes(seat.id))) ||
        (tabSessionId && seat.tabSessionId === tabSessionId) ||
        (deviceId && seat.deviceId === deviceId)
      );
      if (s) {
        s.lastActive = now;
      }
    }

    // Always prune stale zombies (>25000ms)
    pruneZombieSeats(table, 25000);

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

      const table = await loadAuthoritativeTable(db, roomId, body.roomName);
      const now = Date.now();

      // 3.1 First prune zombies (> 25000ms)
      pruneZombieSeats(table, 25000);

      // 3.2 Parse target seat index (0..7)
      let requestedSeatIdx = undefined;
      if (typeof body.targetSeatIndex === 'number' && body.targetSeatIndex >= 0 && body.targetSeatIndex <= 7) {
        requestedSeatIdx = Math.floor(body.targetSeatIndex);
      }

      // Check if target seat occupied by someone else
      if (requestedSeatIdx !== undefined) {
        const occupant = table.seats.find(s => s.seatIndex === requestedSeatIdx);
        if (occupant && occupant.id !== player.id && occupant.tabSessionId !== player.tabSessionId) {
          return new Response(JSON.stringify({
            ok: false,
            error: `${requestedSeatIdx + 1}号座位已被其他玩家入座，请选择其他空位！`,
            table
          }), { status: 409, headers });
        }
      }

      // 3.3 Check if player already seated
      const existingIdx = table.seats.findIndex(s =>
        s.id === player.id || (player.tabSessionId && s.tabSessionId === player.tabSessionId)
      );

      let assignedSeatIndex = requestedSeatIdx;
      if (assignedSeatIndex === undefined) {
        if (existingIdx !== -1 && typeof table.seats[existingIdx].seatIndex === 'number') {
          assignedSeatIndex = table.seats[existingIdx].seatIndex;
        } else {
          const occupiedSet = new Set(table.seats.map(s => s.seatIndex));
          for (let i = 0; i < 8; i++) {
            if (!occupiedSet.has(i)) {
              assignedSeatIndex = i;
              break;
            }
          }
          if (assignedSeatIndex === undefined) assignedSeatIndex = 0;
        }
      }

      const cleanName = (player.name || `玩家${assignedSeatIndex + 1}`).replace(/\(\d+号位\)/g, '').trim();

      if (existingIdx !== -1) {
        table.seats[existingIdx].name = cleanName;
        table.seats[existingIdx].avatar = player.avatar || table.seats[existingIdx].avatar;
        table.seats[existingIdx].seatIndex = assignedSeatIndex;
        table.seats[existingIdx].seatNumber = assignedSeatIndex + 1;
        table.seats[existingIdx].lastActive = now;
        table.lastUpdated = now;

        if (db) {
          try {
            await db.prepare(`
              UPDATE rooms SET players_json = ?, updated_at = datetime('now') WHERE room_code = ?
            `).bind(JSON.stringify(table.seats), roomId).run();
          } catch {}
        }

        return new Response(JSON.stringify({ ok: true, table, seatIndex: assignedSeatIndex }), { headers });
      }

      const newSeat = {
        id: String(player.id),
        tabSessionId: player.tabSessionId,
        deviceId: player.deviceId,
        name: cleanName,
        avatar: player.avatar || "😎",
        isAi: false,
        score: 0,
        seatIndex: assignedSeatIndex,
        seatNumber: assignedSeatIndex + 1,
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
        text: `玩家【${newSeat.name}】就座 ${assignedSeatIndex + 1} 号席！`,
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

      return new Response(JSON.stringify({ ok: true, table, seatIndex: assignedSeatIndex }), { headers });
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
      const table = await loadAuthoritativeTable(db, roomId);

      table.seats = table.seats.filter(s => {
        const matchDevice = deviceId && s.deviceId === deviceId;
        const matchPlayer = playerId && (s.id === playerId || s.id.includes(playerId) || playerId.includes(s.id));
        const matchTab = tabSessionId && s.tabSessionId === tabSessionId;
        return !(matchDevice || matchPlayer || matchTab);
      });

      if (table.seats.length === 0) {
        table.status = "waiting";
        table.dealerIndex = 0;
        table.dealerId = "";
        table.shuffleCount = 0;
        table.cutCard = null;
        table.dealtHands = undefined;
      } else {
        table.seats.forEach(s => {
          if (s.name) {
            s.name = s.name.replace(/\(\d+号位\)/g, '').trim();
          }
        });
        table.dealerIndex = table.dealerIndex % table.seats.length;
        table.dealerId = table.seats[table.dealerIndex]?.id || table.seats[0].id;
      }
      table.lastUpdated = Date.now();

      if (db) {
        try {
          await db.prepare(`
            UPDATE rooms SET players_json = ?, status = ?, updated_at = datetime('now') WHERE room_code = ?
          `).bind(JSON.stringify(table.seats), table.status, roomId).run();
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
        pruneZombieSeats(table, 25000);
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
          table.dealerIndex = typeof action.dealerIndex === 'number' ? action.dealerIndex : table.dealerIndex;
          table.status = 'arranging';
        } else if (action.type === 'CLAIM_DEALER') {
          const newIdx = table.seats.findIndex(s => s.id === action.playerId);
          if (newIdx !== -1) {
            table.dealerIndex = newIdx;
            table.dealerId = action.playerId;
          }
        } else if (action.type === 'ROTATE_DEALER') {
          if (table.seats.length > 0) {
            table.dealerIndex = (table.dealerIndex + 1) % table.seats.length;
            table.dealerId = table.seats[table.dealerIndex]?.id || '';
          }
        } else if (action.type === 'NEXT_ROUND') {
          table.round = (table.round || 1) + 1;
          if (table.seats.length > 0) {
            table.dealerIndex = (table.dealerIndex + 1) % table.seats.length;
            table.dealerId = table.seats[table.dealerIndex]?.id || '';
          }
          table.shuffleCount = 0;
          table.cutCard = null;
          table.dealtHands = undefined;
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
