import { Card, PlayerArrangement, SpecialHandType } from '../types';
import { CarriagePoolStats, CarriageSubmission } from './carriageManager';

export interface ActiveMatchSession {
  phone: string;
  mode: 'vs_ai_8p' | 'multiplayer' | string;
  carriageId: string;
  carriageIndex: number;
  carriageSeatIndex: number;
  carriageSubmissions: { [seatIndex: number]: CarriageSubmission };
  carriageStats: CarriagePoolStats;
  originalHand: Card[];
  front: Card[];
  mid: Card[];
  back: Card[];
  pool: Card[];
  selectedCardIds: string[];
  playersInMatch: {
    id: string;
    name: string;
    isAi: boolean;
    avatar: string;
    cards: Card[];
    arrangement: PlayerArrangement;
  }[];
  specialHand: SpecialHandType | null;
  useSpecialHand: boolean;
  timestamp: number;
}

const ACTIVE_MATCH_STORAGE_KEY_PREFIX = 'thirteen_active_match_';
const GLOBAL_ACTIVE_MATCH_KEY = 'thirteen_global_active_match';

export function saveActiveMatchSession(session: ActiveMatchSession): void {
  try {
    const payload = JSON.stringify(session);
    if (session.phone) {
      localStorage.setItem(`${ACTIVE_MATCH_STORAGE_KEY_PREFIX}${session.phone}`, payload);
    }
    localStorage.setItem(GLOBAL_ACTIVE_MATCH_KEY, payload);
  } catch (e) {
    console.error('Failed to save active match session:', e);
  }
}

export function loadActiveMatchSession(phone?: string): ActiveMatchSession | null {
  try {
    let raw: string | null = null;
    if (phone) {
      raw = localStorage.getItem(`${ACTIVE_MATCH_STORAGE_KEY_PREFIX}${phone}`);
    }
    if (!raw) {
      raw = localStorage.getItem(GLOBAL_ACTIVE_MATCH_KEY);
    }

    if (!raw) return null;

    const parsed: ActiveMatchSession = JSON.parse(raw);
    if (!parsed || !parsed.originalHand || parsed.originalHand.length !== 13) {
      return null;
    }

    // 检查有效期：未结束的牌局在48小时内均可自动恢复
    const now = Date.now();
    if (parsed.timestamp && now - parsed.timestamp > 48 * 60 * 60 * 1000) {
      clearActiveMatchSession(phone);
      return null;
    }

    return parsed;
  } catch (e) {
    console.error('Failed to load active match session:', e);
    return null;
  }
}

export function clearActiveMatchSession(phone?: string): void {
  try {
    if (phone) {
      localStorage.removeItem(`${ACTIVE_MATCH_STORAGE_KEY_PREFIX}${phone}`);
    }
    localStorage.removeItem(GLOBAL_ACTIVE_MATCH_KEY);
  } catch (e) {
    console.error('Failed to clear active match session:', e);
  }
}
