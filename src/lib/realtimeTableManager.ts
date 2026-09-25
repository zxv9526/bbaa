import { Card, ChatMessage } from '../types';
import { getRegisteredCommunityPlayers } from './accountManager';

export interface RealtimeSeatPlayer {
  id: string; // phone or unique player id
  tabSessionId?: string; // unique browser tab / window session id
  name: string;
  avatar: string;
  isAi: boolean;
  score: number;
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
let currentRoomId = '888888';

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
        tableWs.send(JSON.stringify({
          type: 'TABLE_SUBSCRIBE',
          roomId: currentRoomId
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

// Generate guaranteed distinct player ID per device even with shared default phone
export function getPlayerUniqueId(phoneOrAccount?: string): string {
  const devId = getOrCreateDeviceId();
  const cleanPhone = (phoneOrAccount || '').trim().replace(/[^\w]/g, '');
  if (cleanPhone) {
    return `${cleanPhone}_${devId.slice(-6)}`;
  }
  return devId;
}

// Get or generate a tab/session unique identifier
export function getTabSessionId(): string {
  if (typeof window === 'undefined') return 'session_default';
  let tabId = sessionStorage.getItem('thirteen_realtime_tab_session_id');
  if (!tabId) {
    tabId = 'tab_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    sessionStorage.setItem('thirteen_realtime_tab_session_id', tabId);
  }
  return tabId;
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
    const updated = [...existing.slice(-49), msg];
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
export async function fetchRemoteChatHistory(roomId = currentRoomId): Promise<ChatMessage[]> {
  try {
    const res = await fetch(`/api/chat/history?roomId=${encodeURIComponent(roomId)}&limit=50`);
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.messages)) {
        const local = getRealtimeChatMessages();
        const map = new Map<string, ChatMessage>();
        local.forEach(m => map.set(m.id, m));
        data.messages.forEach((m: any) => {
          if (!map.has(m.id)) {
            map.set(m.id, {
              id: m.id,
              senderId: m.senderId,
              senderName: m.senderName,
              senderAvatar: m.senderAvatar,
              isUser: Boolean(m.isUser),
              type: m.type,
              content: m.content,
              audioUrl: m.audioUrl,
              audioDuration: m.audioDuration,
              timestamp: m.timestamp,
              seatIndex: m.seatIndex,
              isDealer: m.isDealer
            });
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

// Read table from localStorage
export function getSavedRealtimeTable(roomId = currentRoomId): RealtimeTableState | null {
  try {
    const raw = localStorage.getItem(TABLE_STORAGE_PREFIX + roomId);
    if (!raw) return null;
    const parsed: RealtimeTableState = JSON.parse(raw);
    if (Date.now() - (parsed.lastUpdated || 0) > 45 * 60 * 1000) {
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

// Clear table
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

// Join or Create Realtime Table (Server Authoritative with Instant Local Cache)
export function joinOrCreateRealtimeTable(currentUser: {
  id: string;
  name: string;
  avatar: string;
  tabSessionId?: string;
}, targetRoomId?: string): {
  table: RealtimeTableState;
  isNewTable: boolean;
  seatIndex: number;
  assignedUser: { id: string; name: string; avatar: string };
} {
  if (targetRoomId) {
    setCurrentRoomId(targetRoomId);
  }

  const roomId = currentRoomId;
  const tabSessionId = currentUser.tabSessionId || getTabSessionId();
  ensureTableWsConnected();

  // Async server join: Registers on backend server and broadcasts to all other devices
  fetch('/api/table/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId,
      player: {
        id: currentUser.id,
        tabSessionId,
        name: currentUser.name,
        avatar: currentUser.avatar
      }
    })
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok && data.table) {
        if (Array.isArray(data.table.seats)) {
          data.table.seats = data.table.seats.filter((s: RealtimeSeatPlayer) => !s.isAi);
        }
        saveRealtimeTable(data.table, roomId);
        broadcastEvent({ type: 'SYNC_STATE', state: data.table });
      }
    })
    .catch(() => {});

  // Local fallback response while server roundtrip finishes
  const existing = getSavedRealtimeTable(roomId);
  if (existing && Array.isArray(existing.seats) && existing.seats.length > 0) {
    const seatIdx = existing.seats.findIndex(s => s.id === currentUser.id || s.tabSessionId === tabSessionId);
    if (seatIdx !== -1) {
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

  // Create brand new table
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

// Leave table
export function leaveRealtimeTable(identifier: string): RealtimeTableState | null {
  const current = getSavedRealtimeTable();
  if (!current || !current.seats) return null;

  const idx = current.seats.findIndex(s => s.id === identifier || s.tabSessionId === identifier);
  if (idx === -1) return current;

  const leavingPlayer = current.seats[idx];
  current.seats.splice(idx, 1);

  if (current.seats.length === 0) {
    clearRealtimeTable();
  } else {
    if (current.dealerIndex >= current.seats.length || current.dealerId === leavingPlayer.id) {
      current.dealerIndex = 0;
      current.dealerId = current.seats[0]?.id || '';
    }
    current.lastAction = {
      type: 'leave',
      playerId: leavingPlayer.id,
      text: `玩家【${leavingPlayer.name}】已离开牌桌`,
      timestamp: Date.now()
    };
    saveRealtimeTable(current);
    broadcastEvent({ type: 'PLAYER_LEAVE', playerId: leavingPlayer.id, state: current });
  }

  fetch('/api/table/leave', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: currentRoomId, playerId: leavingPlayer.id })
  }).catch(() => {});

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

  // Active HTTP polling every 2.5s for seamless multi-device cross-browser state synchronization
  let lastSeenUpdated = 0;
  const pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/table/state?roomId=${encodeURIComponent(currentRoomId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.table) {
          const remoteTable: RealtimeTableState = data.table;
          if (Array.isArray(remoteTable.seats)) {
            remoteTable.seats = remoteTable.seats.filter(s => !s.isAi);
          }
          if (remoteTable.lastUpdated !== lastSeenUpdated) {
            lastSeenUpdated = remoteTable.lastUpdated;
            saveRealtimeTable(remoteTable, currentRoomId);
            onEvent({ type: 'SYNC_STATE', state: remoteTable });
          }
        }
      }
    } catch {}
  }, 2500);

  return () => {
    wsSubscribers.delete(onEvent);
    clearInterval(pollInterval);
    if (ch) {
      ch.removeEventListener('message', handleChannelMessage);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageEvent);
    }
  };
}
