import { GameRecord, PlayerStats, RoomState } from './types';

export interface InitResponse {
  ok: boolean;
  d1Bound: boolean;
  tablesCreated?: boolean;
  message?: string;
  setupGuide?: string;
  stats?: {
    totalGames: number;
    totalPlayers: number;
  };
}

export interface StatsResponse {
  ok: boolean;
  d1Bound: boolean;
  leaderboard: PlayerStats[];
  global?: {
    totalMatches: number;
    totalSpecialHands: number;
  };
}

// Local Storage Fallback keys
const LOCAL_STORAGE_KEY_HISTORY = 'thirteen_water_history';
const LOCAL_STORAGE_KEY_PLAYERS = 'thirteen_water_players';

export class ApiClient {
  private static isD1Available: boolean | null = null;

  // 1. 初始化并自动建表
  public static async initializeDatabase(): Promise<InitResponse> {
    try {
      const res = await fetch('/api/init', { method: 'GET' });
      if (res.ok) {
        const data = (await res.json()) as InitResponse;
        this.isD1Available = data.d1Bound;
        return data;
      }
    } catch {
      // Offline / Static Preview Mode
    }

    this.isD1Available = false;
    return {
      ok: true,
      d1Bound: false,
      message: 'Running in Local Storage preview mode. On Cloudflare Pages, bind D1 database as "DB".'
    };
  }

  // 2. 记录比赛结果
  public static async recordGame(record: Omit<GameRecord, 'id' | 'createdAt'>): Promise<void> {
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.d1Bound) return;
      }
    } catch {
      // fallback
    }

    // LocalStorage Fallback
    try {
      const fullRecord: GameRecord = {
        ...record,
        id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date().toISOString()
      };
      const existingHistory: GameRecord[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_HISTORY) || '[]');
      existingHistory.unshift(fullRecord);
      localStorage.setItem(LOCAL_STORAGE_KEY_HISTORY, JSON.stringify(existingHistory.slice(0, 50)));

      // Update local player stats
      const existingPlayers: Record<string, PlayerStats> = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_PLAYERS) || '{}');
      const pName = record.playerName || 'Player';
      const isWin = record.result === 'WIN' || record.result === 'SPECIAL_WIN' ? 1 : 0;
      const isLoss = record.result === 'LOSE' ? 1 : 0;
      const isDraw = record.result === 'DRAW' ? 1 : 0;
      const isSpecial = record.specialHand ? 1 : 0;

      if (!existingPlayers[pName]) {
        existingPlayers[pName] = {
          id: pName,
          name: pName,
          totalGames: 1,
          wins: isWin,
          losses: isLoss,
          draws: isDraw,
          totalPoints: record.pointsWon,
          specialHandsCount: isSpecial
        };
      } else {
        const p = existingPlayers[pName];
        p.totalGames += 1;
        p.wins += isWin;
        p.losses += isLoss;
        p.draws += isDraw;
        p.totalPoints += record.pointsWon;
        p.specialHandsCount += isSpecial;
      }
      localStorage.setItem(LOCAL_STORAGE_KEY_PLAYERS, JSON.stringify(existingPlayers));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  // 3. 获取比赛记录
  public static async getGameHistory(playerName?: string, limit = 20): Promise<GameRecord[]> {
    try {
      const url = playerName ? `/api/history?player=${encodeURIComponent(playerName)}&limit=${limit}` : `/api/history?limit=${limit}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.d1Bound && data.records) {
          return data.records.map((r: any) => ({
            id: r.id,
            playerName: r.player_name,
            mode: r.mode,
            pointsWon: r.points_won,
            result: r.result,
            specialHand: r.special_hand,
            frontType: r.front_type,
            midType: r.mid_type,
            backType: r.back_type,
            opponentsSummary: r.opponents_summary,
            createdAt: r.created_at
          }));
        }
      }
    } catch {
      // fallback
    }

    try {
      const local = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_HISTORY) || '[]');
      if (playerName) {
        return local.filter((r: GameRecord) => r.playerName === playerName).slice(0, limit);
      }
      return local.slice(0, limit);
    } catch {
      return [];
    }
  }

  // 4. 获取排行榜 & 统计
  public static async getStats(): Promise<StatsResponse> {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        if (data.d1Bound) {
          return {
            ok: true,
            d1Bound: true,
            leaderboard: data.leaderboard.map((p: any) => ({
              id: p.id,
              name: p.name,
              totalGames: p.total_games,
              wins: p.wins,
              losses: p.losses,
              draws: p.draws,
              totalPoints: p.total_points,
              specialHandsCount: p.special_hands_count
            })),
            global: data.global
          };
        }
      }
    } catch {
      // fallback
    }

    // Local fallback
    try {
      const playersObj: Record<string, PlayerStats> = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_PLAYERS) || '{}');
      const list = Object.values(playersObj).sort((a, b) => b.totalPoints - a.totalPoints || b.wins - a.wins);
      const historyList: GameRecord[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_HISTORY) || '[]');
      return {
        ok: true,
        d1Bound: false,
        leaderboard: list.slice(0, 20),
        global: {
          totalMatches: historyList.length,
          totalSpecialHands: historyList.filter(h => !!h.specialHand).length
        }
      };
    } catch {
      return { ok: true, d1Bound: false, leaderboard: [], global: { totalMatches: 0, totalSpecialHands: 0 } };
    }
  }

  // 5. 房间管理 (联机对战)
  public static async createRoom(hostName: string, maxPlayers = 4, roomCode?: string): Promise<{ ok: boolean; roomCode?: string }> {
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', playerName: hostName, maxPlayers, roomCode })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Create room network err:', e);
    }
    return { ok: false };
  }

  public static async joinRoom(roomCode: string, playerName: string, avatar = '🀄'): Promise<{ ok: boolean; room?: RoomState; message?: string }> {
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomCode, playerName, avatar })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Join room network err:', e);
    }
    return { ok: false };
  }

  public static async pollRoom(roomCode: string): Promise<{ ok: boolean; room?: RoomState }> {
    try {
      const res = await fetch(`/api/rooms?code=${encodeURIComponent(roomCode)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // ignore
    }
    return { ok: false };
  }

  public static async submitRoomCards(roomCode: string, playerId: string, arrangement: any, cards: any): Promise<boolean> {
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', roomCode, playerId, arrangement, cards })
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
