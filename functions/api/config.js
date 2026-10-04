// Cloudflare Pages Function: /api/config
// Returns dynamic runtime server environment variables configured in Cloudflare Pages dashboard
// (Settings -> Environment variables -> SERV00_SERVER_URL or SERV00_CHAT_WS_URL)

export async function onRequest(context) {
  const env = context.env || {};

  const headers = {
    'Content-Type': 'application/json;charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=60', // cache for 1 min
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // 1. Check Cloudflare environment variables
  const rawServer = env.SERV00_SERVER_URL || env.VITE_SERV00_SERVER_URL || env.SERV00_URL || '';
  const rawWs = env.SERV00_CHAT_WS_URL || env.VITE_SERV00_CHAT_WS_URL || env.SERV00_WS_URL || '';
  const rawHttp = env.SERV00_CHAT_HTTP_URL || env.VITE_SERV00_CHAT_HTTP_URL || '';

  let wsUrl = '';
  let httpUrl = '';

  if (rawWs && rawWs.trim()) {
    wsUrl = rawWs.trim();
  }

  if (rawHttp && rawHttp.trim()) {
    httpUrl = rawHttp.trim().replace(/\/+$/, '');
  }

  // If server URL is provided (e.g., "http://username.serv00.net:28542" or "https://chat.domain.com")
  if (rawServer && rawServer.trim()) {
    const cleanServer = rawServer.trim().replace(/\/+$/, '');
    if (!httpUrl) {
      httpUrl = cleanServer;
    }
    if (!wsUrl) {
      if (cleanServer.startsWith('https://')) {
        wsUrl = cleanServer.replace(/^https:\/\//, 'wss://') + '/api/ws';
      } else if (cleanServer.startsWith('http://')) {
        wsUrl = cleanServer.replace(/^http:\/\//, 'ws://') + '/api/ws';
      } else {
        wsUrl = 'wss://' + cleanServer + '/api/ws';
      }
    }
  }

  // If wsUrl exists but no httpUrl, derive httpUrl
  if (wsUrl && !httpUrl) {
    try {
      httpUrl = wsUrl
        .replace(/^wss:\/\//, 'https://')
        .replace(/^ws:\/\//, 'http://')
        .replace(/\/api\/ws\/?$/, '')
        .replace(/\/ws\/?$/, '')
        .replace(/\/+$/, '');
    } catch {}
  }

  const hasServ00 = Boolean(wsUrl || httpUrl);

  return new Response(
    JSON.stringify({
      ok: true,
      hasServ00,
      wsUrl,
      httpUrl,
      serverType: hasServ00 ? 'serv00' : 'cloudflare_default'
    }),
    { headers }
  );
}
