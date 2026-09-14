import { Card } from '../types';
import { createDeck, createDoubleDeck, shuffle } from '../gameLogic';

export interface RealtimeSeatPlayer {
  id: string; // phone or unique player id
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
  | { type: 'RESET_TABLE'; state: RealtimeTableState };

const TABLE_STORAGE_KEY = 'thirteen_realtime_arena_active_table';
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
}): { table: RealtimeTableState; isNewTable: boolean; seatIndex: number } {
  const existing = getSavedRealtimeTable();
  const userId = currentUser.id;

  // Stale or AI-only cleanup: if table only has AI or inactive for > 5 min, reset cleanly
  const hasOtherRealHuman = existing?.seats?.some(s => s.id !== userId && !s.isAi);
  const isStale = existing ? (Date.now() - (existing.lastUpdated || 0) > 5 * 60 * 1000) : true;

  if (existing && existing.seats && existing.seats.length > 0 && hasOtherRealHuman && !isStale) {
    // 1. Check if currentUser is already in the seats
    const seatIdx = existing.seats.findIndex(s => s.id === userId);
    if (seatIdx !== -1) {
      // Update info in existing seat
      existing.seats[seatIdx].name = currentUser.name;
      existing.seats[seatIdx].avatar = currentUser.avatar;
      saveRealtimeTable(existing);
      broadcastEvent({ type: 'SYNC_STATE', state: existing });
      return { table: existing, isNewTable: false, seatIndex: seatIdx };
    }

    // 2. If table is not full (< 8 players), add as the next seated player in order
    if (existing.seats.length < 8) {
      const newSeatIndex = existing.seats.length;
      const newPlayer: RealtimeSeatPlayer = {
        id: userId,
        name: currentUser.name,
        avatar: currentUser.avatar,
        isAi: false,
        score: 0
      };

      existing.seats.push(newPlayer);
      existing.lastAction = {
        type: 'join',
        playerId: userId,
        text: `牌友【${currentUser.name}】已入座第 ${newSeatIndex + 1} 席！`,
        timestamp: Date.now()
      };

      saveRealtimeTable(existing);
      broadcastEvent({ type: 'PLAYER_JOIN', player: newPlayer, state: existing });
      return { table: existing, isNewTable: false, seatIndex: newSeatIndex };
    }
  }

  // 3. Otherwise, create a clean brand new table with currentUser as Seat 1 and Dealer
  const newTable: RealtimeTableState = {
    tableId: `table_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    round: 1,
    dealerIndex: 0,
    dealerId: userId,
    status: 'waiting',
    seats: [
      {
        id: userId,
        name: currentUser.name,
        avatar: currentUser.avatar,
        isAi: false,
        score: 0
      }
    ],
    shuffleCount: 0,
    cutSliderPos: 50,
    cutCard: null,
    lastAction: {
      type: 'join',
      playerId: userId,
      text: `玩家【${currentUser.name}】入座 1号位，等待其他玩家加入！`,
      timestamp: Date.now()
    },
    lastUpdated: Date.now()
  };

  saveRealtimeTable(newTable);
  broadcastEvent({ type: 'SYNC_STATE', state: newTable });
  return { table: newTable, isNewTable: true, seatIndex: 0 };
}

// Leave table
export function leaveRealtimeTable(userId: string): RealtimeTableState | null {
  const current = getSavedRealtimeTable();
  if (!current) return null;

  const idx = current.seats.findIndex(s => s.id === userId);
  if (idx === -1) return current;

  current.seats.splice(idx, 1);

  if (current.seats.length === 0) {
    clearRealtimeTable();
    return null;
  }

  // If the leaving player was the dealer, rotate to next available seated player
  if (current.dealerIndex >= current.seats.length || current.dealerId === userId) {
    current.dealerIndex = 0;
    current.dealerId = current.seats[0].id;
  }

  current.lastAction = {
    type: 'leave',
    playerId: userId,
    text: `玩家已离开席位`,
    timestamp: Date.now()
  };

  saveRealtimeTable(current);
  broadcastEvent({ type: 'PLAYER_LEAVE', playerId: userId, state: current });
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
