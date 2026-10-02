// Cloudflare Pages Function: /api/chat/[[path]]
// Supports /api/chat/send, /api/chat/history, /api/chat/poll

const globalChatMessages = [];

function normalizeRoomId(rawRoomId) {
  if (!rawRoomId) return "666666";
  const clean = String(rawRoomId).trim().replace(/^realtime_room_/, "");
  if (clean === "8888" || clean === "888888") return "666666";
  return clean || "666666";
}

export async function onRequest(context) {
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

    const newMessages = globalChatMessages.filter(
      m => normalizeRoomId(m.roomId) === roomId && m.senderId !== userId && m.timestamp > since
    );

    return new Response(JSON.stringify({ ok: true, timestamp: Date.now(), messages: newMessages }), { headers });
  }

  return new Response(JSON.stringify({ ok: true }), { headers });
}
