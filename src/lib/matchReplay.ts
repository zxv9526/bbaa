import { Card, SpecialHandType, PlayerArrangement } from '../types';

export interface DetailedDunEvaluation {
  typeName: string;
  desc: string;
  bonus: number;
}

export interface PlayerReplayData {
  id: string;
  name: string;
  avatar: string;
  isAi: boolean;
  isMe: boolean;
  specialHand?: SpecialHandType | null;
  front: Card[];
  mid: Card[];
  back: Card[];
  frontEval?: DetailedDunEvaluation;
  midEval?: DetailedDunEvaluation;
  backEval?: DetailedDunEvaluation;
  finalScore: number;
  isHomeRun?: boolean;
}

export interface MatchReplayItem {
  id: string;
  phone: string;
  timestamp: number;
  mode: 'vs_ai_8p' | 'multiplayer' | string;
  carriageIndex: number;
  myScore: number;
  players: PlayerReplayData[];
  summaryText: string;
}

const REPLAY_KEY_PREFIX = 'thirteen_replay_history_';

export function saveMatchReplay(phone: string, replay: Omit<MatchReplayItem, 'id' | 'timestamp'>): void {
  try {
    const key = `${REPLAY_KEY_PREFIX}${phone || 'guest'}`;
    const raw = localStorage.getItem(key);
    let list: MatchReplayItem[] = raw ? JSON.parse(raw) : [];

    const newItem: MatchReplayItem = {
      ...replay,
      id: `replay_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now()
    };

    // 保留最近 20 局对局复盘
    list = [newItem, ...list].slice(0, 20);
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save match replay:', e);
  }
}

export function getMatchReplays(phone: string): MatchReplayItem[] {
  try {
    const key = `${REPLAY_KEY_PREFIX}${phone || 'guest'}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const list: MatchReplayItem[] = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function clearMatchReplays(phone: string): void {
  try {
    const key = `${REPLAY_KEY_PREFIX}${phone || 'guest'}`;
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
