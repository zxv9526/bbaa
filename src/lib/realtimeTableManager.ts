import { Card, ChatMessage } from '../types';
import { createDeck, createDoubleDeck, shuffle } from '../gameLogic';
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
    type: 'shuffle' | 'cut' | 'deal' | 'join' | 'leave' | 'next_round' | 'rotate_dealer';
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

const TABLE_STORAGE_KEY = 'thirteen_realtime_arena_active_table';
const TABLE_CHAT_STORAGE_KEY = 'thirteen_realtime_arena_chat_messages';
const CHANNEL_NAME = 'thirteen_realtime_table_sync_channel';

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

// Get or generate a tab/session unique identifier (survives page refresh within the same tab, unique per tab)
export function getTabSessionId(): string {
  if (typeof window === 'undefined') return 'session_default';
  let tabId = sessionStorage.getItem('thirteen_realtime_tab_session_id');
  if (!tabId) {
    tabId = 'tab_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    sessionStorage.setItem('thirteen_realtime_tab_session_id', tabId);
  }
  return tabId;
}

// Read table chat messages from localStorage
export function getRealtimeChatMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(TABLE_CHAT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

// Save chat message & broadcast to table
export function saveAndBroadcastChatMessage(msg: ChatMessage): void {
  try {
    const existing = getRealtimeChatMessages();
    const updated = [...existing.slice(-49), msg]; // Keep latest 50 messages
    localStorage.setItem(TABLE_CHAT_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  broadcastEvent({ type: 'CHAT_MESSAGE', message: msg });
}

// Clear table chat messages
export function clearRealtimeChatMessages(): void {
  try {
    localStorage.removeItem(TABLE_CHAT_STORAGE_KEY);
  } catch {}
}

// Fetch remote chat history and merge with local storage
export async function fetchRemoteChatHistory(roomId = 'default_table'): Promise<ChatMessage[]> {
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

// Read table from localStorage
export function getSavedRealtimeTable(): RealtimeTableState | null {
  try {
    const raw = localStorage.getItem(TABLE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: RealtimeTableState = JSON.parse(raw);
    // Discard tables inactive for > 30 minutes
    if (Date.now() - (parsed.lastUpdated || 0) > 30 * 60 * 1000) {
      localStorage.removeItem(TABLE_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// Save table to localStorage
export function saveRealtimeTable(state: RealtimeTableState): void {
  try {
    state.lastUpdated = Date.now();
    localStorage.setItem(TABLE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

// Clear table
export function clearRealtimeTable(): void {
  try {
    localStorage.removeItem(TABLE_STORAGE_KEY);
    localStorage.removeItem(TABLE_CHAT_STORAGE_KEY);
    const ch = getChannel();
    if (ch) {
      ch.postMessage({ type: 'RESET_TABLE', state: null });
    }
  } catch {
    // ignore
  }
}

// Join or Create Realtime Table
export function joinOrCreateRealtimeTable(currentUser: {
  id: string;
  name: string;
  avatar: string;
  tabSessionId?: string;
}): {
  table: RealtimeTableState;
  isNewTable: boolean;
  seatIndex: number;
  assignedUser: { id: string; name: string; avatar: string };
} {
  const tabSessionId = currentUser.tabSessionId || getTabSessionId();
  const existing = getSavedRealtimeTable();
  const isStale = existing ? (Date.now() - (existing.lastUpdated || 0) > 15 * 60 * 1000) : true;

  // 1. If an active table exists and is not stale, join or restore seat
  if (existing && Array.isArray(existing.seats) && existing.seats.length > 0 && !isStale) {
    // Check if this specific tab already occupies a seat (e.g. page refresh)
    const seatByTab = existing.seats.findIndex(s => s.tabSessionId === tabSessionId);
    if (seatByTab !== -1) {
      const seatedPlayer = existing.seats[seatByTab];
      existing.lastUpdated = Date.now();
      saveRealtimeTable(existing);
      return {
        table: existing,
        isNewTable: false,
        seatIndex: seatByTab,
        assignedUser: { id: seatedPlayer.id, name: seatedPlayer.name, avatar: seatedPlayer.avatar }
      };
    }

    // New player joining existing table (< 8 players allowed)
    if (existing.seats.length < 8) {
      const occupiedIds = new Set(existing.seats.map(s => s.id));
      let assignedId = currentUser.id;
      let assignedName = currentUser.name;
      let assignedAvatar = currentUser.avatar;

      // If the current account ID is already occupied by an earlier tab/player, assign distinct profile
      if (occupiedIds.has(assignedId)) {
        const community = getRegisteredCommunityPlayers();
        const nextAvailable = community.find(c => !occupiedIds.has(c.phone) && !occupiedIds.has(c.id));
        if (nextAvailable) {
          assignedId = nextAvailable.phone || nextAvailable.id;
          assignedName = nextAvailable.nickname;
          assignedAvatar = nextAvailable.avatar;
        } else {
          const seatNum = existing.seats.length + 1;
          assignedId = `player_${seatNum}_${tabSessionId.slice(-4)}`;
          assignedName = `牌友${seatNum}`;
          assignedAvatar = '🦁';
        }
      }

      const newSeatIndex = existing.seats.length;
      const newPlayer: RealtimeSeatPlayer = {
        id: assignedId,
        tabSessionId,
        name: `${assignedName.replace(/\(\d+号位\)/g, '').trim()} (${newSeatIndex + 1}号位)`,
        avatar: assignedAvatar,
        isAi: false,
        score: 0
      };

      existing.seats.push(newPlayer);
      existing.lastAction = {
        type: 'join',
        playerId: assignedId,
        text: `玩家【${assignedName}】入座第 ${newSeatIndex + 1} 席 (绿色 🟢)！`,
        timestamp: Date.now()
      };
      existing.lastUpdated = Date.now();

      saveRealtimeTable(existing);
      broadcastEvent({ type: 'PLAYER_JOIN', player: newPlayer, state: existing });
      return {
        table: existing,
        isNewTable: false,
        seatIndex: newSeatIndex,
        assignedUser: { id: assignedId, name: assignedName, avatar: assignedAvatar }
      };
    }
  }

  // 2. Otherwise create a clean brand new table with currentUser as Seat 1 and Dealer
  const firstPlayer: RealtimeSeatPlayer = {
    id: currentUser.id,
    tabSessionId,
    name: `${currentUser.name.replace(/\(\d+号位\)/g, '').trim()} (1号位)`,
    avatar: currentUser.avatar,
    isAi: false,
    score: 0
  };

  const newTable: RealtimeTableState = {
    tableId: `table_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
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
      text: `玩家【${currentUser.name}】进入实时场锁定 1号位 (庄家)，等待其他玩家加入！`,
      timestamp: Date.now()
    },
    lastUpdated: Date.now()
  };

  saveRealtimeTable(newTable);
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
    return null;
  }

  // If the leaving player was the dealer, rotate to seat 0
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
  current.lastUpdated = Date.now();

  saveRealtimeTable(current);
  broadcastEvent({ type: 'PLAYER_LEAVE', playerId: leavingPlayer.id, state: current });
  return current;
}

// Broadcast an event across tabs and storage
export function broadcastEvent(event: RealtimeTableEvent): void {
  const ch = getChannel();
  if (ch) {
    try {
      ch.postMessage(event);
    } catch {
      // ignore
    }
  }
}

// Dealer actions (strictly validated by dealerId)
export function broadcastDealerShuffle(
  shuffleCount: number,
  dealerId: string
): boolean {
  const current = getSavedRealtimeTable();
  if (!current) return false;

  const expectedDealer = current.seats[current.dealerIndex];
  if (expectedDealer && expectedDealer.id !== dealerId && current.dealerId !== dealerId) {
    console.warn('[RealtimeTable] Non-dealer attempted shuffle:', dealerId);
    return false;
  }

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
  return true;
}

export function broadcastDealerCut(
  cutSliderPos: number,
  cutCard: Card,
  dealerId: string
): boolean {
  const current = getSavedRealtimeTable();
  if (!current) return false;

  const expectedDealer = current.seats[current.dealerIndex];
  if (expectedDealer && expectedDealer.id !== dealerId && current.dealerId !== dealerId) {
    console.warn('[RealtimeTable] Non-dealer attempted cut:', dealerId);
    return false;
  }

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
  return true;
}

export function broadcastDealerDeal(
  dealtHands: { [playerId: string]: Card[] },
  dealerIndex: number,
  dealerId: string
): boolean {
  const current = getSavedRealtimeTable();
  if (!current) return false;

  const expectedDealer = current.seats[current.dealerIndex];
  if (expectedDealer && expectedDealer.id !== dealerId && current.dealerId !== dealerId) {
    console.warn('[RealtimeTable] Non-dealer attempted deal:', dealerId);
    return false;
  }

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

  return current;
}

// Subscribe to table events and storage updates
export function subscribeRealtimeTable(
  onEvent: (event: RealtimeTableEvent) => void
): () => void {
  const ch = getChannel();

  const handleChannelMessage = (e: MessageEvent) => {
    if (e.data && e.data.type) {
      onEvent(e.data as RealtimeTableEvent);
    }
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === TABLE_STORAGE_KEY && e.newValue) {
      try {
        const state: RealtimeTableState = JSON.parse(e.newValue);
        onEvent({ type: 'SYNC_STATE', state });
      } catch {
        // ignore
      }
    }
  };

  if (ch) {
    ch.addEventListener('message', handleChannelMessage);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageEvent);
  }

  return () => {
    if (ch) {
      ch.removeEventListener('message', handleChannelMessage);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageEvent);
    }
  };
}
