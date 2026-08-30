import { Card, PlayerArrangement, PlayerScoreDetail, UserAccount } from '../types';
import { createDeck, createDoubleDeck, shuffle, aiArrangeCards, calculate4PlayerMatchScores, calculate8PlayerMatchScores, detectSpecialHand } from '../gameLogic';
import { addPoints } from './accountManager';
import { ApiClient } from '../api';

export interface CarriageHand {
  seatIndex: number; // 0..7 (8人场) 或 0..3 (4人场)
  cards: Card[];     // 13张牌
}

export interface CarriageSubmission {
  playerId: string;
  playerName: string;
  avatar: string;
  isAi: boolean;
  arrangement: PlayerArrangement;
  cards: Card[];
  submittedAt: string;
}

export interface Carriage {
  id: string;              // e.g. "car_8p_000001" or "car_4p_000001"
  index: number;           // 局数/车厢序号 (1, 2, 3...)
  createdAt: string;
  hands: CarriageHand[];   // 8副或4副手牌
  submissions: { [seatIndex: number]: CarriageSubmission };
  status: 'unclaimed' | 'in_progress' | 'completed';
  completedAt?: string;
  matchResults?: PlayerScoreDetail[];
}

export interface CarriagePoolStats {
  totalCarriagesGenerated: number; // 累计生成总数
  unclaimedCount: number;         // 当前已发牌未领取的库存数
  inProgressCount: number;        // 进行中数
  completedCount: number;         // 已结算数
  currentPlayingIndex: number;    // 玩家当前处于第几局
}

const CARRIAGE_STORAGE_KEY_8P = 'thirteen_water_carriage_pool_v3';
const PLAYER_PROGRESS_KEY_8P = 'thirteen_water_player_carriage_progress_v3';

const CARRIAGE_STORAGE_KEY_4P = 'thirteen_water_carriage_pool_4p_v1';
const PLAYER_PROGRESS_KEY_4P = 'thirteen_water_player_carriage_progress_4p_v1';

function getStorageKeys(mode: 'vs_ai_4p' | 'vs_ai_8p' = 'vs_ai_8p') {
  if (mode === 'vs_ai_4p') {
    return { poolKey: CARRIAGE_STORAGE_KEY_4P, progressKey: PLAYER_PROGRESS_KEY_4P };
  }
  return { poolKey: CARRIAGE_STORAGE_KEY_8P, progressKey: PLAYER_PROGRESS_KEY_8P };
}

// 🤖 8人AI角色池 (确保比牌名册生动真实)
const AI_NAMES_POOL = [
  { name: '赌神阿发', avatar: '🦁' },
  { name: '雀圣阿旺', avatar: '🐯' },
  { name: '十三水老强', avatar: '🐲' },
  { name: '爆牌九哥', avatar: '🦊' },
  { name: '顺子妹子', avatar: '🐰' },
  { name: '同花顺大佬', avatar: '🐼' },
  { name: '铁支杀手', avatar: '鹰' },
  { name: '至尊青龙哥', avatar: '🦄' },
  { name: '三同花大叔', avatar: '🐻' },
  { name: '倒水大王', avatar: '🐸' },
  { name: '全垒打神话', avatar: '狼' },
  { name: '稳如泰山', avatar: '🐘' }
];

// Helper: 生成一节标准牌局 (8P模式用双副104张 -> 8副13张；4P模式用单副52张 -> 4副13张)
function generateSingleCarriage(index: number, mode: 'vs_ai_4p' | 'vs_ai_8p' = 'vs_ai_8p'): Carriage {
  const is8P = mode === 'vs_ai_8p';
  const numSeats = is8P ? 8 : 4;
  const deck = shuffle(is8P ? createDoubleDeck() : createDeck());
  const hands: CarriageHand[] = [];

  for (let s = 0; s < numSeats; s++) {
    const handCards = deck.slice(s * 13, (s + 1) * 13);
    hands.push({
      seatIndex: s,
      cards: handCards
    });
  }

  return {
    id: `car_${mode}_${String(index).padStart(6, '0')}`,
    index,
    createdAt: new Date().toISOString(),
    hands,
    submissions: {},
    status: 'unclaimed'
  };
}

// 📦 从 LocalStorage 获取全部牌局数据
function loadCarriageStorage(mode: 'vs_ai_4p' | 'vs_ai_8p' = 'vs_ai_8p'): {
  totalGeneratedCount: number;
  carriages: Carriage[];
} {
  const { poolKey } = getStorageKeys(mode);
  try {
    const raw = localStorage.getItem(poolKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.carriages) && typeof parsed.totalGeneratedCount === 'number') {
        return parsed;
      }
    }
  } catch (e) {
    console.error(`Failed to load carriage storage for ${mode}:`, e);
  }

  // 第一次初始化：生成 300 局预发牌
  return initialize300Carriages(0, [], mode);
}

// 💾 保存牌局数据至 LocalStorage
function saveCarriageStorage(data: { totalGeneratedCount: number; carriages: Carriage[] }, mode: 'vs_ai_4p' | 'vs_ai_8p' = 'vs_ai_8p') {
  const { poolKey } = getStorageKeys(mode);
  try {
    localStorage.setItem(poolKey, JSON.stringify(data));
  } catch (e) {
    console.error(`Failed to save carriage storage for ${mode}:`, e);
  }
}

// ⚡ 初始化或补充 300 局预发牌
function initialize300Carriages(currentTotal: number, existingCarriages: Carriage[], mode: 'vs_ai_4p' | 'vs_ai_8p' = 'vs_ai_8p'): {
  totalGeneratedCount: number;
  carriages: Carriage[];
} {
  const targetStock = 300;
  const currentUnclaimed = existingCarriages.filter(c => c.status === 'unclaimed').length;
  const needed = targetStock - currentUnclaimed;

  if (needed <= 0) {
    return { totalGeneratedCount: currentTotal, carriages: existingCarriages };
  }

  let nextIndex = currentTotal + 1;
  const newGenerated: Carriage[] = [];

  for (let i = 0; i < needed; i++) {
    newGenerated.push(generateSingleCarriage(nextIndex, mode));
    nextIndex++;
  }

  const updatedCarriages = [...existingCarriages, ...newGenerated];
  const updatedData = {
    totalGeneratedCount: nextIndex - 1,
    carriages: updatedCarriages
  };

  saveCarriageStorage(updatedData, mode);
  return updatedData;
}

// 🔄 检查库存：若可用未领取的牌局不足 50 局，则自动补充回 300 局
export function checkAndReplenishCarriages(mode: 'vs_ai_4p' | 'vs_ai_8p' = 'vs_ai_8p'): CarriagePoolStats {
  const data = loadCarriageStorage(mode);
  const unclaimed = data.carriages.filter(c => c.status === 'unclaimed');

  if (unclaimed.length < 50) {
    const replenished = initialize300Carriages(data.totalGeneratedCount, data.carriages, mode);
    return getCarriageStats(replenished.carriages, replenished.totalGeneratedCount, mode);
  }

  return getCarriageStats(data.carriages, data.totalGeneratedCount, mode);
}

// 📊 获取当前牌局库存与进度统计
export function getCarriageStats(carriagesInput?: Carriage[], totalGenInput?: number, mode: 'vs_ai_4p' | 'vs_ai_8p' = 'vs_ai_8p'): CarriagePoolStats {
  const storage = carriagesInput
    ? { carriages: carriagesInput, totalGeneratedCount: totalGenInput || carriagesInput.length }
    : loadCarriageStorage(mode);

  const unclaimedCount = storage.carriages.filter(c => c.status === 'unclaimed').length;
  const inProgressCount = storage.carriages.filter(c => c.status === 'in_progress').length;
  const completedCount = storage.carriages.filter(c => c.status === 'completed').length;
  const currentProgress = getPlayerCarriageIndexProgress(mode);

  return {
    totalCarriagesGenerated: storage.totalGeneratedCount,
    unclaimedCount,
    inProgressCount,
    completedCount,
    currentPlayingIndex: currentProgress
  };
}

// 📍 获取玩家当前的车厢/局数轮次进度
export function getPlayerCarriageIndexProgress(mode: 'vs_ai_4p' | 'vs_ai_8p' = 'vs_ai_8p'): number {
  const { progressKey } = getStorageKeys(mode);
  try {
    const raw = localStorage.getItem(progressKey);
    if (raw) {
      const idx = parseInt(raw, 10);
      if (!isNaN(idx) && idx > 0) return idx;
    }
  } catch (e) {}
  return 1;
}

// 📍 设置玩家当前局数轮次进度
export function setPlayerCarriageIndexProgress(index: number, mode: 'vs_ai_4p' | 'vs_ai_8p' = 'vs_ai_8p') {
  const { progressKey } = getStorageKeys(mode);
  try {
    localStorage.setItem(progressKey, String(index));
  } catch (e) {}
}

// 🚂 获取玩家进入的当前/下一局 (如当前牌局不存在，自动从预发牌池分配)
export function getOrCreateCurrentCarriage(preferredSeatIndex: number = 0, mode: 'vs_ai_4p' | 'vs_ai_8p' = 'vs_ai_8p'): {
  carriage: Carriage;
  seatIndex: number;
  handCards: Card[];
  stats: CarriagePoolStats;
} {
  const stats = checkAndReplenishCarriages(mode);
  const storage = loadCarriageStorage(mode);
  const playerIndex = getPlayerCarriageIndexProgress(mode);
  const maxSeat = mode === 'vs_ai_8p' ? 7 : 3;

  let carriage = storage.carriages.find(c => c.index === playerIndex);

  if (!carriage) {
    const unclaimed = storage.carriages.find(c => c.status === 'unclaimed');
    if (unclaimed) {
      unclaimed.index = playerIndex;
      unclaimed.status = 'in_progress';
      carriage = unclaimed;
    } else {
      carriage = generateSingleCarriage(playerIndex, mode);
      carriage.status = 'in_progress';
      storage.carriages.push(carriage);
    }
    saveCarriageStorage(storage, mode);
  } else if (carriage.status === 'unclaimed') {
    carriage.status = 'in_progress';
    saveCarriageStorage(storage, mode);
  }

  const validSeat = Math.max(0, Math.min(maxSeat, preferredSeatIndex));
  const handCards = carriage.hands[validSeat]?.cards || [];

  return {
    carriage,
    seatIndex: validSeat,
    handCards,
    stats: getCarriageStats(storage.carriages, storage.totalGeneratedCount, mode)
  };
}

// 📝 提交理牌并自动结算牌局 & 无缝跳转下一局
export async function submitCarriageHandAndAdvance(params: {
  carriageId: string;
  seatIndex: number;
  playerAccount: UserAccount;
  arrangement: PlayerArrangement;
  handCards: Card[];
  mode?: 'vs_ai_4p' | 'vs_ai_8p';
}): Promise<{
  completedCarriage: Carriage;
  playerResult: PlayerScoreDetail;
  allMatchResults: PlayerScoreDetail[];
  nextCarriageData: {
    carriage: Carriage;
    seatIndex: number;
    handCards: Card[];
  };
  updatedStats: CarriagePoolStats;
}> {
  const { carriageId, seatIndex, playerAccount, arrangement, handCards, mode = 'vs_ai_8p' } = params;
  const is8P = mode === 'vs_ai_8p';
  const numPlayers = is8P ? 8 : 4;

  const storage = loadCarriageStorage(mode);
  const carriageIndex = storage.carriages.findIndex(c => c.id === carriageId);

  if (carriageIndex === -1) {
    throw new Error('未找到对应牌局');
  }

  const carriage = storage.carriages[carriageIndex];

  // 1. 写入玩家本人的提交记录
  carriage.submissions[seatIndex] = {
    playerId: 'player_user',
    playerName: playerAccount.nickname || '玩家',
    avatar: playerAccount.avatar || '😎',
    isAi: false,
    arrangement,
    cards: handCards,
    submittedAt: new Date().toISOString()
  };

  // 2. 为其余位置自动匹配/生成 AI 玩家理牌结果
  const usedAiNames = new Set<string>();
  const matchPlayersInput: {
    id: string;
    name: string;
    isAi: boolean;
    avatar: string;
    cards: Card[];
    arrangement: PlayerArrangement;
  }[] = [];

  for (let s = 0; s < numPlayers; s++) {
    if (s === seatIndex) {
      matchPlayersInput.push({
        id: 'player_user',
        name: playerAccount.nickname || '玩家',
        isAi: false,
        avatar: playerAccount.avatar || '😎',
        cards: handCards,
        arrangement
      });
    } else {
      const existing = carriage.submissions[s];
      const seatHandCards = carriage.hands[s]?.cards || [];

      if (existing) {
        matchPlayersInput.push({
          id: existing.playerId,
          name: existing.playerName,
          isAi: existing.isAi,
          avatar: existing.avatar,
          cards: existing.cards,
          arrangement: existing.arrangement
        });
      } else {
        let aiMeta = AI_NAMES_POOL[s % AI_NAMES_POOL.length];
        if (usedAiNames.has(aiMeta.name)) {
          aiMeta = AI_NAMES_POOL.find(a => !usedAiNames.has(a.name)) || aiMeta;
        }
        usedAiNames.add(aiMeta.name);

        const aiArr = aiArrangeCards(seatHandCards);
        const aiSubmission: CarriageSubmission = {
          playerId: `ai_bot_${s + 1}`,
          playerName: aiMeta.name,
          avatar: aiMeta.avatar,
          isAi: true,
          arrangement: aiArr,
          cards: seatHandCards,
          submittedAt: new Date().toISOString()
        };

        carriage.submissions[s] = aiSubmission;

        matchPlayersInput.push({
          id: `ai_bot_${s + 1}`,
          name: aiMeta.name,
          isAi: true,
          avatar: aiMeta.avatar,
          cards: seatHandCards,
          arrangement: aiArr
        });
      }
    }
  }

  // 3. 调用各自独立的 4 人场或 8 人场比牌计分模块
  const allMatchResults = is8P
    ? calculate8PlayerMatchScores(matchPlayersInput)
    : calculate4PlayerMatchScores(matchPlayersInput);

  const playerResult = allMatchResults.find(r => r.playerId === 'player_user') || allMatchResults[0];

  // 4. 标注牌局完成
  carriage.status = 'completed';
  carriage.completedAt = new Date().toISOString();
  carriage.matchResults = allMatchResults;

  // 5. 更新本地存储
  storage.carriages[carriageIndex] = carriage;
  saveCarriageStorage(storage, mode);

  // 6. 给玩家结算积分与战绩历史
  const pointsDelta = playerResult.finalPoints;
  addPoints(
    pointsDelta * 100,
    pointsDelta >= 0 ? 'MATCH_WIN' : 'MATCH_LOSS',
    `【第 ${carriage.index} 局】${is8P ? '8人场' : '4人场'}比牌`
  );

  try {
    await ApiClient.recordGame({
      playerName: playerAccount.nickname,
      mode: is8P ? 'vs_ai_8p' : 'vs_ai_4p',
      pointsWon: pointsDelta,
      result: pointsDelta > 0 ? (playerResult.specialHand ? 'SPECIAL_WIN' : 'WIN') : pointsDelta < 0 ? 'LOSE' : 'DRAW',
      specialHand: playerResult.specialHand || null,
      frontType: playerResult.frontScore.type,
      midType: playerResult.midScore.type,
      backType: playerResult.backScore.type,
      opponentsSummary: `第 ${carriage.index} 局 (${is8P ? '8人场' : '4人场'})`
    });
  } catch (e) {
    console.error(`Cloud sync carriage record error (${mode}):`, e);
  }

  // 7. 自动前进：轮次 progress + 1
  const nextCarriageIndex = carriage.index + 1;
  setPlayerCarriageIndexProgress(nextCarriageIndex, mode);

  // 8. 自动拉取下一局
  const nextCarriageData = getOrCreateCurrentCarriage(seatIndex, mode);

  return {
    completedCarriage: carriage,
    playerResult,
    allMatchResults,
    nextCarriageData: {
      carriage: nextCarriageData.carriage,
      seatIndex: nextCarriageData.seatIndex,
      handCards: nextCarriageData.handCards
    },
    updatedStats: nextCarriageData.stats
  };
}

// 📜 获取已结算的战绩记录列表
export function getCompletedCarriagesList(mode: 'vs_ai_4p' | 'vs_ai_8p' = 'vs_ai_8p'): Carriage[] {
  const storage = loadCarriageStorage(mode);
  return storage.carriages
    .filter(c => c.status === 'completed')
    .sort((a, b) => b.index - a.index);
}

// 🧹 重置牌局库存池 (重新生成 300 局)
export function resetCarriagePool(mode: 'vs_ai_4p' | 'vs_ai_8p' = 'vs_ai_8p'): CarriagePoolStats {
  const { poolKey, progressKey } = getStorageKeys(mode);
  try {
    localStorage.removeItem(poolKey);
    localStorage.removeItem(progressKey);
  } catch (e) {}

  const newStorage = initialize300Carriages(0, [], mode);
  return getCarriageStats(newStorage.carriages, newStorage.totalGeneratedCount, mode);
}
