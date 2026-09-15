import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";

const app = express();
const PORT = 3000;

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

interface SignalRecord {
  id: string;
  roomId: string;
  senderId: string;
  targetId: string;
  signalType: 'offer' | 'answer' | 'ice';
  data: any;
  timestamp: number;
}

const voiceFramesBuffer: VoiceFrameRecord[] = [];
const signalsBuffer: SignalRecord[] = [];
const roomPeersMap = new Map<string, Set<string>>(); // roomId -> Set of userIds

// Cleanup old frames & signals periodically (keep last 60 seconds)
setInterval(() => {
  const now = Date.now();
  while (voiceFramesBuffer.length > 0 && now - voiceFramesBuffer[0].timestamp > 60000) {
    voiceFramesBuffer.shift();
  }
  while (signalsBuffer.length > 0 && now - signalsBuffer[0].timestamp > 60000) {
    signalsBuffer.shift();
  }
}, 10000);

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
  const payload = JSON.stringify(message);
  wsClients.forEach(client => {
    if (client.roomId === roomId && client.userId !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payload);
      } catch {}
    }
  });
}

function forwardSignalViaWs(signal: SignalRecord) {
  const payload = JSON.stringify({
    type: "WEBRTC_SIGNAL",
    signal
  });
  wsClients.forEach(client => {
    if (client.roomId === signal.roomId && client.userId === signal.targetId && client.ws.readyState === WebSocket.OPEN) {
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
          // Player joins a voice room
          case "JOIN_ROOM": {
            const { roomId, userId, name, avatar, seatIndex } = msg;
            if (!roomId || !userId) return;

            currentClient = {
              ws,
              userId: String(userId),
              roomId: String(roomId),
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
              .filter(c => c.roomId === currentClient!.roomId && c.userId !== currentClient!.userId)
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
