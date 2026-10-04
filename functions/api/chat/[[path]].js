// Cloudflare Pages Function: /api/chat/[[path]]
// Supports /api/chat/send, /api/chat/history, /api/chat/poll
// Acts as a server-side reverse proxy to Serv00 if configured in environment, avoiding Mixed Content blocks!

const globalChatMessages = [];

function normalizeRoomId(rawRoomId) {
  if (!rawRoomId) return "666666";
  const clean = String(rawRoomId).trim().replace(/^realtime_room_/, "");
  if (clean === "8888" || clean === "888888") return "666666";
  return clean || "666666";
}

export async function onRequest(context) {
  const env = context.env || {};
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

  const url = new URL(context.request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const subAction = pathParts[pathParts.length - 1] || 'history';

  // POST /api/chat/send
  if (subAction === 'send' && context.request.method === 'POST') {
    try {
      const body = await context.request.json();
      const roomId = normalizeRoomId(body.roomId);
      const message = body.message;

      if (!message || !message.senderId) {
        return new Response(JSON.stringify({ ok: false, error: 'Missing message payload' }), { status: 400, headers });
      }

      const record = {
        id: message.id || ('msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
        roomId,
        senderId: String(message.senderId),
        senderName: String(message.senderName || '玩家'),
        senderAvatar: String(message.senderAvatar || '😎'),
        type: message.type || 'text',
        content: String(message.content || ''),
        audioUrl: message.audioUrl,
        audioDuration: message.audioDuration,
        timestamp: message.timestamp || Date.now(),
        seatIndex: message.seatIndex,
        isDealer: Boolean(message.isDealer)
      };

      globalChatMessages.push(record);
      if (globalChatMessages.length > 300) globalChatMessages.shift();

      // Server-side forward to Serv00 node if configured (server-to-server, zero Mixed Content block)
      if (serv00Base) {
        try {
          fetch(`${serv00Base}/api/chat/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, message: record })
          }).catch(() => {});
        } catch {}
      }

      return new Response(JSON.stringify({ ok: true, messageId: record.id }), { headers });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers });
    }
  }

  // GET /api/chat/history?roomId=...
  if (subAction === 'history' && context.request.method === 'GET') {
    const rawRoom = url.searchParams.get('roomId');
    const roomId = normalizeRoomId(rawRoom);
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10));

    // Try fetching from Serv00 if configured
    if (serv00Base) {
      try {
        const remoteRes = await fetch(`${serv00Base}/api/chat/history?roomId=${encodeURIComponent(roomId)}&limit=${limit}`);
        if (remoteRes.ok) {
          const data = await remoteRes.json();
          if (data && data.ok && Array.isArray(data.messages)) {
            data.messages.forEach(m => {
              if (!globalChatMessages.some(x => x.id === m.id)) {
                globalChatMessages.push(m);
              }
            });
          }
        }
      } catch {}
    }

    const messages = globalChatMessages
      .filter(m => normalizeRoomId(m.roomId) === roomId)
      .slice(-limit);

    return new Response(JSON.stringify({ ok: true, messages }), { headers });
  }

  // GET /api/chat/poll?roomId=...&userId=...&since=...
  if (subAction === 'poll' && context.request.method === 'GET') {
    const rawRoom = url.searchParams.get('roomId');
    const roomId = normalizeRoomId(rawRoom);
    const userId = url.searchParams.get('userId') || '';
    const since = parseInt(url.searchParams.get('since') || '0', 10);

    // Fetch from Serv00 if configured
    if (serv00Base) {
      try {
        const remoteRes = await fetch(`${serv00Base}/api/chat/poll?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(userId)}&since=${since}`);
        if (remoteRes.ok) {
          const data = await remoteRes.json();
          if (data && data.ok && Array.isArray(data.messages)) {
            data.messages.forEach(m => {
              if (!globalChatMessages.some(x => x.id === m.id)) {
                globalChatMessages.push(m);
              }
            });
          }
        }
      } catch {}
    }

    const newMessages = globalChatMessages.filter(
      m => normalizeRoomId(m.roomId) === roomId && m.senderId !== userId && m.timestamp > since
    );

    return new Response(JSON.stringify({ ok: true, timestamp: Date.now(), messages: newMessages }), { headers });
  }

  return new Response(JSON.stringify({ ok: true }), { headers });
}

