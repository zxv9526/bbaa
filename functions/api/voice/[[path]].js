// Cloudflare Pages Function: /api/voice/[[path]]
// Supports /api/voice/send, /api/voice/poll, /api/voice/signal
// Securely proxies to Serv00 if configured, avoiding Mixed Content blocks!

const globalVoiceFrames = [];
const globalSignals = [];

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
  const subAction = pathParts[pathParts.length - 1] || 'poll';

  // 1. POST /api/voice/send
  if (subAction === 'send' && context.request.method === 'POST') {
    try {
      const body = await context.request.json();
      const roomId = normalizeRoomId(body.roomId);
      const frame = {
        id: body.id || ('vf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
        roomId,
        senderId: String(body.senderId || ''),
        senderName: String(body.senderName || '玩家'),
        senderAvatar: String(body.senderAvatar || '😎'),
        seatIndex: body.seatIndex,
        type: body.type || 'voice_frame',
        audioData: body.audioData,
        duration: body.duration || 2,
        phrase: body.phrase,
        timestamp: Date.now()
      };

      globalVoiceFrames.push(frame);
      if (globalVoiceFrames.length > 200) globalVoiceFrames.shift();

      if (serv00Base) {
        try {
          fetch(`${serv00Base}/api/voice/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          }).catch(() => {});
        } catch {}
      }

      return new Response(JSON.stringify({ ok: true, frameId: frame.id }), { headers });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers });
    }
  }

  // 2. GET /api/voice/poll?roomId=...&userId=...&since=...
  if (subAction === 'poll' && context.request.method === 'GET') {
    const rawRoom = url.searchParams.get('roomId');
    const roomId = normalizeRoomId(rawRoom);
    const userId = url.searchParams.get('userId') || '';
    const since = parseInt(url.searchParams.get('since') || '0', 10);

    if (serv00Base) {
      try {
        const remoteRes = await fetch(`${serv00Base}/api/voice/poll?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(userId)}&since=${since}`);
        if (remoteRes.ok) {
          const data = await remoteRes.json();
          if (data && data.ok && Array.isArray(data.frames)) {
            data.frames.forEach(f => {
              if (!globalVoiceFrames.some(x => x.id === f.id)) {
                globalVoiceFrames.push(f);
              }
            });
          }
        }
      } catch {}
    }

    const newFrames = globalVoiceFrames.filter(
      f => normalizeRoomId(f.roomId) === roomId && f.senderId !== userId && f.timestamp > since
    );

    return new Response(JSON.stringify({ ok: true, timestamp: Date.now(), frames: newFrames }), { headers });
  }

  return new Response(JSON.stringify({ ok: true }), { headers });
}
