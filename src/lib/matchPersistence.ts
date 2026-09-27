import { Card, PlayerArrangement, SpecialHandType } from '../types';
import { CarriagePoolStats, CarriageSubmission } from './carriageManager';

export interface ActiveMatchSession {
  version?: string;
  phone: string;
  mode: 'vs_ai_8p' | 'realtime' | 'reservation' | 'practice';
  carriageId: string;
  carriageIndex: number;
  carriageSeatIndex: number;
  carriageSubmissions?: { [seatIndex: number]: CarriageSubmission };
  carriageStats?: CarriagePoolStats | null;
  originalHand: Card[];
  front: Card[];
  mid: Card[];
  back: Card[];
  pool?: Card[];
  selectedCardIds?: string[];
  playersInMatch: {
    id: string;
    name: string;
    isAi: boolean;
    avatar: string;
    cards: Card[];
    arrangement: PlayerArrangement;
  }[];
  specialHand?: SpecialHandType | null;
  useSpecialHand?: boolean;
  realtimeDealerIndex?: number;
  realtimeRound?: number;
  timestamp?: number;
}

const ACTIVE_MATCH_STORAGE_KEY_PREFIX = 'thirteen_active_match_';
const GLOBAL_ACTIVE_MATCH_KEY = 'thirteen_global_active_match';
const STORAGE_VERSION_KEY = 'thirteen_storage_version_v2';
const CURRENT_STORAGE_VERSION = '2.5.0';

/**
 * 应用启动或读取对局数据时自动触发：校验 localStorage 数据格式与版本
 * 若检测到旧版本数据结构或过期的僵尸 Session，自动执行 clearActiveMatchSession 深度清理
 */
export function validateAndCleanStorage(phone?: string): void {
  try {
    const savedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
    const now = Date.now();

    // 1. 若本地储存版本与当前最新不匹配，属于旧格式缓存，清空脏数据并升级版本号
    if (savedVersion !== CURRENT_STORAGE_VERSION) {
      clearActiveMatchSession(phone);
      localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_STORAGE_VERSION);
      return;
    }

    // 2. 检查既有 Session 数据的有效性（防止手机浏览器持久化损坏或残缺数据）
    const targetKey = phone ? `${ACTIVE_MATCH_STORAGE_KEY_PREFIX}${phone}` : GLOBAL_ACTIVE_MATCH_KEY;
    const raw = localStorage.getItem(targetKey) || localStorage.getItem(GLOBAL_ACTIVE_MATCH_KEY);

    if (raw) {
      try {
        const parsed: ActiveMatchSession = JSON.parse(raw);
        const isOldVersion = !parsed.version || parsed.version !== CURRENT_STORAGE_VERSION;
        const isCorrupted = !parsed || !Array.isArray(parsed.originalHand) || parsed.originalHand.length !== 13;
        const isExpired = Boolean(parsed.timestamp && (now - parsed.timestamp > 24 * 60 * 60 * 1000));

        if (isOldVersion || isCorrupted || isExpired) {
          clearActiveMatchSession(phone || parsed.phone);
        }
      } catch {
        clearActiveMatchSession(phone);
      }
    }
  } catch (e) {
    console.error('Failed to validate and clean storage:', e);
  }
}

export function saveActiveMatchSession(session: ActiveMatchSession): void {
  try {
    session.version = CURRENT_STORAGE_VERSION;
    session.timestamp = session.timestamp || Date.now();
    const payload = JSON.stringify(session);
    if (session.phone) {
      localStorage.setItem(`${ACTIVE_MATCH_STORAGE_KEY_PREFIX}${session.phone}`, payload);
    }
    localStorage.setItem(GLOBAL_ACTIVE_MATCH_KEY, payload);
    localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_STORAGE_VERSION);
  } catch (e) {
    console.error('Failed to save active match session:', e);
  }
}

export function loadActiveMatchSession(phone?: string): ActiveMatchSession | null {
  try {
    // 读取前先自动校验并清理过期的旧格式数据
    validateAndCleanStorage(phone);

    let raw: string | null = null;
    if (phone) {
      raw = localStorage.getItem(`${ACTIVE_MATCH_STORAGE_KEY_PREFIX}${phone}`);
    }
    if (!raw) {
      raw = localStorage.getItem(GLOBAL_ACTIVE_MATCH_KEY);
    }

    if (!raw) return null;

    const parsed: ActiveMatchSession = JSON.parse(raw);

    // 严格校验版本与数据完整性
    if (!parsed || parsed.version !== CURRENT_STORAGE_VERSION || !parsed.originalHand || parsed.originalHand.length !== 13) {
      clearActiveMatchSession(phone || parsed?.phone);
      return null;
    }

    // 检查有效期：超过24小时的僵尸 Session 自动抛弃清理
    const now = Date.now();
    if (parsed.timestamp && now - parsed.timestamp > 24 * 60 * 60 * 1000) {
      clearActiveMatchSession(phone || parsed.phone);
      return null;
    }

    return parsed;
  } catch (e) {
    console.error('Failed to load active match session:', e);
    clearActiveMatchSession(phone);
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
