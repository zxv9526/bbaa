/**
 * Cloudflare 环境变量自动化连接 Serv00 聊天微服务
 * 
 * 架构规范：
 * 1. 站点所有者在 Cloudflare Pages 控制台环境变量中配置 SERV00_SERVER_URL (或 SERV00_CHAT_WS_URL)
 * 2. 玩家进入游戏直接自动连接，前端绝不向普通玩家展示任何技术配置输入框或设置界面
 * 3. 前端启动时自动向 Cloudflare Pages Functions (/api/config) 获取配置并建立全双工对讲连接
 */

export interface ChatServerConfig {
  wsUrl: string;
  httpUrl: string;
  serverType: 'serv00' | 'cloudflare_default';
  isConfigured: boolean;
}

// In-Memory dynamic server config (loaded from Cloudflare Pages Functions /api/config)
let currentWsUrl = '';
let currentHttpUrl = '';
let isConfigLoaded = false;
let configSubscribers = new Set<(cfg: ChatServerConfig) => void>();

// Clean up any legacy manual input storage from older versions so players never retain old forms
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('thirteen_custom_chat_ws_url');
    localStorage.removeItem('thirteen_custom_chat_http_url');
  } catch {}
}

/**
 * Compute fallback WS URL based on build-time env or same-origin window.location
 */
function getDefaultWsUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:3000/api/ws';

  // 1. Build-time Vite environment variables injected during build
  const envWs = import.meta.env.VITE_SERV00_CHAT_WS_URL || import.meta.env.VITE_SERV00_WS_URL;
  if (envWs && String(envWs).trim()) {
    return String(envWs).trim();
  }

  const envServer = import.meta.env.VITE_SERV00_SERVER_URL || import.meta.env.VITE_SERV00_URL;
  if (envServer && String(envServer).trim()) {
    const clean = String(envServer).trim().replace(/\/+$/, '');
    if (clean.startsWith('https://')) {
      return clean.replace(/^https:\/\//, 'wss://') + '/api/ws';
    }
    if (clean.startsWith('http://')) {
      return clean.replace(/^http:\/\//, 'ws://') + '/api/ws';
    }
    return 'wss://' + clean + '/api/ws';
  }

  // 2. Default same-origin WebSocket (Cloudflare Pages Functions / Local Fullstack)
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/api/ws`;
}

/**
 * Compute fallback HTTP URL based on build-time env or same-origin
 */
function getDefaultHttpUrl(path: string = ''): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window === 'undefined') return `http://localhost:3000${cleanPath}`;

  const envHttp = import.meta.env.VITE_SERV00_CHAT_HTTP_URL;
  if (envHttp && String(envHttp).trim()) {
    const base = String(envHttp).trim().replace(/\/+$/, '');
    return `${base}${cleanPath}`;
  }

  const envServer = import.meta.env.VITE_SERV00_SERVER_URL || import.meta.env.VITE_SERV00_URL;
  if (envServer && String(envServer).trim()) {
    const base = String(envServer).trim().replace(/\/+$/, '');
    return `${base}${cleanPath}`;
  }

  return cleanPath;
}

/**
 * Returns current effective WebSocket endpoint for real-time voice and chat
 */
export function getEffectiveChatWsUrl(): string {
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    if (currentWsUrl && currentWsUrl.startsWith('wss://')) {
      return currentWsUrl.trim();
    }
    // If the WS URL is same-host ws://, we can upgrade to wss://
    if (currentWsUrl && currentWsUrl.startsWith('ws://')) {
      try {
        const parsed = new URL(currentWsUrl);
        if (parsed.host === window.location.host) {
          return currentWsUrl.replace(/^ws:\/\//, 'wss://');
        }
      } catch {}
    }
    // For external non-SSL host (e.g. serv00 custom port without TLS), fallback to same-origin wss
    const proto = 'wss:';
    return `${proto}//${window.location.host}/api/ws`;
  }
  if (currentWsUrl && currentWsUrl.trim()) {
    return currentWsUrl.trim();
  }
  return getDefaultWsUrl();
}

/**
 * Returns current effective HTTP REST API endpoint for chat polling and fallback
 */
export function getEffectiveChatHttpUrl(path: string = ''): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    // If the configured endpoint is insecure http://, browser will block it via Mixed Content.
    // Instead route via same-origin (e.g. /api/chat/...) which Cloudflare securely reverse-proxies server-to-server!
    if (currentHttpUrl && currentHttpUrl.startsWith('https://')) {
      return `${currentHttpUrl.replace(/\/+$/, '')}${cleanPath}`;
    }
    return cleanPath;
  }
  if (currentHttpUrl && currentHttpUrl.trim()) {
    return `${currentHttpUrl.replace(/\/+$/, '')}${cleanPath}`;
  }
  return getDefaultHttpUrl(cleanPath);
}

/**
 * Get current server config status
 */
export function getChatServerConfig(): ChatServerConfig {
  const ws = getEffectiveChatWsUrl();
  const http = getEffectiveChatHttpUrl('/api/chat');
  const isCustom = Boolean(currentWsUrl || import.meta.env.VITE_SERV00_SERVER_URL || import.meta.env.VITE_SERV00_CHAT_WS_URL);

  return {
    wsUrl: ws,
    httpUrl: http,
    serverType: isCustom ? 'serv00' : 'cloudflare_default',
    isConfigured: isCustom
  };
}

/**
 * Subscribe to server configuration updates
 */
export function subscribeServerConfig(cb: (cfg: ChatServerConfig) => void): () => void {
  configSubscribers.add(cb);
  return () => {
    configSubscribers.delete(cb);
  };
}

/**
 * Automatically fetch Cloudflare Pages Functions runtime configuration (/api/config)
 * Executes once on page load without any user interaction needed
 */
export async function initChatServerConfig(): Promise<ChatServerConfig> {
  if (typeof window === 'undefined') return getChatServerConfig();

  try {
    const res = await fetch('/api/config', {
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(4000)
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.ok) {
        if (data.wsUrl) currentWsUrl = data.wsUrl;
        if (data.httpUrl) currentHttpUrl = data.httpUrl;
        isConfigLoaded = true;

        const updated = getChatServerConfig();
        configSubscribers.forEach(cb => {
          try { cb(updated); } catch {}
        });

        // Broadcast to TripleVoiceEngine to reconnect if URL changed
        window.dispatchEvent(new CustomEvent('serv00_server_config_loaded', { detail: updated }));
        return updated;
      }
    }
  } catch {
    // Cloudflare Pages Functions /api/config unavailable or dev server: fall back to built-in env cleanly
  }

  isConfigLoaded = true;
  return getChatServerConfig();
}

// Run auto-fetch in background immediately on browser load
if (typeof window !== 'undefined') {
  initChatServerConfig();
}
