import { Card, ChatMessage } from '../types';
import { getRegisteredCommunityPlayers } from './accountManager';

export interface RealtimeSeatPlayer {
  id: string; // phone or unique player id
  tabSessionId?: string; // unique browser tab / window session id
  name: string;
  avatar: string;
  isAi: boolean;
  score: number;
  seatIndex?: number; // 0-7: 0-based fixed seat index
  seatNumber?: number; // 1-8: 1-based display seat number
  lastActive?: number;
}

export interface RealtimeTableState {
  tableId: string;
  roomId?: string;
  roomName?: string;
  round: number;
  dealerIndex: number; // 0-based seat index for the current dealer
  dealerId: string;    // id of current dealer player
  status: 'waiting' | 'shuffling' | 'cutting' | 'dealing' | 'arranging' | 'revealing';
  seats: RealtimeSeatPlayer[];
  shuffleCount: number;
  cutSliderPos: number;
  cutCard: Card | null;
  dealtHands?: { [playerId: string]: Card[] };
  lastAction?: {
    type: string;
    playerId: string;
    text: string;
    timestamp: number;
  };
  lastUpdated: number;
}

export type RealtimeTableEvent =
  | { type: 'SYNC_STATE'; state: RealtimeTableState }
  | { type: 'PLAYER_JOIN'; player: RealtimeSeatPlayer; state: RealtimeTableState }
  | { type: 'PLAYER_LEAVE'; playerId: string; state: RealtimeTableState }
  | { type: 'DEALER_SHUFFLE'; shuffleCount: number; timestamp: number }
  | { type: 'DEALER_CUT'; cutSliderPos: number; cutCard: Card; timestamp: number }
  | { type: 'DEALER_DEAL'; dealtHands: { [playerId: string]: Card[] }; dealerIndex: number; timestamp: number }
  | { type: 'NEXT_ROUND'; round: number; dealerIndex: number; dealerId: string; state: RealtimeTableState }
  | { type: 'RESET_TABLE'; state: RealtimeTableState }
  | { type: 'CHAT_MESSAGE'; message: ChatMessage };

export interface ActiveRoomInfo {
  roomId: string;
  roomName: string;
  playerCount: number;
  maxPlayers: number;
  round: number;
  status: string;
  dealerName: string;
  lastUpdated: number;
}

const TABLE_STORAGE_PREFIX = 'thirteen_realtime_arena_table_';
const TABLE_CHAT_STORAGE_KEY = 'thirteen_realtime_arena_chat_messages';
const CHANNEL_NAME = 'thirteen_realtime_table_sync_channel';

// Current active room ID
let currentRoomId = '666666';

// Detect roomId from URL if present
if (typeof window !== 'undefined') {
  try {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('roomId');
    if (roomParam && roomParam.trim()) {
      currentRoomId = roomParam.trim();
    }
  } catch {}
}

export function getCurrentRoomId(): string {
  return currentRoomId;
}

export function setCurrentRoomId(roomId: string): void {
  if (roomId && roomId.trim()) {
    currentRoomId = roomId.trim();
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('roomId', currentRoomId);
        window.history.replaceState({}, '', url.toString());
      } catch {}
    }
  }
}

// Singleton BroadcastChannel for cross-tab and cross-window sync
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      channel = null;
    }
  }
  return channel;
}

// Shared WebSocket connection for table events
let tableWs: WebSocket | null = null;
let wsSubscribers = new Set<(event: RealtimeTableEvent) => void>();

function getWsUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:3000/api/ws';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/api/ws`;
}

function ensureTableWsConnected() {
  if (typeof window === 'undefined') return;
  if (tableWs && (tableWs.readyState === WebSocket.OPEN || tableWs.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    tableWs = new WebSocket(getWsUrl());

    tableWs.onopen = () => {
      if (tableWs && tableWs.readyState === WebSocket.OPEN) {
        const myId = getPlayerUniqueId();
        tableWs.send(JSON.stringify({
          type: 'TABLE_SUBSCRIBE',
          roomId: currentRoomId,
          userId: myId
        }));
      }
    };

    tableWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'TABLE_SYNC' && msg.table) {
          const table: RealtimeTableState = msg.table;
          // Disallow AI seats
          if (Array.isArray(table.seats)) {
            table.seats = table.seats.filter(s => !s.isAi);
          }
          saveRealtimeTable(table);
          wsSubscribers.forEach(cb => cb({ type: 'SYNC_STATE', state: table }));
        } else if (msg.type === 'TABLE_ACTION' && msg.action) {
          const action = msg.action;
          if (action.type === 'DEALER_DEAL') {
            wsSubscribers.forEach(cb => cb({
              type: 'DEALER_DEAL',
              dealtHands: action.dealtHands,
              dealerIndex: action.dealerIndex,
              timestamp: Date.now()
            }));
          } else if (action.type === 'DEALER_SHUFFLE') {
            wsSubscribers.forEach(cb => cb({
              type: 'DEALER_SHUFFLE',
              shuffleCount: action.shuffleCount,
              timestamp: Date.now()
            }));
          } else if (action.type === 'DEALER_CUT') {
            wsSubscribers.forEach(cb => cb({
              type: 'DEALER_CUT',
              cutSliderPos: action.cutSliderPos,
              cutCard: action.cutCard,
              timestamp: Date.now()
            }));
          } else if (action.type === 'NEXT_ROUND') {
            if (msg.table) {
              saveRealtimeTable(msg.table);
            }
            wsSubscribers.forEach(cb => cb({
              type: 'NEXT_ROUND',
              round: action.round,
              dealerIndex: action.dealerIndex,
              dealerId: action.dealerId,
              state: msg.table
            }));
          }
        } else if (msg.type === 'PLAYER_JOIN' && msg.player && msg.table) {
          saveRealtimeTable(msg.table);
          wsSubscribers.forEach(cb => cb({ type: 'PLAYER_JOIN', player: msg.player, state: msg.table }));
        } else if (msg.type === 'PLAYER_LEAVE' && msg.table) {
          saveRealtimeTable(msg.table);
          wsSubscribers.forEach(cb => cb({ type: 'PLAYER_LEAVE', playerId: msg.playerId, state: msg.table }));
        } else if ((msg.type === 'CHAT_MESSAGE_INCOMING' || msg.type === 'CHAT_MESSAGE') && msg.message) {
          wsSubscribers.forEach(cb => cb({ type: 'CHAT_MESSAGE', message: msg.message }));
        }
      } catch {}
    };

    tableWs.onclose = () => {
      tableWs = null;
      setTimeout(ensureTableWsConnected, 3000);
    };

    tableWs.onerror = () => {
      tableWs = null;
    };
  } catch {}
}

// Send action or event via WebSocket
export function sendTableWs(data: any): void {
  if (tableWs && tableWs.readyState === WebSocket.OPEN) {
    try {
      tableWs.send(JSON.stringify(data));
    } catch {}
  }
}

// Runtime unique tab instance token (in-memory, guaranteed never duplicated across tabs/windows)
let runtimeTabInstanceNonce = '';
if (typeof window !== 'undefined') {
  if (!(window as any).__thirteen_runtime_tab_nonce) {
    (window as any).__thirteen_runtime_tab_nonce = 'tab_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  runtimeTabInstanceNonce = (window as any).__thirteen_runtime_tab_nonce;
}

// Get or generate a persistent device unique identifier
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'srv_' + Math.random().toString(36).slice(2, 8);
  let devId = localStorage.getItem('thirteen_device_unique_id');
  if (!devId) {
    devId = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('thirteen_device_unique_id', devId);
  }
  return devId;
}

// Get or generate a tab/session unique identifier (isolated per browser window/tab/phone)
export function getTabSessionId(): string {
  if (typeof window === 'undefined') return 'session_default';
  return runtimeTabInstanceNonce || 'session_' + Math.random().toString(36).slice(2, 8);
}

// Directly use the user's authentic mobile phone number (or stable distinct tab session) as player ID
export function getPlayerUniqueId(phoneOrAccount?: string): string {
  const cleanPhone = (phoneOrAccount || '').trim().replace(/[^\w]/g, '');
  if (cleanPhone && /^1\d{10}$/.test(cleanPhone)) {
    return cleanPhone;
  }
  const tabId = getTabSessionId();
  return 'u_' + (cleanPhone || 'guest') + '_' + tabId;
}

// Read table chat messages
export function getRealtimeChatMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(TABLE_CHAT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

// Save chat message & broadcast
export function saveAndBroadcastChatMessage(msg: ChatMessage): void {
  try {
    const existing = getRealtimeChatMessages();
    const map = new Map<string, ChatMessage>();
    existing.forEach(m => map.set(m.id, m));
    map.set(msg.id, msg);
    const updated = Array.from(map.values()).slice(-60);
    localStorage.setItem(TABLE_CHAT_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  broadcastEvent({ type: 'CHAT_MESSAGE', message: msg });

  // Post to server chat API
  fetch('/api/chat/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: currentRoomId, message: msg })
  }).catch(() => {});
}

// Clear table chat messages
export function clearRealtimeChatMessages(): void {
  try {
    localStorage.removeItem(TABLE_CHAT_STORAGE_KEY);
  } catch {}
}

// Fetch remote chat history
export async function fetchRemoteChatHistory(roomId = currentRoomId, currentUserId?: string): Promise<ChatMessage[]> {
  try {
    const res = await fetch(`/api/chat/history?roomId=${encodeURIComponent(roomId)}&limit=50`);
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.messages)) {
        const local = getRealtimeChatMessages();
        const map = new Map<string, ChatMessage>();
        local.forEach(m => map.set(m.id, m));
        data.messages.forEach((m: any) => {
          const isUser = currentUserId ? m.senderId === currentUserId : Boolean(m.isUser);
          if (!map.has(m.id)) {
            map.set(m.id, {
              id: m.id,
              senderId: m.senderId,
              senderName: m.senderName,
              senderAvatar: m.senderAvatar,
              isUser,
              type: m.type,
              content: m.content,
              audioUrl: m.audioUrl,
              audioDuration: m.audioDuration,
              timestamp: m.timestamp,
              seatIndex: m.seatIndex,
              isDealer: m.isDealer
            });
          } else {
            // Update isUser if currentUserId is now known
            const existing = map.get(m.id)!;
            existing.isUser = isUser;
          }
        });
        const merged = Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp).slice(-50);
        localStorage.setItem(TABLE_CHAT_STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    }
  } catch {}
  return getRealtimeChatMessages();
}

// Fetch active rooms from server
export async function fetchActiveRooms(): Promise<ActiveRoomInfo[]> {
  try {
    const res = await fetch('/api/table/rooms');
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.rooms)) {
        return data.rooms;
      }
    }
  } catch {}
  return [{
    roomId: '888888',
    roomName: '竞技大厅 888888',
    playerCount: 1,
    maxPlayers: 8,
    round: 1,
    status: 'waiting',
    dealerName: '待入座',
    lastUpdated: Date.now()
  }];
}

// Clear all stale local storage caches for realtime tables
export function clearAllRealtimeCaches(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(TABLE_STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch {}
}

// Read table from localStorage (Strict 1.5-second validity for mobile browsers)
export function getSavedRealtimeTable(roomId = currentRoomId): RealtimeTableState | null {
  try {
    const raw = localStorage.getItem(TABLE_STORAGE_PREFIX + roomId);
    if (!raw) return null;
    const parsed: RealtimeTableState = JSON.parse(raw);
    if (Date.now() - (parsed.lastUpdated || 0) > 1500) {
      localStorage.removeItem(TABLE_STORAGE_PREFIX + roomId);
      return null;
    }
    if (Array.isArray(parsed.seats)) {
      parsed.seats = parsed.seats.filter(s => !s.isAi);
    }
    return parsed;
  } catch {
    return null;
  }
}

// Save table to localStorage
export function saveRealtimeTable(state: RealtimeTableState, roomId = currentRoomId): void {
  try {
    state.lastUpdated = Date.now();
    localStorage.setItem(TABLE_STORAGE_PREFIX + (state.roomId || roomId), JSON.stringify(state));
  } catch {}
}

// Clear table locally and notify
export function clearRealtimeTable(roomId = currentRoomId): void {
  try {
    localStorage.removeItem(TABLE_STORAGE_PREFIX + roomId);
    localStorage.removeItem(TABLE_CHAT_STORAGE_KEY);
    const ch = getChannel();
    if (ch) {
      ch.postMessage({ type: 'RESET_TABLE', state: null });
    }
  } catch {}
}

// Force reset server table & clear all seats
export async function resetServerTable(roomId = currentRoomId): Promise<boolean> {
  clearRealtimeTable(roomId);
  clearAllRealtimeCaches();
  try {
    const res = await fetch('/api/table/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId })
    });
    if (res.ok) {
      const data = await res.json();
      return data.ok;
    }
  } catch {}
  return false;
}

// Clean inactive zombie seats on server
export async function cleanStaleServerSeats(roomId = currentRoomId): Promise<number> {
  try {
    const res = await fetch('/api/table/clean_stale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && typeof data.cleanedCount === 'number') {
        return data.cleanedCount;
      }
    }
  } catch {}
  return 0;
}

// Fetch authoritative realtime table state for lobby seats display
export async function fetchRealtimeRoomState(roomId = currentRoomId): Promise<RealtimeTableState | null> {
  try {
    const res = await fetch(`/api/table/state?roomId=${encodeURIComponent(roomId)}&_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.table) {
        return data.table;
      }
    }
  } catch {}
  return getSavedRealtimeTable(roomId);
}

// Join or Create Realtime Table (Server Authoritative with Specific Target Seat)
export async function joinOrCreateRealtimeTable(currentUser: {
  id: string;
  name: string;
  avatar: string;
  tabSessionId?: string;
}, targetRoomId?: string, targetSeatIndex?: number): Promise<{
  table: RealtimeTableState;
  isNewTable: boolean;
  seatIndex: number;
  assignedUser: { id: string; name: string; avatar: string };
}> {
  if (targetRoomId) {
    setCurrentRoomId(targetRoomId);
  }

  const roomId = currentRoomId;
  const tabSessionId = currentUser.tabSessionId || getTabSessionId();
  const deviceId = getOrCreateDeviceId();
  ensureTableWsConnected();

  // 1. Primary: Server Authoritative Join via REST API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`/api/table/join?_t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      credentials: 'include',
      body: JSON.stringify({
        roomId,
        targetSeatIndex,
        player: {
          id: currentUser.id,
          deviceId,
          tabSessionId,
          name: currentUser.name,
          avatar: currentUser.avatar
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.table) {
        if (Array.isArray(data.table.seats)) {
          data.table.seats = data.table.seats.filter((s: RealtimeSeatPlayer) => !s.isAi);
        }
        saveRealtimeTable(data.table, roomId);
        broadcastEvent({ type: 'SYNC_STATE', state: data.table });

        const mySeatIdx = typeof data.seatIndex === 'number'
          ? data.seatIndex
          : (typeof targetSeatIndex === 'number' ? targetSeatIndex : data.table.seats.findIndex((s: any) => s.id === currentUser.id || s.tabSessionId === tabSessionId || s.deviceId === deviceId));

        const assignedSeat = data.table.seats.find((s: any) => s.seatIndex === mySeatIdx) || data.table.seats[mySeatIdx] || data.table.seats[data.table.seats.length - 1];

        return {
          table: data.table,
          isNewTable: data.table.seats.length === 1,
          seatIndex: Math.max(0, mySeatIdx),
          assignedUser: {
            id: currentUser.id,
            name: assignedSeat?.name || currentUser.name,
            avatar: assignedSeat?.avatar || currentUser.avatar
          }
        };
      } else if (data.table && data.isFull) {
        // Table exists but room full -> auto clean stale zombie seats & retry join
        const cleaned = await cleanStaleServerSeats(roomId);
        if (cleaned > 0) {
          const retryRes = await fetch('/api/table/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              roomId,
              targetSeatIndex,
              player: {
                id: currentUser.id,
                deviceId,
                tabSessionId,
                name: currentUser.name,
                avatar: currentUser.avatar
              }
            })
          });
          if (retryRes.ok) {
            const retryData = await retryRes.json();
            if (retryData.ok && retryData.table) {
              if (Array.isArray(retryData.table.seats)) {
                retryData.table.seats = retryData.table.seats.filter((s: RealtimeSeatPlayer) => !s.isAi);
              }
              saveRealtimeTable(retryData.table, roomId);
              broadcastEvent({ type: 'SYNC_STATE', state: retryData.table });
              const mySeatIdx = typeof retryData.seatIndex === 'number'
                ? retryData.seatIndex
                : (typeof targetSeatIndex === 'number' ? targetSeatIndex : retryData.table.seats.findIndex((s: any) => s.id === currentUser.id || s.tabSessionId === tabSessionId || s.deviceId === deviceId));
              const assignedSeat = retryData.table.seats.find((s: any) => s.seatIndex === mySeatIdx) || retryData.table.seats[mySeatIdx] || retryData.table.seats[retryData.table.seats.length - 1];
              return {
                table: retryData.table,
                isNewTable: retryData.table.seats.length === 1,
                seatIndex: Math.max(0, mySeatIdx),
                assignedUser: {
                  id: currentUser.id,
                  name: assignedSeat?.name || currentUser.name,
                  avatar: assignedSeat?.avatar || currentUser.avatar
                }
              };
            }
          }
        }
        saveRealtimeTable(data.table, roomId);
        broadcastEvent({ type: 'SYNC_STATE', state: data.table });
      }
    }
  } catch (err) {
    console.warn('[RealtimeTable] Server join request note (using local cache):', err);
  }

  // 2. Fallback: Local Cache if server is unreachable
  const existing = getSavedRealtimeTable(roomId);
  if (existing && Array.isArray(existing.seats) && existing.seats.length > 0) {
    const seatIdx = existing.seats.findIndex(s => s.id === currentUser.id || s.tabSessionId === tabSessionId || (s as any).deviceId === deviceId);
    if (seatIdx !== -1) {
      existing.seats[seatIdx].id = currentUser.id;
      existing.seats[seatIdx].tabSessionId = tabSessionId;
      existing.seats[seatIdx].name = currentUser.name;
      existing.seats[seatIdx].avatar = currentUser.avatar;
      saveRealtimeTable(existing, roomId);
      return {
        table: existing,
        isNewTable: false,
        seatIndex: seatIdx,
        assignedUser: { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }
      };
    }

    if (existing.seats.length < 8) {
      const newSeatIndex = existing.seats.length;
      const newPlayer: RealtimeSeatPlayer = {
        id: currentUser.id,
        tabSessionId,
        name: `${currentUser.name.replace(/\(\d+号位\)/g, '').trim()} (${newSeatIndex + 1}号位)`,
        avatar: currentUser.avatar,
        isAi: false,
        score: 0
      };
      existing.seats.push(newPlayer);
      saveRealtimeTable(existing, roomId);
      broadcastEvent({ type: 'PLAYER_JOIN', player: newPlayer, state: existing });
      return {
        table: existing,
        isNewTable: false,
        seatIndex: newSeatIndex,
        assignedUser: { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }
      };
    }
  }

  // 3. Fallback: Create initial table
  const firstPlayer: RealtimeSeatPlayer = {
    id: currentUser.id,
    tabSessionId,
    name: `${currentUser.name.replace(/\(\d+号位\)/g, '').trim()} (1号位)`,
    avatar: currentUser.avatar,
    isAi: false,
    score: 0
  };

  const newTable: RealtimeTableState = {
    tableId: `table_${roomId}_${Date.now()}`,
    roomId,
    round: 1,
    dealerIndex: 0,
    dealerId: currentUser.id,
    status: 'waiting',
    seats: [firstPlayer],
    shuffleCount: 0,
    cutSliderPos: 50,
    cutCard: null,
    lastAction: {
      type: 'join',
      playerId: currentUser.id,
      text: `玩家【${currentUser.name}】进入房间 ${roomId} 入座 1号位 (庄家)！`,
      timestamp: Date.now()
    },
    lastUpdated: Date.now()
  };

  saveRealtimeTable(newTable, roomId);
  broadcastEvent({ type: 'SYNC_STATE', state: newTable });
  return {
    table: newTable,
    isNewTable: true,
    seatIndex: 0,
    assignedUser: { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }
  };
}

// Leave table (meticulously prunes local storage, notifies broadcast channel & informs server)
export async function leaveRealtimeTable(
  identifier?: string,
  targetRoomId?: string,
  extra?: { tabSessionId?: string; deviceId?: string; playerId?: string }
): Promise<RealtimeTableState | null> {
  const roomId = targetRoomId || currentRoomId || '666666';
  const playerId = identifier || extra?.playerId || '';
  const tabSessionId = extra?.tabSessionId || getTabSessionId();
  const deviceId = extra?.deviceId || getOrCreateDeviceId();

  const current = getSavedRealtimeTable(roomId);
  if (current && Array.isArray(current.seats)) {
    const remainingSeats = current.seats.filter(s => {
      const matchId = playerId && (s.id === playerId || s.id.includes(playerId) || playerId.includes(s.id));
      const matchTab = tabSessionId && s.tabSessionId === tabSessionId;
      const matchDev = deviceId && (s as any).deviceId === deviceId;
      return !(matchId || matchTab || matchDev);
    });

    current.seats = remainingSeats;
    if (current.seats.length === 0) {
      clearRealtimeTable(roomId);
    } else {
      current.seats.forEach(s => {
        if (s.name) {
          s.name = s.name.replace(/\(\d+号位\)/g, '').trim();
        }
      });
      current.dealerIndex = current.dealerIndex % current.seats.length;
      current.dealerId = current.seats[current.dealerIndex]?.id || current.seats[0].id;
      current.lastAction = {
        type: 'leave',
        playerId: playerId || 'user',
        text: `玩家已离开牌桌`,
        timestamp: Date.now()
      };
      saveRealtimeTable(current, roomId);
      broadcastEvent({ type: 'PLAYER_LEAVE', playerId: playerId || '', state: current });
    }
  }

  // Always inform server via fetch / sendBeacon so seat is guaranteed pruned on backend
  const payload = JSON.stringify({ roomId, playerId, tabSessionId, deviceId });
  try {
    const res = await fetch('/api/table/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.table) {
        saveRealtimeTable(data.table, roomId);
        return data.table;
      }
    }
  } catch {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/table/leave', blob);
    }
  }

  return current;
}

// Broadcast an event across tabs and storage
export function broadcastEvent(event: RealtimeTableEvent): void {
  const ch = getChannel();
  if (ch) {
    try {
      ch.postMessage(event);
    } catch {}
  }
  // Also forward to local WS listeners
  wsSubscribers.forEach(cb => cb(event));
}

// Dealer actions
export function broadcastDealerShuffle(
  shuffleCount: number,
  dealerId: string
): boolean {
  const current = getSavedRealtimeTable();
  if (!current) return false;

  current.shuffleCount = shuffleCount;
  current.status = 'shuffling';
  current.lastAction = {
    type: 'shuffle',
    playerId: dealerId,
    text: `庄家正在洗牌 (已洗 ${shuffleCount} 次)`,
    timestamp: Date.now()
  };

  saveRealtimeTable(current);
  broadcastEvent({ type: 'DEALER_SHUFFLE', shuffleCount, timestamp: Date.now() });

  fetch('/api/table/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: currentRoomId,
      action: { type: 'DEALER_SHUFFLE', shuffleCount, dealerId }
    })
  }).catch(() => {});

  return true;
}

export function broadcastDealerCut(
  cutSliderPos: number,
  cutCard: Card,
  dealerId: string
): boolean {
  const current = getSavedRealtimeTable();
  if (!current) return false;

  current.cutSliderPos = cutSliderPos;
  current.cutCard = cutCard;
  current.status = 'cutting';
  current.lastAction = {
    type: 'cut',
    playerId: dealerId,
    text: `庄家完成切牌 (切牌点: ${cutSliderPos}%)`,
    timestamp: Date.now()
  };

  saveRealtimeTable(current);
  broadcastEvent({ type: 'DEALER_CUT', cutSliderPos, cutCard, timestamp: Date.now() });

  fetch('/api/table/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: currentRoomId,
      action: { type: 'DEALER_CUT', cutSliderPos, cutCard, dealerId }
    })
  }).catch(() => {});

  return true;
}

export function broadcastDealerDeal(
  dealtHands: { [playerId: string]: Card[] },
  dealerIndex: number,
  dealerId: string
): boolean {
  const current = getSavedRealtimeTable();
  if (!current) return false;

  current.dealtHands = dealtHands;
  current.dealerIndex = dealerIndex;
  current.status = 'arranging';
  current.lastAction = {
    type: 'deal',
    playerId: dealerId,
    text: `庄家已发牌！全桌开始理牌`,
    timestamp: Date.now()
  };

  saveRealtimeTable(current);
  broadcastEvent({
    type: 'DEALER_DEAL',
    dealtHands,
    dealerIndex,
    timestamp: Date.now()
  });

  fetch('/api/table/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: currentRoomId,
      action: { type: 'DEALER_DEAL', dealtHands, dealerIndex, dealerId }
    })
  }).catch(() => {});

  return true;
}

// Next round dealer rotation
export function advanceToNextRealtimeRound(): RealtimeTableState | null {
  const current = getSavedRealtimeTable();
  if (!current || current.seats.length === 0) return null;

  const nextRound = current.round + 1;
  const nextDealerIndex = (current.dealerIndex + 1) % current.seats.length;
  const nextDealer = current.seats[nextDealerIndex];

  current.round = nextRound;
  current.dealerIndex = nextDealerIndex;
  current.dealerId = nextDealer?.id || current.seats[0].id;
  current.status = 'waiting';
  current.shuffleCount = 0;
  current.cutCard = null;
  current.cutSliderPos = 50;
  current.dealtHands = undefined;
  current.lastAction = {
    type: 'next_round',
    playerId: current.dealerId,
    text: `第 ${nextRound} 局开始！庄家顺延轮转至【${nextDealer?.name}】`,
    timestamp: Date.now()
  };

  saveRealtimeTable(current);
  broadcastEvent({
    type: 'NEXT_ROUND',
    round: nextRound,
    dealerIndex: nextDealerIndex,
    dealerId: current.dealerId,
    state: current
  });

  fetch('/api/table/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: currentRoomId,
      action: {
        type: 'NEXT_ROUND',
        round: nextRound,
        dealerIndex: nextDealerIndex,
        dealerId: current.dealerId
      }
    })
  }).catch(() => {});

  return current;
}

// Claim dealer role
export function claimDealerRole(userId: string): boolean {
  const current = getSavedRealtimeTable();
  if (!current || !current.seats) return false;
  const idx = current.seats.findIndex(s => s.id === userId);
  if (idx === -1) return false;

  current.dealerIndex = idx;
  current.dealerId = userId;
  current.lastAction = {
    type: 'rotate_dealer',
    playerId: userId,
    text: `玩家【${current.seats[idx].name}】已成为新庄家！`,
    timestamp: Date.now()
  };

  saveRealtimeTable(current);
  broadcastEvent({ type: 'SYNC_STATE', state: current });

  fetch('/api/table/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: currentRoomId,
      action: { type: 'CLAIM_DEALER', playerId: userId }
    })
  }).catch(() => {});

  return true;
}

// Rotate dealer role
export function rotateRealtimeDealer(newIndex: number): boolean {
  const current = getSavedRealtimeTable();
  if (!current || !current.seats || current.seats.length === 0) return false;
  const targetIndex = newIndex % current.seats.length;
  const newDealer = current.seats[targetIndex];
  if (!newDealer) return false;

  current.dealerIndex = targetIndex;
  current.dealerId = newDealer.id;
  current.lastAction = {
    type: 'rotate_dealer',
    playerId: newDealer.id,
    text: `庄家轮转至【${newDealer.name}】！`,
    timestamp: Date.now()
  };

  saveRealtimeTable(current);
  broadcastEvent({ type: 'SYNC_STATE', state: current });

  fetch('/api/table/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: currentRoomId,
      action: { type: 'ROTATE_DEALER', newDealerIndex: targetIndex, newDealerId: newDealer.id }
    })
  }).catch(() => {});

  return true;
}

// Subscribe to table events (WebSocket push + BroadcastChannel + HTTP Polling fallback)
export function subscribeRealtimeTable(
  onEvent: (event: RealtimeTableEvent) => void
): () => void {
  ensureTableWsConnected();
  wsSubscribers.add(onEvent);

  const ch = getChannel();
  const handleChannelMessage = (e: MessageEvent) => {
    if (e.data && e.data.type) {
      onEvent(e.data as RealtimeTableEvent);
    }
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === TABLE_STORAGE_PREFIX + currentRoomId && e.newValue) {
      try {
        const state: RealtimeTableState = JSON.parse(e.newValue);
        if (Array.isArray(state.seats)) {
          state.seats = state.seats.filter(s => !s.isAi);
        }
        onEvent({ type: 'SYNC_STATE', state });
      } catch {}
    }
  };

  if (ch) {
    ch.addEventListener('message', handleChannelMessage);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageEvent);
  }

  // Active HTTP polling every 1.5s for seamless multi-device cross-browser state synchronization
  let lastSeenUpdated = 0;
  let lastSeenSeatsStr = '';
  let lastChatPollTime = Date.now() - 30000;

  const runPoll = async () => {
    try {
      const myId = getPlayerUniqueId();
      const tabId = getTabSessionId();
      const res = await fetch(
        `/api/table/state?roomId=${encodeURIComponent(currentRoomId)}&playerId=${encodeURIComponent(myId)}&tabSessionId=${encodeURIComponent(tabId)}&_t=${Date.now()}`,
        { credentials: 'include', headers: { 'Cache-Control': 'no-cache' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.table) {
          const remoteTable: RealtimeTableState = data.table;
          if (Array.isArray(remoteTable.seats)) {
            remoteTable.seats = remoteTable.seats.filter(s => !s.isAi);
          }
          const seatsStr = JSON.stringify(remoteTable.seats);
          if (remoteTable.lastUpdated !== lastSeenUpdated || seatsStr !== lastSeenSeatsStr) {
            lastSeenUpdated = remoteTable.lastUpdated;
            lastSeenSeatsStr = seatsStr;
            saveRealtimeTable(remoteTable, currentRoomId);
            onEvent({ type: 'SYNC_STATE', state: remoteTable });
          }
        }
      }

      // Safeguard poll for chat messages
      const chatRes = await fetch(
        `/api/chat/poll?roomId=${encodeURIComponent(currentRoomId)}&userId=${encodeURIComponent(myId)}&since=${lastChatPollTime}&_t=${Date.now()}`,
        { credentials: 'include' }
      );
      if (chatRes.ok) {
        const chatData = await chatRes.json();
        if (chatData.ok && Array.isArray(chatData.messages) && chatData.messages.length > 0) {
          lastChatPollTime = Math.max(lastChatPollTime, ...chatData.messages.map((m: any) => m.timestamp));
          chatData.messages.forEach((m: ChatMessage) => {
            onEvent({ type: 'CHAT_MESSAGE', message: m });
          });
        }
      }
    } catch {}
  };

  // Immediate initial poll
  runPoll();
  const pollInterval = setInterval(runPoll, 1500);

  // Mobile Page Resume Handler (instant sync when phone is unlocked or app brought to foreground)
  const handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      runPoll();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  return () => {
    wsSubscribers.delete(onEvent);
    clearInterval(pollInterval);
    if (ch) {
      ch.removeEventListener('message', handleChannelMessage);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageEvent);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  };
}
