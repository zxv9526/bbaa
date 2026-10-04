/**
 * Triple Voice & Realtime Table Server (Serv00 Dedicated Edition)
 * Optimized for deployment on Serv00 Free BSD / Linux Hosting.
 * Supports WebSocket (/api/ws), REST Chat API, Table State Sync, WebRTC Signaling & Voice Relays.
 */

const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const cors = require('cors');

// Port configuration: accepts PORT environment variable, --port <PORT>, or positional arg <PORT>
let port = parseInt(process.env.PORT || '', 10) || 3000;
const portArgIdx = process.argv.indexOf('--port');
if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
  port = parseInt(process.argv[portArgIdx + 1], 10);
} else if (process.argv[2] && /^\d+$/.test(process.argv[2])) {
  port = parseInt(process.argv[2], 10);
}

const app = express();
const server = http.createServer(app);

// Enable CORS for Cloudflare Pages and all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parser with 35MB limit for high-quality voice audio clips
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: true, limit: '35mb' }));

// In-Memory Data Storage
const chatStore = new Map(); // roomId -> Array of ChatMessage
const roomPeersMap = new Map(); // roomId -> Set of peer info { userId, name, avatar, seatIndex, ws }
const tablesMap = new Map(); // roomId -> RealtimeTableState
const voiceFramesStore = new Map(); // roomId -> Array of VoiceFrame
const signalsStore = new Map(); // roomId -> Array of WebRtcSignal

function normalizeRoomId(id) {
  if (!id) return '666666';
  return String(id).trim().toUpperCase();
}

function getOrCreateRoomChat(roomId) {
  const normId = normalizeRoomId(roomId);
  if (!chatStore.has(normId)) {
    chatStore.set(normId, []);
  }
  return chatStore.get(normId);
}

function getOrCreateTable(roomId, roomName) {
  const normId = normalizeRoomId(roomId);
  if (!tablesMap.has(normId)) {
    tablesMap.set(normId, {
      tableId: `table_${normId}`,
      roomId: normId,
      roomName: roomName || (normId === '666666' ? '十三水巅峰大厅' : `房间 ${normId}`),
      round: 1,
      dealerIndex: 0,
      dealerId: '',
      status: 'waiting',
      seats: [],
      shuffleCount: 0,
      cutSliderPos: 50,
      cutCard: null,
      lastUpdated: Date.now()
    });
  }
  return tablesMap.get(normId);
}

function broadcastToRoom(roomId, messageObj, excludeWs = null) {
  const normId = normalizeRoomId(roomId);
  const peers = roomPeersMap.get(normId);
  if (!peers) return;

  const rawJson = JSON.stringify(messageObj);
  peers.forEach(client => {
    if (client.ws && client.ws.readyState === WebSocket.OPEN && client.ws !== excludeWs) {
      try {
        client.ws.send(rawJson);
      } catch (err) {
        console.warn(`[Broadcast error] ${client.userId}:`, err.message);
      }
    }
  });
}

// -------------------------------------------------------------
// REST API Endpoints (For HTTP Polling & Cloudflare Pages Integration)
// -------------------------------------------------------------

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'triple-voice-serv00-server',
    version: '1.2.0',
    uptime: process.uptime(),
    activeRooms: tablesMap.size,
    connectedPeers: Array.from(roomPeersMap.values()).reduce((acc, set) => acc + set.size, 0),
    timestamp: Date.now()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Root friendly welcome page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Triple Voice & Chat Node (Serv00)</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; text-align: center; }
          .card { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          .status { display: inline-block; padding: 6px 14px; border-radius: 9999px; background: #10b981; color: #064e3b; font-weight: bold; margin-bottom: 20px; }
          h1 { color: #38bdf8; margin-top: 0; font-size: 24px; }
          p { color: #94a3b8; line-height: 1.6; }
          code { background: #090d16; color: #fbbf24; padding: 3px 8px; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="status">🟢 Serv00 专属实时节点在线 (Online)</div>
          <h1>十三水 · 实时战术对讲与牌桌服务</h1>
          <p>此节点为 <strong>Cloudflare Pages</strong> 提供实时 WebSocket 全双工对讲、牌桌状态同步与战术通信中继。</p>
          <p>WebSocket 连接地址: <code>/api/ws</code> 或 <code>/ws</code></p>
          <p>当前活跃房间: <strong>${tablesMap.size}</strong> | 在线对讲连接: <strong>${Array.from(roomPeersMap.values()).reduce((acc, set) => acc + set.size, 0)}</strong></p>
        </div>
      </body>
    </html>
  `);
});

// -------------------------------------------------------------
// Real-time Table State Management Endpoints
// -------------------------------------------------------------

// 1. List active rooms
app.get('/api/table/rooms', (req, res) => {
  getOrCreateTable('666666', '十三水巅峰大厅');
  const rooms = Array.from(tablesMap.values()).map(t => ({
    roomId: t.roomId,
    roomName: t.roomName,
    playerCount: t.seats.length,
    maxPlayers: 8,
    round: t.round,
    status: t.status,
    dealerName: t.seats[t.dealerIndex]?.name || '待入座',
    lastUpdated: t.lastUpdated
  }));
  res.json({ ok: true, rooms });
});

// 2. Get table state
app.get('/api/table/state', (req, res) => {
  const roomId = normalizeRoomId(req.query.roomId || '666666');
  const playerId = req.query.playerId ? String(req.query.playerId).trim() : null;
  const deviceId = req.query.deviceId ? String(req.query.deviceId).trim() : null;
  const tabSessionId = req.query.tabSessionId ? String(req.query.tabSessionId).trim() : null;
  const table = getOrCreateTable(roomId);

  const now = Date.now();
  if (playerId || deviceId || tabSessionId) {
    const s = table.seats.find(s =>
      (playerId && (s.id === playerId || s.id.includes(playerId) || playerId.includes(s.id))) ||
      (tabSessionId && s.tabSessionId === tabSessionId) ||
      (deviceId && s.deviceId === deviceId)
    );
    if (s) {
      s.lastActive = now;
    }
  }

  // Prune seats inactive for > 25s
  const beforeLen = table.seats.length;
  table.seats = table.seats.filter(s => now - (s.lastActive || 0) < 25000);
  if (table.seats.length !== beforeLen) {
    table.lastUpdated = now;
    if (table.seats.length === 0) {
      table.status = 'waiting';
      table.dealerIndex = 0;
      table.dealerId = '';
      table.shuffleCount = 0;
      table.cutCard = null;
      table.dealtHands = undefined;
    } else {
      table.dealerIndex = table.dealerIndex % table.seats.length;
      table.dealerId = table.seats[table.dealerIndex]?.id || table.seats[0].id;
    }
    broadcastToRoom(roomId, { type: 'TABLE_SYNC', table });
  }

  res.json({ ok: true, table });
});

// 3. Join Table
app.post('/api/table/join', (req, res) => {
  try {
    const roomId = normalizeRoomId(req.body.roomId || '666666');
    const player = req.body.player;
    if (!player || !player.id) {
      return res.status(400).json({ ok: false, error: 'Missing player payload' });
    }

    const table = getOrCreateTable(roomId, req.body.roomName);
    const now = Date.now();

    // Auto prune stale seats (> 25s)
    table.seats = table.seats.filter(s => (now - (s.lastActive || 0)) < 25000);

    let requestedSeatIdx = undefined;
    if (typeof req.body.targetSeatIndex === 'number' && req.body.targetSeatIndex >= 0 && req.body.targetSeatIndex <= 7) {
      requestedSeatIdx = Math.floor(req.body.targetSeatIndex);
    }

    if (requestedSeatIdx !== undefined) {
      const occupant = table.seats.find(s => s.seatIndex === requestedSeatIdx);
      if (occupant && occupant.id !== player.id && occupant.tabSessionId !== player.tabSessionId) {
        return res.status(409).json({ ok: false, error: `${requestedSeatIdx + 1}号座位已被其他玩家入座！`, table });
      }
    }

    const existingIndex = table.seats.findIndex(s =>
      s.id === player.id || (player.tabSessionId && s.tabSessionId === player.tabSessionId)
    );

    let assignedSeatIndex = requestedSeatIdx;
    if (assignedSeatIndex === undefined) {
      if (existingIndex !== -1 && typeof table.seats[existingIndex].seatIndex === 'number') {
        assignedSeatIndex = table.seats[existingIndex].seatIndex;
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

    let finalName = (player.name || `玩家${assignedSeatIndex + 1}`).replace(/\(\d+号位\)/g, '').trim();

    if (existingIndex !== -1) {
      table.seats[existingIndex].id = String(player.id);
      table.seats[existingIndex].deviceId = player.deviceId || table.seats[existingIndex].deviceId;
      table.seats[existingIndex].tabSessionId = player.tabSessionId || table.seats[existingIndex].tabSessionId;
      table.seats[existingIndex].name = finalName;
      table.seats[existingIndex].avatar = player.avatar || table.seats[existingIndex].avatar;
      table.seats[existingIndex].seatIndex = assignedSeatIndex;
      table.seats[existingIndex].seatNumber = assignedSeatIndex + 1;
      table.seats[existingIndex].lastActive = now;

      table.seats = table.seats.filter((s, idx) => {
        if (idx === existingIndex) return true;
        return s.id !== player.id && (!player.tabSessionId || s.tabSessionId !== player.tabSessionId);
      });

      table.dealerIndex = table.dealerIndex % Math.max(1, table.seats.length);
      table.dealerId = table.seats[table.dealerIndex]?.id || table.seats[0]?.id || '';
      table.lastUpdated = now;

      broadcastToRoom(roomId, { type: 'TABLE_SYNC', table });
      return res.json({ ok: true, table, seatIndex: assignedSeatIndex });
    }

    if (table.seats.length >= 8) {
      return res.json({ ok: false, error: '牌桌已满 (最多8人)', table, isFull: true });
    }

    const newSeat = {
      id: String(player.id),
      deviceId: player.deviceId,
      tabSessionId: player.tabSessionId,
      name: finalName,
      avatar: player.avatar || '🎮',
      isAi: false,
      score: 0,
      seatIndex: assignedSeatIndex,
      seatNumber: assignedSeatIndex + 1,
      lastActive: now
    };

    table.seats.push(newSeat);
    table.seats.sort((a, b) => (a.seatIndex ?? 0) - (b.seatIndex ?? 0));

    if (table.seats.length === 1) {
      table.dealerIndex = 0;
      table.dealerId = newSeat.id;
    } else {
      table.dealerIndex = table.dealerIndex % table.seats.length;
      table.dealerId = table.seats[table.dealerIndex]?.id || table.seats[0].id;
    }

    table.lastAction = {
      type: 'join',
      playerId: newSeat.id,
      text: `玩家【${newSeat.name}】就座 ${assignedSeatIndex + 1} 号席！`,
      timestamp: now
    };
    table.lastUpdated = now;

    broadcastToRoom(roomId, { type: 'TABLE_SYNC', table });
    res.json({ ok: true, table, seatIndex: assignedSeatIndex });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. Leave Table
app.post('/api/table/leave', (req, res) => {
  try {
    const roomId = normalizeRoomId(req.body.roomId || '666666');
    const playerId = String(req.body.playerId || '').trim();
    const deviceId = String(req.body.deviceId || '').trim();
    const tabSessionId = String(req.body.tabSessionId || '').trim();
    const table = getOrCreateTable(roomId);

    const initialCount = table.seats.length;
    const removedSeats = [];

    table.seats = table.seats.filter(s => {
      const matchDevice = deviceId && s.deviceId === deviceId;
      const matchPlayer = playerId && (s.id === playerId || s.id.includes(playerId) || playerId.includes(s.id));
      const matchTab = tabSessionId && s.tabSessionId === tabSessionId;
      const shouldRemove = matchDevice || matchPlayer || matchTab;
      if (shouldRemove) removedSeats.push(s);
      return !shouldRemove;
    });

    if (removedSeats.length > 0 || table.seats.length !== initialCount) {
      if (table.seats.length === 0) {
        table.status = 'waiting';
        table.dealerIndex = 0;
        table.dealerId = '';
        table.shuffleCount = 0;
        table.cutCard = null;
        table.dealtHands = undefined;
      } else {
        table.dealerIndex = table.dealerIndex % table.seats.length;
        table.dealerId = table.seats[table.dealerIndex]?.id || table.seats[0].id;
      }

      const leaving = removedSeats[0] || { id: playerId || 'player', name: '玩家' };
      table.lastAction = {
        type: 'leave',
        playerId: leaving.id,
        text: `玩家【${leaving.name}】已离开牌桌`,
        timestamp: Date.now()
      };
      table.lastUpdated = Date.now();

      broadcastToRoom(roomId, { type: 'TABLE_SYNC', table });
      broadcastToRoom(roomId, { type: 'PLAYER_LEAVE', playerId: leaving.id, table });
    }

    res.json({ ok: true, table });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 5. Table Reset
app.post('/api/table/reset', (req, res) => {
  try {
    const roomId = normalizeRoomId(req.body.roomId || '666666');
    const table = getOrCreateTable(roomId);
    table.seats = [];
    table.status = 'waiting';
    table.dealerIndex = 0;
    table.dealerId = '';
    table.shuffleCount = 0;
    table.cutCard = null;
    table.dealtHands = undefined;
    table.lastUpdated = Date.now();

    broadcastToRoom(roomId, { type: 'TABLE_SYNC', table });
    res.json({ ok: true, message: '房间已成功重置！', table });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 6. Clean stale seats
app.post('/api/table/clean_stale', (req, res) => {
  try {
    const roomId = normalizeRoomId(req.body.roomId || '666666');
    const table = getOrCreateTable(roomId);
    const now = Date.now();
    const beforeCount = table.seats.length;

    table.seats = table.seats.filter(s => now - (s.lastActive || 0) < 25000);
    if (table.seats.length !== beforeCount) {
      if (table.seats.length === 0) {
        table.status = 'waiting';
        table.dealerIndex = 0;
        table.dealerId = '';
        table.shuffleCount = 0;
        table.cutCard = null;
        table.dealtHands = undefined;
      } else {
        table.dealerIndex = table.dealerIndex % table.seats.length;
        table.dealerId = table.seats[table.dealerIndex]?.id || table.seats[0].id;
      }
      table.lastUpdated = now;
      broadcastToRoom(roomId, { type: 'TABLE_SYNC', table });
    }

    res.json({ ok: true, cleanedCount: beforeCount - table.seats.length, table });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 7. Dealer & Game Actions (Shuffle, Cut, Deal, Next Round)
app.post('/api/table/action', (req, res) => {
  try {
    const roomId = normalizeRoomId(req.body.roomId || '666666');
    const action = req.body.action;
    if (!action || !action.type) {
      return res.status(400).json({ ok: false, error: 'Missing action payload' });
    }

    const table = getOrCreateTable(roomId);

    switch (action.type) {
      case 'DEALER_SHUFFLE': {
        table.shuffleCount = Number(action.shuffleCount || 0);
        table.status = 'shuffling';
        table.lastAction = {
          type: 'shuffle',
          playerId: action.dealerId || table.dealerId,
          text: `庄家正在洗牌 (已洗 ${table.shuffleCount} 次)`,
          timestamp: Date.now()
        };
        break;
      }
      case 'DEALER_CUT': {
        table.cutSliderPos = Number(action.cutSliderPos || 50);
        table.cutCard = action.cutCard || null;
        table.status = 'cutting';
        table.lastAction = {
          type: 'cut',
          playerId: action.dealerId || table.dealerId,
          text: `庄家完成切牌 (切点: ${table.cutSliderPos}%)`,
          timestamp: Date.now()
        };
        break;
      }
      case 'DEALER_DEAL': {
        table.dealtHands = action.dealtHands;
        table.dealerIndex = typeof action.dealerIndex === 'number' ? action.dealerIndex : table.dealerIndex;
        table.status = 'arranging';
        table.lastAction = {
          type: 'deal',
          playerId: action.dealerId || table.dealerId,
          text: `庄家已发牌！全桌开始理牌`,
          timestamp: Date.now()
        };
        break;
      }
      case 'NEXT_ROUND': {
        table.round = (table.round || 1) + 1;
        if (table.seats.length > 0) {
          table.dealerIndex = (table.dealerIndex + 1) % table.seats.length;
          table.dealerId = table.seats[table.dealerIndex].id;
        }
        table.shuffleCount = 0;
        table.cutCard = null;
        table.dealtHands = undefined;
        table.status = 'waiting';
        table.lastAction = {
          type: 'next_round',
          playerId: table.dealerId,
          text: `进入第 ${table.round} 局，庄家为【${table.seats[table.dealerIndex]?.name || '庄家'}】！`,
          timestamp: Date.now()
        };
        break;
      }
    }

    table.lastUpdated = Date.now();

    broadcastToRoom(roomId, { type: 'TABLE_ACTION', action, table });
    broadcastToRoom(roomId, { type: 'TABLE_SYNC', table });

    res.json({ ok: true, table });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// -------------------------------------------------------------
// Voice & Signaling Endpoints (Tier 3 HTTP Fallback)
// -------------------------------------------------------------

// Voice Frame Send (HTTP Fallback)
app.post('/api/voice/send', (req, res) => {
  try {
    const { roomId, senderId, senderName, senderAvatar, seatIndex, type, audioData, duration, phrase } = req.body;
    if (!roomId || !senderId) {
      return res.status(400).json({ ok: false, error: 'Missing roomId or senderId' });
    }
    const normRoomId = normalizeRoomId(roomId);
    if (!voiceFramesStore.has(normRoomId)) {
      voiceFramesStore.set(normRoomId, []);
    }
    const frames = voiceFramesStore.get(normRoomId);
    const newFrame = {
      id: `voice_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      roomId: normRoomId,
      senderId,
      senderName,
      senderAvatar,
      seatIndex,
      type: type || 'voice_frame',
      audioData,
      duration,
      phrase,
      timestamp: Date.now()
    };
    frames.push(newFrame);
    if (frames.length > 80) frames.splice(0, frames.length - 80);

    // Also broadcast over WS
    broadcastToRoom(normRoomId, {
      type: type === 'phrase' ? 'VOICE_PHRASE' : 'VOICE_FRAME',
      senderId,
      senderName,
      senderAvatar,
      seatIndex,
      audioData,
      duration,
      phrase
    });

    res.json({ ok: true, frame: newFrame });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Voice Poll (HTTP Fallback)
app.get('/api/voice/poll', (req, res) => {
  try {
    const roomId = normalizeRoomId(req.query.roomId);
    const since = parseInt(req.query.since || '0', 10);
    const userId = req.query.userId || '';
    const frames = voiceFramesStore.get(roomId) || [];
    const newFrames = frames.filter(f => f.timestamp > since && f.senderId !== userId);
    res.json({ ok: true, frames: newFrames, timestamp: Date.now() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// WebRTC Signaling Send (HTTP Fallback)
app.post('/api/voice/signal/send', (req, res) => {
  try {
    const { roomId, signal } = req.body;
    const normRoomId = normalizeRoomId(roomId);
    if (!signalsStore.has(normRoomId)) {
      signalsStore.set(normRoomId, []);
    }
    const signals = signalsStore.get(normRoomId);
    const signalWithTime = { ...signal, timestamp: Date.now() };
    signals.push(signalWithTime);
    if (signals.length > 100) signals.splice(0, signals.length - 100);

    // Broadcast over WS
    broadcastToRoom(normRoomId, signal);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// WebRTC Signaling Poll (HTTP Fallback)
app.get('/api/voice/signal/poll', (req, res) => {
  try {
    const roomId = normalizeRoomId(req.query.roomId);
    const userId = req.query.userId || '';
    const since = parseInt(req.query.since || '0', 10);
    const signals = signalsStore.get(roomId) || [];
    const targeted = signals.filter(s => s.timestamp > since && (s.targetId === userId || !s.targetId));
    res.json({ ok: true, signals: targeted, timestamp: Date.now() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// -------------------------------------------------------------
// Chat Endpoints
// -------------------------------------------------------------

// Send Chat Message
app.post('/api/chat/send', (req, res) => {
  try {
    const { roomId = '666666', message } = req.body;
    if (!message || !message.senderId) {
      return res.status(400).json({ ok: false, error: 'Invalid message payload' });
    }

    const normRoomId = normalizeRoomId(roomId);
    const roomMessages = getOrCreateRoomChat(normRoomId);

    const fullMessage = {
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderId: message.senderId,
      senderName: message.senderName || '玩家',
      senderAvatar: message.senderAvatar || '🎮',
      senderRole: message.senderRole || 'player',
      content: message.content || '',
      type: message.type || 'text',
      audioUrl: message.audioUrl,
      duration: message.duration,
      timestamp: message.timestamp || Date.now(),
      unread: false,
      isUser: false
    };

    roomMessages.push(fullMessage);
    if (roomMessages.length > 200) {
      roomMessages.splice(0, roomMessages.length - 200);
    }

    // Broadcast via WebSocket
    broadcastToRoom(normRoomId, {
      type: 'CHAT_MESSAGE',
      message: fullMessage
    });

    res.json({ ok: true, message: fullMessage });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Poll New Messages
app.get('/api/chat/poll', (req, res) => {
  try {
    const roomId = normalizeRoomId(req.query.roomId);
    const since = parseInt(req.query.since || '0', 10);
    const userId = req.query.userId || '';

    const roomMessages = getOrCreateRoomChat(roomId);
    const newMessages = roomMessages
      .filter(m => m.timestamp > since)
      .map(m => ({
        ...m,
        isUser: Boolean(userId && m.senderId === userId)
      }));

    res.json({ ok: true, messages: newMessages, timestamp: Date.now() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get Chat History
app.get('/api/chat/history', (req, res) => {
  try {
    const roomId = normalizeRoomId(req.query.roomId);
    const limit = Math.min(100, parseInt(req.query.limit || '50', 10));
    const userId = req.query.userId || '';

    const roomMessages = getOrCreateRoomChat(roomId);
    const history = roomMessages
      .slice(-limit)
      .map(m => ({
        ...m,
        isUser: Boolean(userId && m.senderId === userId)
      }));

    res.json({ ok: true, messages: history });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Clear Chat History
app.post('/api/chat/clear', (req, res) => {
  try {
    const { roomId = '666666' } = req.body;
    const normRoomId = normalizeRoomId(roomId);
    chatStore.set(normRoomId, []);

    broadcastToRoom(normRoomId, {
      type: 'CHAT_CLEARED'
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// -------------------------------------------------------------
// WebSocket Realtime Server (Signaling, Voice, Chat, Table Sync)
// -------------------------------------------------------------

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = request.url || '';
  if (url.startsWith('/api/ws') || url.startsWith('/ws') || url === '/') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  let currentClient = null;

  ws.on('message', (rawData) => {
    try {
      const msg = JSON.parse(rawData.toString());
      const now = Date.now();

      switch (msg.type) {
        // 1. Join Voice & Chat Room
        case 'JOIN_ROOM': {
          const roomId = normalizeRoomId(msg.roomId);
          if (!roomPeersMap.has(roomId)) {
            roomPeersMap.set(roomId, new Set());
          }
          const peers = roomPeersMap.get(roomId);

          peers.forEach(p => {
            if (p.userId === msg.userId) {
              peers.delete(p);
            }
          });

          currentClient = {
            ws,
            roomId,
            userId: msg.userId,
            name: msg.name || '玩家',
            avatar: msg.avatar || '🎮',
            seatIndex: typeof msg.seatIndex === 'number' ? msg.seatIndex : -1,
            joinedAt: now,
            lastPing: now
          };

          peers.add(currentClient);

          const activePeersList = Array.from(peers)
            .filter(p => p.userId !== msg.userId)
            .map(p => ({
              userId: p.userId,
              name: p.name,
              avatar: p.avatar,
              seatIndex: p.seatIndex
            }));

          ws.send(JSON.stringify({
            type: 'ROOM_JOINED',
            roomId,
            peers: activePeersList
          }));

          broadcastToRoom(roomId, {
            type: 'PEER_JOINED',
            peer: {
              userId: currentClient.userId,
              name: currentClient.name,
              avatar: currentClient.avatar,
              seatIndex: currentClient.seatIndex
            }
          }, ws);
          break;
        }

        // 2. Table State Subscribe & Sync
        case 'TABLE_SUBSCRIBE': {
          const tableRoomId = normalizeRoomId(msg.roomId || (currentClient ? currentClient.roomId : '666666'));
          if (!currentClient) {
            if (!roomPeersMap.has(tableRoomId)) {
              roomPeersMap.set(tableRoomId, new Set());
            }
            currentClient = {
              ws,
              roomId: tableRoomId,
              userId: msg.userId || `sub_${Math.random().toString(36).substring(2, 7)}`,
              name: msg.name || '玩家',
              avatar: '🎮',
              seatIndex: -1,
              joinedAt: now,
              lastPing: now
            };
            roomPeersMap.get(tableRoomId).add(currentClient);
          }

          const existingTable = tablesMap.get(tableRoomId) || getOrCreateTable(tableRoomId);
          ws.send(JSON.stringify({
            type: 'TABLE_SYNC',
            table: existingTable
          }));
          break;
        }

        // 3. Table Game Action (Deal, Shuffle, Cut, Sync)
        case 'TABLE_ACTION': {
          const targetRoomId = normalizeRoomId(msg.roomId || (currentClient ? currentClient.roomId : '666666'));
          if (msg.table) {
            tablesMap.set(targetRoomId, msg.table);
          }
          broadcastToRoom(targetRoomId, {
            type: 'TABLE_ACTION',
            action: msg.action,
            table: msg.table
          }, ws);
          break;
        }

        // 4. WebRTC Signaling Relays (Offer, Answer, ICE Candidate)
        case 'SIGNAL_OFFER': {
          if (!currentClient) return;
          broadcastToRoom(currentClient.roomId, {
            type: 'SIGNAL_OFFER',
            senderId: currentClient.userId,
            targetId: msg.targetId,
            sdp: msg.sdp
          }, ws);
          break;
        }

        case 'SIGNAL_ANSWER': {
          if (!currentClient) return;
          broadcastToRoom(currentClient.roomId, {
            type: 'SIGNAL_ANSWER',
            senderId: currentClient.userId,
            targetId: msg.targetId,
            sdp: msg.sdp
          }, ws);
          break;
        }

        case 'SIGNAL_ICE': {
          if (!currentClient) return;
          broadcastToRoom(currentClient.roomId, {
            type: 'SIGNAL_ICE',
            senderId: currentClient.userId,
            targetId: msg.targetId,
            candidate: msg.candidate
          }, ws);
          break;
        }

        // 5. Voice Frame Relay (Walkie-Talkie Stream)
        case 'VOICE_FRAME': {
          const roomId = normalizeRoomId(msg.roomId || (currentClient ? currentClient.roomId : '666666'));
          const senderId = msg.senderId || (currentClient ? currentClient.userId : '');
          const senderName = msg.senderName || (currentClient ? currentClient.name : '玩家');
          const senderAvatar = msg.senderAvatar || (currentClient ? currentClient.avatar : '🎙️');
          const seatIndex = typeof msg.seatIndex === 'number' ? msg.seatIndex : (currentClient ? currentClient.seatIndex : -1);

          if (!voiceFramesStore.has(roomId)) {
            voiceFramesStore.set(roomId, []);
          }
          const frames = voiceFramesStore.get(roomId);
          const frameRecord = {
            id: `voice_${now}_${Math.random().toString(36).slice(2, 6)}`,
            roomId,
            senderId,
            senderName,
            senderAvatar,
            seatIndex,
            type: 'voice_frame',
            audioData: msg.audioData,
            duration: msg.duration || 2,
            mimeType: msg.mimeType,
            timestamp: now
          };
          frames.push(frameRecord);
          if (frames.length > 80) frames.splice(0, frames.length - 80);

          broadcastToRoom(roomId, {
            type: 'VOICE_FRAME',
            senderId,
            senderName,
            senderAvatar,
            seatIndex,
            audioData: msg.audioData,
            duration: msg.duration || 2,
            mimeType: msg.mimeType,
            timestamp: now
          }, ws);
          break;
        }

        // 5b. Quick Tactical Voice Phrase Relay
        case 'VOICE_PHRASE': {
          const roomId = normalizeRoomId(msg.roomId || (currentClient ? currentClient.roomId : '666666'));
          const senderId = msg.senderId || (currentClient ? currentClient.userId : '');
          const senderName = msg.senderName || (currentClient ? currentClient.name : '玩家');
          const senderAvatar = msg.senderAvatar || (currentClient ? currentClient.avatar : '📢');
          const seatIndex = typeof msg.seatIndex === 'number' ? msg.seatIndex : (currentClient ? currentClient.seatIndex : -1);

          if (!voiceFramesStore.has(roomId)) {
            voiceFramesStore.set(roomId, []);
          }
          const frames = voiceFramesStore.get(roomId);
          const frameRecord = {
            id: `phrase_${now}_${Math.random().toString(36).slice(2, 6)}`,
            roomId,
            senderId,
            senderName,
            senderAvatar,
            seatIndex,
            type: 'phrase',
            phrase: msg.phrase,
            category: msg.category || '战术播报',
            icon: msg.icon || '📢',
            duration: 2,
            timestamp: now
          };
          frames.push(frameRecord);
          if (frames.length > 80) frames.splice(0, frames.length - 80);

          broadcastToRoom(roomId, {
            type: 'VOICE_PHRASE',
            senderId,
            senderName,
            senderAvatar,
            seatIndex,
            phrase: msg.phrase,
            category: msg.category || '战术播报',
            icon: msg.icon || '📢',
            timestamp: now
          }, ws);
          break;
        }

        // 6. Voice Activity Indicator (Speaking ripple)
        case 'VOICE_ACTIVITY': {
          const roomId = normalizeRoomId(msg.roomId || (currentClient ? currentClient.roomId : '666666'));
          const senderId = msg.senderId || (currentClient ? currentClient.userId : '');
          const senderName = msg.senderName || (currentClient ? currentClient.name : '玩家');
          const senderAvatar = msg.senderAvatar || (currentClient ? currentClient.avatar : '🎙️');
          const seatIndex = typeof msg.seatIndex === 'number' ? msg.seatIndex : (currentClient ? currentClient.seatIndex : -1);

          broadcastToRoom(roomId, {
            type: 'VOICE_ACTIVITY',
            senderId,
            senderName,
            senderAvatar,
            seatIndex,
            isSpeaking: Boolean(msg.isSpeaking),
            volume: msg.volume || 0
          }, ws);
          break;
        }

        // 7. Tactical Chat Message Broadcast
        case 'CHAT_MESSAGE': {
          const roomId = normalizeRoomId(msg.roomId || (currentClient ? currentClient.roomId : '666666'));
          const chatMsg = msg.message;
          if (chatMsg) {
            const roomMessages = getOrCreateRoomChat(roomId);
            roomMessages.push(chatMsg);
            if (roomMessages.length > 200) roomMessages.splice(0, roomMessages.length - 200);

            broadcastToRoom(roomId, {
              type: 'CHAT_MESSAGE',
              message: chatMsg
            }, ws);
          }
          break;
        }

        // 8. Ping Heartbeat
        case 'PING': {
          if (currentClient) {
            currentClient.lastPing = now;
          }
          ws.send(JSON.stringify({ type: 'PONG', timestamp: now }));
          break;
        }

        // 9. Graceful Leave
        case 'LEAVE_ROOM': {
          if (currentClient) {
            const roomId = currentClient.roomId;
            const peers = roomPeersMap.get(roomId);
            if (peers) {
              peers.delete(currentClient);
              if (peers.size === 0) {
                roomPeersMap.delete(roomId);
              }
            }
            broadcastToRoom(roomId, {
              type: 'PEER_LEFT',
              userId: currentClient.userId
            });
            currentClient = null;
          }
          break;
        }
      }
    } catch (err) {
      console.warn('[WS message parsing error]:', err.message);
    }
  });

  ws.on('close', () => {
    if (currentClient) {
      const roomId = currentClient.roomId;
      const peers = roomPeersMap.get(roomId);
      if (peers) {
        peers.delete(currentClient);
        if (peers.size === 0) {
          roomPeersMap.delete(roomId);
        }
      }
      broadcastToRoom(roomId, {
        type: 'PEER_LEFT',
        userId: currentClient.userId
      });
      currentClient = null;
    }
  });

  ws.on('error', () => {
    try {
      ws.close();
    } catch {}
  });
});

// Periodic Stale Connection Pruning (every 30s)
setInterval(() => {
  const threshold = Date.now() - 45000;
  roomPeersMap.forEach((peers, roomId) => {
    peers.forEach(peer => {
      if (peer.lastPing < threshold) {
        try {
          peer.ws.terminate();
        } catch {}
        peers.delete(peer);
        broadcastToRoom(roomId, {
          type: 'PEER_LEFT',
          userId: peer.userId
        });
      }
    });
    if (peers.size === 0) {
      roomPeersMap.delete(roomId);
    }
  });
}, 30000);

// Start HTTP + WebSocket Server (Listen on 0.0.0.0 for external network access)
server.listen(port, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`🚀 Triple Voice & Realtime Server (Serv00 Edition)`);
  console.log(`📡 Listening on: http://0.0.0.0:${port}`);
  console.log(`💬 WebSocket Path: ws://0.0.0.0:${port}/api/ws`);
  console.log(`🌐 Health Check: http://0.0.0.0:${port}/health`);
  console.log('====================================================');
});
