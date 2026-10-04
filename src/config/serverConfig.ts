/**
 * Central Server Configuration for Realtime Chat, Voice & Table Synchronization
 * Seamlessly supports:
 * 1. Cloudflare Pages Frontend + Serv00 Node.js Backend
 * 2. Standalone Node.js Dev/Full-stack Server
 * 3. Custom Serv00 WebSocket & REST endpoints (configured via ENV or in-app settings)
 */

const STORAGE_KEY_SERVER_URL = 'serv00_server_url_override';

export interface ServerConfig {
  httpUrl: string;
  wsUrl: string;
  isCustomServ00: boolean;
}

/**
 * Get current configured Serv00 / Backend Server URL
 */
export function getCustomServerUrl(): string {
  if (typeof window === 'undefined') return '';
  const stored = localStorage.getItem(STORAGE_KEY_SERVER_URL);
  if (stored && stored.trim()) {
    return stored.trim();
  }
  // Check Vite environment variable if configured during Cloudflare build
  const envUrl = (import.meta as any).env?.VITE_SERV00_SERVER_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim();
  }
  return '';
}

/**
 * Set and persist custom Serv00 / Backend Server URL
 */
export function setCustomServerUrl(url: string) {
  if (typeof window === 'undefined') return;
  const clean = url.trim().replace(/\/+$/, '');
  if (clean) {
    localStorage.setItem(STORAGE_KEY_SERVER_URL, clean);
  } else {
    localStorage.removeItem(STORAGE_KEY_SERVER_URL);
  }
  // Dispatch notification for active engines to re-connect
  try {
    window.dispatchEvent(new CustomEvent('server_config_changed', { detail: { url: clean } }));
  } catch {}
}

/**
 * Compute the effective HTTP & WebSocket endpoints
 */
export function getServerEndpoints(): ServerConfig {
  const customUrl = getCustomServerUrl();

  if (customUrl) {
    // Normalise custom URL
    let baseUrl = customUrl;
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://') && !baseUrl.startsWith('ws://') && !baseUrl.startsWith('wss://')) {
      baseUrl = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? `https://${baseUrl}` : `http://${baseUrl}`;
    }

    let httpUrl = baseUrl;
    let wsUrl = baseUrl;

    if (baseUrl.startsWith('https://')) {
      wsUrl = baseUrl.replace('https://', 'wss://');
    } else if (baseUrl.startsWith('http://')) {
      wsUrl = baseUrl.replace('http://', 'ws://');
    } else if (baseUrl.startsWith('wss://')) {
      httpUrl = baseUrl.replace('wss://', 'https://');
    } else if (baseUrl.startsWith('ws://')) {
      httpUrl = baseUrl.replace('ws://', 'http://');
    }

    // Ensure proper WS path
    if (!wsUrl.endsWith('/api/ws') && !wsUrl.endsWith('/ws')) {
      wsUrl = `${wsUrl.replace(/\/+$/, '')}/api/ws`;
    }

    return {
      httpUrl: httpUrl.replace(/\/+$/, ''),
      wsUrl,
      isCustomServ00: true
    };
  }

  // Fallback: Current window origin / local backend
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol;
    const host = window.location.host;
    const wsProto = proto === 'https:' ? 'wss:' : 'ws:';
    return {
      httpUrl: `${proto}//${host}`,
      wsUrl: `${wsProto}//${host}/api/ws`,
      isCustomServ00: false
    };
  }

  return {
    httpUrl: 'http://localhost:3000',
    wsUrl: 'ws://localhost:3000/api/ws',
    isCustomServ00: false
  };
}

/**
 * Format a full API endpoint URL
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const config = getServerEndpoints();
  return `${config.httpUrl}${cleanPath}`;
}
