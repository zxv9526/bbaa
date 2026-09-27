import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";

const app = express();
const PORT = 3000;

// Enable CORS for all origins, methods, and headers + Mobile Anti-Cache Headers
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  // Force disabling HTTP cache for all dynamic endpoints (critical for mobile Safari/Chrome)
  res.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.header("Pragma", "no-cache");
  res.header("Expires", "0");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ limit: "15mb" }));

// In-memory store for Tier 3 HTTP polling fallback & signaling
interface VoiceFrameRecord {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  seatIndex?: number;
  type: 'voice_frame' | 'phrase' | 'activity';
  audioData?: string; // base64
  duration?: number;
  phrase?: string;
  timestamp: number;
}

interface ChatMessageRecord {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  type: 'text' | 'voice' | 'quick' | 'emoji';
  content: string;
  audioUrl?: string;
  audioDuration?: number;
  timestamp: number;
  seatIndex?: number;
  isDealer?: boolean;
}

interface SignalRecord {
  id: string;
  roomId: string;
  senderId: string;
  targetId: string;
  signalType: 'offer' | 'answer' | 'ice';
  data: any;
  timestamp: number;
}

export interface ServerSeatPlayer {
  id: string;
  deviceId?: string;
  tabSessionId?: string;
  name: string;
  avatar: string;
  isAi: boolean;
  score: number;
  lastActive: number;
}

export interface ServerTableState {
  tableId: string;
  roomId: string;
  roomName: string;
  round: number;
  dealerIndex: number;
  dealerId: string;
  status: 'waiting' | 'shuffling' | 'cutting' | 'dealing' | 'arranging' | 'revealing';
  seats: ServerSeatPlayer[];
  shuffleCount: number;
  cutSliderPos: number;
  cutCard: any;
  dealtHands?: { [playerId: string]: any[] };
  lastAction?: {
    type: string;
    playerId: string;
    text: string;
    timestamp: number;
  };
  lastUpdated: number;
}

const voiceFramesBuffer: VoiceFrameRecord[] = [];
const chatMessagesBuffer: ChatMessageRecord[] = [];
const signalsBuffer: SignalRecord[] = [];
const roomPeersMap = new Map<string, Set<string>>(); // roomId -> Set of userIds
const tablesMap = new Map<string, ServerTableState>(); // roomId -> ServerTableState

function normalizeRoomId(rawRoomId: any): string {
  if (!rawRoomId) return "888888";
  const clean = String(rawRoomId).trim().replace(/^realtime_room_/, "");
  return clean || "888888";
}

function getOrCreateTable(rawRoomId: string, customName?: string): ServerTableState {
  const roomId = normalizeRoomId(rawRoomId);
  let table = tablesMap.get(roomId);
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
    tablesMap.set(roomId, table);
  }
  return table;
}

// Cleanup old frames, signals, and stale tables periodically
setInterval(() => {
  const now = Date.now();
  while (voiceFramesBuffer.length > 0 && now - voiceFramesBuffer[0].timestamp > 60000) {
    voiceFramesBuffer.shift();
  }
  while (signalsBuffer.length > 0 && now - signalsBuffer[0].timestamp > 60000) {
    signalsBuffer.shift();
  }
  // Keep chat buffer under 300 messages and within 2 hours
  while (chatMessagesBuffer.length > 300 || (chatMessagesBuffer.length > 0 && now - chatMessagesBuffer[0].timestamp > 2 * 3600 * 1000)) {
    chatMessagesBuffer.shift();
  }

  // Cleanup idle private tables (inactive for > 1 hour and no players)
  tablesMap.forEach((table, rid) => {
    if (rid !== "888888" && table.seats.length === 0 && now - table.lastUpdated > 3600 * 1000) {
      tablesMap.delete(rid);
    }
  });
}, 10000);

// Active Realtime Zombie Cleaner: runs every 1.0s to evict seats with >3000ms inactivity
setInterval(() => {
  const now = Date.now();
  tablesMap.forEach((table, rid) => {
    if (table.seats.length === 0) return;
    const beforeCount = table.seats.length;
    // Strict threshold: 3 seconds without ping = zombie eviction
    table.seats = table.seats.filter(s => now - (s.lastActive || 0) < 3000);
    if (table.seats.length !== beforeCount) {
      if (table.seats.length === 0) {
        table.status = "waiting";
        table.dealerIndex = 0;
        table.dealerId = "";
        table.shuffleCount = 0;
        table.cutCard = null;
        table.dealtHands = undefined;
      } else {
        table.seats.forEach((s, i) => {
          s.name = s.name.replace(/\(\d+号位\)/g, '').trim() + ` (${i + 1}号位)`;
        });
        table.dealerIndex = table.dealerIndex % table.seats.length;
        table.dealerId = table.seats[table.dealerIndex]?.id || table.seats[0].id;
      }
      table.lastUpdated = now;
      broadcastToRoom(rid, { type: "TABLE_SYNC", table });
    }
  });
}, 1000);

// -------------------------------------------------------------
// HTTP API Endpoints (Tier 3 HTTP Polling + WebRTC HTTP Signaling)
// -------------------------------------------------------------

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Mock database compatibility endpoints
app.get("/api/init", (req, res) => {
  res.json({
    ok: true,
    d1Bound: false,
    message: "Node.js Express + WebSocket Server Active",
    stats: { totalGames: 0, totalPlayers: 0 }
  });
});

app.get("/api/stats", (req, res) => {
  res.json({ ok: true, d1Bound: false, leaderboard: [] });
});

app.post("/api/history", (req, res) => {
  res.json({ ok: true, saved: true });
});

// -------------------------------------------------------------
// Real-time Table & Room Management Endpoints (Server Authoritative)
// -------------------------------------------------------------

// List active rooms
app.get("/api/table/rooms", (req, res) => {
  getOrCreateTable("888888"); // Guarantee default arena table exists
  const rooms = Array.from(tablesMap.values()).map(t => ({
    roomId: t.roomId,
    roomName: t.roomName,
    playerCount: t.seats.length,
    maxPlayers: 8,
    round: t.round,
    status: t.status,
    dealerName: t.seats[t.dealerIndex]?.name || "待入座",
    lastUpdated: t.lastUpdated
  }));
  res.json({ ok: true, rooms });
});

// Get table state with heartbeat update and auto-pruning of stale seats
app.get("/api/table/state", (req, res) => {
  const roomId = normalizeRoomId(req.query.roomId || "888888");
  const playerId = req.query.playerId ? String(req.query.playerId).trim() : null;
  const deviceId = req.query.deviceId ? String(req.query.deviceId).trim() : null;
  const tabSessionId = req.query.tabSessionId ? String(req.query.tabSessionId).trim() : null;
  const table = getOrCreateTable(roomId);

  const now = Date.now();
  // Update lastActive for current player if specified
  if (playerId || deviceId || tabSessionId) {
    const s = table.seats.find(s => 
      (playerId && s.id === playerId) ||
      (tabSessionId && s.tabSessionId === tabSessionId) ||
      (deviceId && s.deviceId === deviceId)
    );
    if (s) {
      s.lastActive = now;
    }
  }

  // Prune seats inactive for > 3s
  const beforeLen = table.seats.length;
  table.seats = table.seats.filter(s => now - (s.lastActive || 0) < 3000);
  if (table.seats.length !== beforeLen) {
    table.lastUpdated = now;
    if (table.seats.length === 0) {
      table.status = "waiting";
      table.dealerIndex = 0;
      table.dealerId = "";
      table.shuffleCount = 0;
      table.cutCard = null;
      table.dealtHands = undefined;
    } else {
      table.seats.forEach((s, i) => {
        s.name = s.name.replace(/\(\d+号位\)/g, '').trim() + ` (${i + 1}号位)`;
      });
      table.dealerIndex = table.dealerIndex % table.seats.length;
      table.dealerId = table.seats[table.dealerIndex]?.id || table.seats[0].id;
    }
    broadcastToRoom(roomId, { type: "TABLE_SYNC", table });
  }

  res.json({ ok: true, table });
});

// Join table with strict deduplication, stale seat pruning & reliable distinct seat assignment
app.post("/api/table/join", (req, res) => {
  try {
    const roomId = normalizeRoomId(req.body.roomId || "888888");
    const player = req.body.player;
    if (!player || !player.id) {
      res.status(400).json({ ok: false, error: "Missing player payload" });
      return;
    }

    const table = getOrCreateTable(roomId, req.body.roomName);
    const now = Date.now();

    // 1. Strict Auto-prune stale seats (older than 3s without active ping)
    table.seats = table.seats.filter(s => (now - (s.lastActive || 0)) < 3000);

    // 2. Check if this exact player is already seated (reconnect by exact ID or tabSessionId)
    const existingIndex = table.seats.findIndex(s =>
      s.id === player.id ||
      (player.tabSessionId && s.tabSessionId === player.tabSessionId)
    );

    if (existingIndex !== -1) {
      // Cleanly update seat properties
      table.seats[existingIndex].id = String(player.id);
      table.seats[existingIndex].deviceId = player.deviceId || table.seats[existingIndex].deviceId;
      table.seats[existingIndex].tabSessionId = player.tabSessionId || table.seats[existingIndex].tabSessionId;
      table.seats[existingIndex].name = player.name || table.seats[existingIndex].name;
      table.seats[existingIndex].avatar = player.avatar || table.seats[existingIndex].avatar;
      table.seats[existingIndex].lastActive = now;

      // Cleanly remove any other duplicate residual seats for this player
      table.seats = table.seats.filter((s, idx) => {
        if (idx === existingIndex) return true;
        return s.id !== player.id && (!player.tabSessionId || s.tabSessionId !== player.tabSessionId);
      });

      // Recalculate formatted seat names & indices
      table.seats.forEach((s, i) => {
        s.name = s.name.replace(/\(\d+号位\)/g, '').trim() + ` (${i + 1}号位)`;
      });
      const realIndex = table.seats.findIndex(s => s.id === player.id);
      table.dealerIndex = table.dealerIndex % Math.max(1, table.seats.length);
      table.dealerId = table.seats[table.dealerIndex]?.id || table.seats[0]?.id || "";
      table.lastUpdated = now;

      broadcastToRoom(roomId, {
        type: "TABLE_SYNC",
        table
      });

      res.json({ ok: true, table, seatIndex: Math.max(0, realIndex) });
      return;
    }

    // 3. Force eviction if full (>= 8): Remove the oldest least-active seat to guarantee active human entry
    if (table.seats.length >= 8) {
      table.seats.sort((a, b) => (a.lastActive || 0) - (b.lastActive || 0));
      table.seats.shift();
    }

    // 4. New real human player enters next available seat
    const seatIndex = table.seats.length;
    let finalName = player.name || `玩家${seatIndex + 1}`;
    finalName = finalName.replace(/\(\d+号位\)/g, '').trim();
    finalName = `${finalName} (${seatIndex + 1}号位)`;

    const newSeat: ServerSeatPlayer = {
      id: String(player.id),
      deviceId: player.deviceId,
      tabSessionId: player.tabSessionId,
      name: finalName,
      avatar: player.avatar || "😎",
      isAi: false,
      score: 0,
      lastActive: now
    };

    table.seats.push(newSeat);

    // Format seat names
    table.seats.forEach((s, i) => {
      s.name = s.name.replace(/\(\d+号位\)/g, '').trim() + ` (${i + 1}号位)`;
    });

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

    broadcastToRoom(roomId, {
      type: "TABLE_SYNC",
      table
    });

    res.json({ ok: true, table, seatIndex });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
});

// Leave table (cleanly removes all matching seats for this device/player/session)
app.post("/api/table/leave", (req, res) => {
  try {
    const roomId = normalizeRoomId(req.body.roomId || "888888");
    const playerId = String(req.body.playerId || "").trim();
    const deviceId = String(req.body.deviceId || "").trim();
    const tabSessionId = String(req.body.tabSessionId || "").trim();
    const table = getOrCreateTable(roomId);

    const initialCount = table.seats.length;
    const removedSeats: ServerSeatPlayer[] = [];

    table.seats = table.seats.filter(s => {
      const matchDevice = deviceId && s.deviceId === deviceId;
      const matchPlayer = playerId && (s.id === playerId || s.id.split('_')[0] === playerId.split('_')[0]);
      const matchTab = tabSessionId && s.tabSessionId === tabSessionId;
      const shouldRemove = matchDevice || matchPlayer || matchTab;
      if (shouldRemove) {
        removedSeats.push(s);
      }
      return !shouldRemove;
    });

    if (removedSeats.length > 0 || table.seats.length !== initialCount) {
      if (table.seats.length === 0) {
        table.status = "waiting";
        table.dealerIndex = 0;
        table.dealerId = "";
        table.shuffleCount = 0;
        table.cutCard = null;
        table.dealtHands = undefined;
      } else {
        table.seats.forEach((s, i) => {
          s.name = s.name.replace(/\(\d+号位\)/g, '').trim() + ` (${i + 1}号位)`;
        });
        table.dealerIndex = table.dealerIndex % table.seats.length;
        table.dealerId = table.seats[table.dealerIndex]?.id || table.seats[0].id;
      }

      const leaving = removedSeats[0] || { id: playerId || 'player', name: '玩家' };
      table.lastAction = {
        type: "leave",
        playerId: leaving.id,
        text: `玩家【${leaving.name}】已离开牌桌`,
        timestamp: Date.now()
      };
      table.lastUpdated = Date.now();

      broadcastToRoom(roomId, {
        type: "TABLE_SYNC",
        table
      });
      broadcastToRoom(roomId, {
        type: "PLAYER_LEAVE",
        playerId: leaving.id,
        table
      });
    }

    res.json({ ok: true, table });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
});

// Force reset table / Kick all stale zombie players
app.post("/api/table/reset", (req, res) => {
  try {
    const roomId = normalizeRoomId(req.body.roomId || "888888");
    const table = getOrCreateTable(roomId);
    table.seats = [];
    table.status = "waiting";
    table.dealerIndex = 0;
    table.dealerId = "";
    table.shuffleCount = 0;
    table.cutCard = null;
    table.dealtHands = undefined;
    table.lastUpdated = Date.now();
    
    broadcastToRoom(roomId, {
      type: "TABLE_SYNC",
      table
    });
    res.json({ ok: true, message: "房间已成功重置，所有僵尸座位已完全清空！", table });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
});

// Clean inactive zombie seats (inactive > 3s)
app.post("/api/table/clean_stale", (req, res) => {
  try {
    const roomId = normalizeRoomId(req.body.roomId || "888888");
    const table = getOrCreateTable(roomId);
    const now = Date.now();
    const activeThreshold = 3000; // 3 seconds
    const beforeCount = table.seats.length;
    
    table.seats = table.seats.filter(s => now - (s.lastActive || 0) < activeThreshold);
    
    if (table.seats.length !== beforeCount) {
      if (table.seats.length === 0) {
        table.status = "waiting";
        table.dealerIndex = 0;
        table.dealerId = "";
        table.shuffleCount = 0;
        table.cutCard = null;
        table.dealtHands = undefined;
      } else {
        table.seats.forEach((s, i) => {
          s.name = s.name.replace(/\(\d+号位\)/g, '').trim() + ` (${i + 1}号位)`;
        });
        table.dealerIndex = table.dealerIndex % table.seats.length;
        table.dealerId = table.seats[table.dealerIndex]?.id || table.seats[0].id;
      }
      table.lastUpdated = now;
      broadcastToRoom(roomId, {
        type: "TABLE_SYNC",
        table
      });
    }
    
    res.json({ ok: true, message: `已清理 ${beforeCount - table.seats.length} 个不活跃座位`, table, cleanedCount: beforeCount - table.seats.length });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
});

// Real-time table actions (shuffle, cut, deal, next_round, claim_dealer, rotate_dealer)
app.post("/api/table/action", (req, res) => {
  try {
    const roomId = String(req.body.roomId || "888888").trim();
    const action = req.body.action;
    if (!action || !action.type) {
      res.status(400).json({ ok: false, error: "Missing action payload" });
      return;
    }

    const table = getOrCreateTable(roomId);

    switch (action.type) {
      case "DEALER_SHUFFLE": {
        table.shuffleCount = Number(action.shuffleCount || 0);
        table.status = "shuffling";
        table.lastAction = {
          type: "shuffle",
          playerId: action.dealerId || table.dealerId,
          text: `庄家正在洗牌 (已洗 ${table.shuffleCount} 次)`,
          timestamp: Date.now()
        };
        break;
      }
      case "DEALER_CUT": {
        table.cutSliderPos = Number(action.cutSliderPos || 50);
        table.cutCard = action.cutCard || null;
        table.status = "cutting";
        table.lastAction = {
          type: "cut",
          playerId: action.dealerId || table.dealerId,
          text: `庄家完成切牌 (切点: ${table.cutSliderPos}%)`,
          timestamp: Date.now()
        };
        break;
      }
      case "DEALER_DEAL": {
        table.dealtHands = action.dealtHands;
        table.dealerIndex = typeof action.dealerIndex === "number" ? action.dealerIndex : table.dealerIndex;
        table.status = "arranging";
        table.lastAction = {
          type: "deal",
          playerId: action.dealerId || table.dealerId,
          text: `庄家已发牌！全桌开始理牌`,
          timestamp: Date.now()
        };
        break;
      }
      case "CLAIM_DEALER": {
        const newIdx = table.seats.findIndex(s => s.id === action.playerId);
        if (newIdx !== -1) {
          table.dealerIndex = newIdx;
          table.dealerId = action.playerId;
          table.lastAction = {
            type: "rotate_dealer",
            playerId: action.playerId,
            text: `玩家【${table.seats[newIdx].name}】已成为新庄家！`,
            timestamp: Date.now()
          };
        }
        break;
      }
      case "ROTATE_DEALER": {
        if (table.seats.length > 0) {
          const nextIdx = (table.dealerIndex + 1) % table.seats.length;
          table.dealerIndex = nextIdx;
          table.dealerId = table.seats[nextIdx].id;
          table.lastAction = {
            type: "rotate_dealer",
            playerId: table.dealerId,
            text: `庄家顺延至【${table.seats[nextIdx].name}】！`,
            timestamp: Date.now()
          };
        }
        break;
      }
      case "NEXT_ROUND": {
        table.round = (table.round || 1) + 1;
        if (table.seats.length > 0) {
          table.dealerIndex = (table.dealerIndex + 1) % table.seats.length;
          table.dealerId = table.seats[table.dealerIndex].id;
        }
        table.shuffleCount = 0;
        table.cutCard = null;
        table.dealtHands = undefined;
        table.status = "waiting";
        table.lastAction = {
          type: "next_round",
          playerId: table.dealerId,
          text: `进入第 ${table.round} 局，庄家为【${table.seats[table.dealerIndex]?.name || '庄家'}】！`,
          timestamp: Date.now()
        };
        break;
      }
      case "RESET_TABLE": {
        table.round = 1;
        table.dealerIndex = 0;
        table.shuffleCount = 0;
        table.cutCard = null;
        table.dealtHands = undefined;
        table.status = "waiting";
        break;
      }
    }

    table.lastUpdated = Date.now();

    // Broadcast both action and updated table state to all clients in room
    broadcastToRoom(roomId, {
      type: "TABLE_ACTION",
      action,
      table
    });

    broadcastToRoom(roomId, {
      type: "TABLE_SYNC",
      table
    });

    res.json({ ok: true, table });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
});

// 1. Tier 3 HTTP Voice Frame Send
app.post("/api/voice/send", (req, res) => {
  try {
    const { roomId, senderId, senderName, senderAvatar, seatIndex, type, audioData, duration, phrase } = req.body;
    if (!roomId || !senderId) {
      res.status(400).json({ ok: false, error: "Missing roomId or senderId" });
      return;
    }

    const record: VoiceFrameRecord = {
      id: "vf_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      roomId: String(roomId),
      senderId: String(senderId),
      senderName: senderName || "玩家",
      senderAvatar: senderAvatar || "😎",
      seatIndex: typeof seatIndex === "number" ? seatIndex : undefined,
      type: type || "voice_frame",
      audioData: audioData || undefined,
      duration: duration || 1,
      phrase: phrase || undefined,
      timestamp: Date.now()
    };

    voiceFramesBuffer.push(record);

    // Keep buffer reasonable size (< 500 records)
    if (voiceFramesBuffer.length > 500) {
      voiceFramesBuffer.shift();
    }

    // Also broadcast to WebSocket clients in the same room
    broadcastToRoom(record.roomId, {
      type: "VOICE_FRAME_INCOMING",
      record
    }, senderId);

    res.json({ ok: true, frameId: record.id });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
});

// 2. Tier 3 HTTP Voice Frame Poll
app.get("/api/voice/poll", (req, res) => {
  try {
    const roomId = String(req.query.roomId || "default_table");
    const userId = String(req.query.userId || "");
    const since = parseInt(String(req.query.since || "0"), 10);

    const newFrames = voiceFramesBuffer.filter(
      f => f.roomId === roomId && f.senderId !== userId && f.timestamp > since
    );

    res.json({
      ok: true,
      timestamp: Date.now(),
      frames: newFrames
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
});

// 2b. Real-time Multi-Device Chat Message Send & Broadcast
app.post("/api/chat/send", (req, res) => {
  try {
    const { roomId = "888888", message } = req.body;
    if (!message || !message.senderId) {
      res.status(400).json({ ok: false, error: "Missing message payload" });
      return;
    }

    const cleanRoomId = normalizeRoomId(roomId);
    const record: ChatMessageRecord = {
      id: message.id || ("msg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6)),
      roomId: cleanRoomId,
      senderId: String(message.senderId),
      senderName: String(message.senderName || "玩家"),
      senderAvatar: String(message.senderAvatar || "😎"),
      type: message.type || "text",
      content: String(message.content || ""),
      audioUrl: message.audioUrl,
      audioDuration: message.audioDuration,
      timestamp: message.timestamp || Date.now(),
      seatIndex: typeof message.seatIndex === "number" ? message.seatIndex : undefined,
      isDealer: Boolean(message.isDealer)
    };

    chatMessagesBuffer.push(record);
    if (chatMessagesBuffer.length > 300) chatMessagesBuffer.shift();

    // Broadcast to WebSocket clients in the same room
    broadcastToRoom(record.roomId, {
      type: "CHAT_MESSAGE_INCOMING",
      message: record
    }, record.senderId);

    res.json({ ok: true, messageId: record.id });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
});

// 2c. Real-time Multi-Device Chat Message Poll (for HTTP fallback)
app.get("/api/chat/poll", (req, res) => {
  try {
    const cleanRoomId = normalizeRoomId(req.query.roomId || "888888");
    const userId = String(req.query.userId || "");
    const since = parseInt(String(req.query.since || "0"), 10);

    const newMessages = chatMessagesBuffer.filter(
      m => normalizeRoomId(m.roomId) === cleanRoomId && m.senderId !== userId && m.timestamp > since
    );

    res.json({
      ok: true,
      timestamp: Date.now(),
      messages: newMessages
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
});

// 2d. Chat History Fetch (for joining table or refreshing)
app.get("/api/chat/history", (req, res) => {
  try {
    const cleanRoomId = normalizeRoomId(req.query.roomId || "888888");
    const limit = Math.min(100, parseInt(String(req.query.limit || "50"), 10));

    const history = chatMessagesBuffer
      .filter(m => normalizeRoomId(m.roomId) === cleanRoomId)
      .slice(-limit);

    res.json({
      ok: true,
      messages: history
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
});

// 3. WebRTC HTTP Signaling Fallback
app.post("/api/voice/signal", (req, res) => {
  try {
    const { roomId, senderId, targetId, signalType, data } = req.body;
    if (!roomId || !senderId || !targetId || !signalType) {
      res.status(400).json({ ok: false, error: "Missing required signal parameters" });
      return;
    }

    const record: SignalRecord = {
      id: "sig_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      roomId: String(roomId),
      senderId: String(senderId),
      targetId: String(targetId),
      signalType,
      data,
      timestamp: Date.now()
    };

    signalsBuffer.push(record);
    if (signalsBuffer.length > 500) signalsBuffer.shift();

    // Also forward through WebSocket if recipient has active socket
    forwardSignalViaWs(record);

    res.json({ ok: true, signalId: record.id });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
});

// 4. WebRTC HTTP Signal Poll
app.get("/api/voice/signal/poll", (req, res) => {
  try {
    const roomId = String(req.query.roomId || "default_table");
    const userId = String(req.query.userId || "");
    const since = parseInt(String(req.query.since || "0"), 10);

    const pendingSignals = signalsBuffer.filter(
      s => s.roomId === roomId && s.targetId === userId && s.timestamp > since
    );

    res.json({
      ok: true,
      timestamp: Date.now(),
      signals: pendingSignals
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
});

// 5. Triple-Tier Engine Status Overview
app.get("/api/voice/status", (req, res) => {
  const rooms: Record<string, number> = {};
  wsClients.forEach(c => {
    if (c.roomId) {
      rooms[c.roomId] = (rooms[c.roomId] || 0) + 1;
    }
  });

  res.json({
    ok: true,
    totalWsClients: wsClients.size,
    rooms,
    bufferedVoiceFrames: voiceFramesBuffer.length,
    bufferedSignals: signalsBuffer.length,
    tiersSupported: ["webrtc_p2p", "websocket_broadcast", "http_polling"]
  });
});

// -------------------------------------------------------------
// 6. Telegram Bot & Phone Auth Backend Endpoint Service
// -------------------------------------------------------------
const serverAuthorizedPhones = new Set<string>();
const DISALLOWED_DEFAULT_PHONES = new Set(['13900000000', '13800138000', '18888888888', '13800138001', '13800138002']);

function normalizeServerPhone(phone: any): string {
  if (!phone) return '';
  let cleaned = String(phone).trim().replace(/[^\d]/g, '');
  if (cleaned.length === 13 && cleaned.startsWith('861')) {
    cleaned = cleaned.substring(2);
  }
  return cleaned;
}

app.all("/api/telegram", (req, res) => {
  try {
    const action = String(req.query.action || req.body?.action || "status");
    const rawPhone = String(req.query.phone || req.body?.phone || req.query.user || req.body?.user || "");
    const cleanPhone = normalizeServerPhone(rawPhone);

    // Auto-clean disallowed default phones
    if (cleanPhone && DISALLOWED_DEFAULT_PHONES.has(cleanPhone)) {
      serverAuthorizedPhones.delete(cleanPhone);
    }

    if (action === "checkAuth") {
      const isDisallowed = !cleanPhone || DISALLOWED_DEFAULT_PHONES.has(cleanPhone) || !/^1\d{10}$/.test(cleanPhone);
      const authorized = !isDisallowed && serverAuthorizedPhones.has(cleanPhone);
      res.json({ ok: true, phone: cleanPhone, authorized });
      return;
    }

    if (action === "authlist") {
      const list = Array.from(serverAuthorizedPhones).filter(p => /^1\d{10}$/.test(p) && !DISALLOWED_DEFAULT_PHONES.has(p));
      res.json({ ok: true, list });
      return;
    }

    if (action === "auth" || action === "authorize") {
      if (cleanPhone && /^1\d{10}$/.test(cleanPhone) && !DISALLOWED_DEFAULT_PHONES.has(cleanPhone)) {
        serverAuthorizedPhones.add(cleanPhone);
      }
      const list = Array.from(serverAuthorizedPhones).filter(p => /^1\d{10}$/.test(p) && !DISALLOWED_DEFAULT_PHONES.has(p));
      res.json({ ok: true, phone: cleanPhone, list });
      return;
    }

    if (action === "unauth" || action === "revoke" || action === "deluser") {
      if (cleanPhone) {
        serverAuthorizedPhones.delete(cleanPhone);
      }
      const list = Array.from(serverAuthorizedPhones).filter(p => /^1\d{10}$/.test(p) && !DISALLOWED_DEFAULT_PHONES.has(p));
      res.json({ ok: true, phone: cleanPhone, list });
      return;
    }

    res.json({
      ok: true,
      message: "Telegram API Endpoint Service is Operational.",
      authorizedPhonesCount: serverAuthorizedPhones.size,
      list: Array.from(serverAuthorizedPhones)
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
});

// -------------------------------------------------------------
// WebSocket Server (Tier 2 WebSocket Frame Broadcast + Tier 1 Signaling)
// -------------------------------------------------------------

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  roomId: string;
  name: string;
  avatar: string;
  seatIndex: number;
}

const wsClients = new Set<ConnectedClient>();

function broadcastToRoom(roomId: string, message: any, excludeUserId?: string) {
  const targetRoom = normalizeRoomId(roomId);
  const payload = JSON.stringify(message);
  wsClients.forEach(client => {
    if (normalizeRoomId(client.roomId) === targetRoom && client.userId !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payload);
      } catch {}
    }
  });
}

function forwardSignalViaWs(signal: SignalRecord) {
  const targetRoom = normalizeRoomId(signal.roomId);
  const payload = JSON.stringify({
    type: "WEBRTC_SIGNAL",
    signal
  });
  wsClients.forEach(client => {
    if (normalizeRoomId(client.roomId) === targetRoom && client.userId === signal.targetId && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payload);
      } catch {}
    }
  });
}

// -------------------------------------------------------------
// Server Initialization with Vite Middleware & WebSocket
// -------------------------------------------------------------

async function startServer() {
  const server = http.createServer(app);

  // Initialize WebSocket Server on the same HTTP server
  const wss = new WebSocketServer({ server, path: "/api/ws" });

  wss.on("connection", (ws: WebSocket) => {
    let currentClient: ConnectedClient | null = null;

    ws.on("message", (raw: string | Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          // Player joins a voice / game room
          case "JOIN_ROOM": {
            const { roomId, userId, name, avatar, seatIndex } = msg;
            if (!roomId || !userId) return;

            const cleanRoomId = normalizeRoomId(roomId);
            currentClient = {
              ws,
              userId: String(userId),
              roomId: cleanRoomId,
              name: name || "玩家",
              avatar: avatar || "😎",
              seatIndex: typeof seatIndex === "number" ? seatIndex : 0
            };
            wsClients.add(currentClient);

            // Register in roomPeersMap
            if (!roomPeersMap.has(currentClient.roomId)) {
              roomPeersMap.set(currentClient.roomId, new Set());
            }
            roomPeersMap.get(currentClient.roomId)?.add(currentClient.userId);

            // Gather all current peers in room for WebRTC mesh initialization
            const peersInRoom = Array.from(wsClients)
              .filter(c => normalizeRoomId(c.roomId) === cleanRoomId && c.userId !== currentClient!.userId)
              .map(c => ({
                userId: c.userId,
                name: c.name,
                avatar: c.avatar,
                seatIndex: c.seatIndex
              }));

            // Notify joined client with current peer list
            ws.send(JSON.stringify({
              type: "ROOM_JOINED",
              roomId: currentClient.roomId,
              userId: currentClient.userId,
              peers: peersInRoom
            }));

            // Send current server-authoritative table state immediately
            ws.send(JSON.stringify({
              type: "TABLE_SYNC",
              table: getOrCreateTable(currentClient.roomId)
            }));

            // Notify other peers in room about new member
            broadcastToRoom(currentClient.roomId, {
              type: "PEER_JOINED",
              peer: {
                userId: currentClient.userId,
                name: currentClient.name,
                avatar: currentClient.avatar,
                seatIndex: currentClient.seatIndex
              }
            }, currentClient.userId);
            break;
          }

          // Tier 1: WebRTC Signaling (offer / answer / ice candidate)
          case "WEBRTC_SIGNAL": {
            if (!currentClient) return;
            const { targetUserId, signalType, data } = msg;
            if (!targetUserId || !signalType) return;

            const record: SignalRecord = {
              id: "sig_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
              roomId: currentClient.roomId,
              senderId: currentClient.userId,
              targetId: targetUserId,
              signalType,
              data,
              timestamp: Date.now()
            };
            forwardSignalViaWs(record);
            break;
          }

          // Tier 2: Real-time Audio Frame Broadcast
          case "VOICE_FRAME": {
            if (!currentClient) return;
            const { audioData, duration, mimeType, sequence } = msg;
            if (!audioData) return;

            const record: VoiceFrameRecord = {
              id: "vf_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
              roomId: currentClient.roomId,
              senderId: currentClient.userId,
              senderName: currentClient.name,
              senderAvatar: currentClient.avatar,
              seatIndex: currentClient.seatIndex,
              type: "voice_frame",
              audioData,
              duration: duration || 1,
              timestamp: Date.now()
            };

            // Buffer in memory for Tier 3 pollers
            voiceFramesBuffer.push(record);
            if (voiceFramesBuffer.length > 500) voiceFramesBuffer.shift();

            // Instant broadcast to all other WebSocket peers
            broadcastToRoom(currentClient.roomId, {
              type: "VOICE_FRAME_INCOMING",
              record,
              mimeType,
              sequence
            }, currentClient.userId);
            break;
          }

          // Real-time Tactical Phrase Broadcast (常用语音播报)
          case "VOICE_PHRASE": {
            if (!currentClient) return;
            const { phrase, category, icon, audioUrl } = msg;

            const record: VoiceFrameRecord = {
              id: "vp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
              roomId: currentClient.roomId,
              senderId: currentClient.userId,
              senderName: currentClient.name,
              senderAvatar: currentClient.avatar,
              seatIndex: currentClient.seatIndex,
              type: "phrase",
              phrase,
              timestamp: Date.now()
            };

            voiceFramesBuffer.push(record);
            if (voiceFramesBuffer.length > 500) voiceFramesBuffer.shift();

            broadcastToRoom(currentClient.roomId, {
              type: "VOICE_PHRASE_INCOMING",
              record,
              phrase,
              category,
              icon,
              audioUrl
            }, currentClient.userId);
            break;
          }

          // Real-time Multi-Device Chat Message Broadcast (文本, 语音条, 战术常用语, 表情)
          case "CHAT_MESSAGE": {
            if (!currentClient) return;
            const chatPayload = msg.message;
            if (!chatPayload) return;

            const record: ChatMessageRecord = {
              id: chatPayload.id || ("msg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6)),
              roomId: currentClient.roomId,
              senderId: currentClient.userId,
              senderName: chatPayload.senderName || currentClient.name,
              senderAvatar: chatPayload.senderAvatar || currentClient.avatar,
              type: chatPayload.type || "text",
              content: String(chatPayload.content || ""),
              audioUrl: chatPayload.audioUrl,
              audioDuration: chatPayload.audioDuration,
              timestamp: chatPayload.timestamp || Date.now(),
              seatIndex: typeof chatPayload.seatIndex === "number" ? chatPayload.seatIndex : currentClient.seatIndex,
              isDealer: Boolean(chatPayload.isDealer)
            };

            chatMessagesBuffer.push(record);
            if (chatMessagesBuffer.length > 300) chatMessagesBuffer.shift();

            broadcastToRoom(currentClient.roomId, {
              type: "CHAT_MESSAGE_INCOMING",
              message: record
            }, currentClient.userId);
            break;
          }

          // Speaking presence indicator (isSpeaking, volume, tier)
          case "VOICE_ACTIVITY": {
            if (!currentClient) return;
            const { isSpeaking, volume, activeTier } = msg;

            broadcastToRoom(currentClient.roomId, {
              type: "PEER_VOICE_ACTIVITY",
              userId: currentClient.userId,
              seatIndex: currentClient.seatIndex,
              isSpeaking: Boolean(isSpeaking),
              volume: Number(volume || 0),
              activeTier: activeTier || "websocket"
            }, currentClient.userId);
            break;
          }

          // Real-time table state subscription / request
          case "TABLE_SUBSCRIBE": {
            const tableRoomId = normalizeRoomId(msg.roomId || (currentClient ? currentClient.roomId : "888888"));
            if (!currentClient) {
              currentClient = {
                ws,
                userId: String(msg.userId || ("sub_" + Math.random().toString(36).slice(2, 8))),
                roomId: tableRoomId,
                name: msg.name || "牌友",
                avatar: msg.avatar || "😎",
                seatIndex: typeof msg.seatIndex === "number" ? msg.seatIndex : 0
              };
              wsClients.add(currentClient);
            } else {
              currentClient.roomId = tableRoomId;
            }
            ws.send(JSON.stringify({
              type: "TABLE_SYNC",
              table: getOrCreateTable(tableRoomId)
            }));
            break;
          }

          // Real-time table event/action pass-through
          case "TABLE_ACTION": {
            const tableRoomId = normalizeRoomId(msg.roomId || (currentClient ? currentClient.roomId : "888888"));
            const action = msg.action;
            if (action && action.type) {
              const table = getOrCreateTable(tableRoomId);
              if (action.type === "DEALER_SHUFFLE") {
                table.shuffleCount = Number(action.shuffleCount || 0);
                table.status = "shuffling";
              } else if (action.type === "DEALER_CUT") {
                table.cutSliderPos = Number(action.cutSliderPos || 50);
                table.cutCard = action.cutCard || null;
                table.status = "cutting";
              } else if (action.type === "DEALER_DEAL") {
                table.dealtHands = action.dealtHands;
                table.dealerIndex = typeof action.dealerIndex === "number" ? action.dealerIndex : table.dealerIndex;
                table.status = "arranging";
              }
              table.lastUpdated = Date.now();
              broadcastToRoom(tableRoomId, {
                type: "TABLE_ACTION",
                action,
                table
              });
              broadcastToRoom(tableRoomId, {
                type: "TABLE_SYNC",
                table
              });
            }
            break;
          }

          // Latency Ping / Pong
          case "PING": {
            ws.send(JSON.stringify({ type: "PONG", clientTimestamp: msg.timestamp, serverTimestamp: Date.now() }));
            break;
          }
        }
      } catch (err) {
        console.warn("WebSocket message parse error:", err);
      }
    });

    ws.on("close", () => {
      if (currentClient) {
        wsClients.delete(currentClient);
        roomPeersMap.get(currentClient.roomId)?.delete(currentClient.userId);

        broadcastToRoom(currentClient.roomId, {
          type: "PEER_LEFT",
          userId: currentClient.userId
        });
      }
    });

    ws.on("error", () => {
      if (currentClient) {
        wsClients.delete(currentClient);
      }
    });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[TripleVoice Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
