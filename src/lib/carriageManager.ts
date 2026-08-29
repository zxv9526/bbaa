import { Card, PlayerArrangement, PlayerScoreDetail, UserAccount } from '../types';
import { createDoubleDeck, shuffle, aiArrangeCards, calculateMatchScores, detectSpecialHand } from '../gameLogic';
import { addPoints } from './accountManager';
import { ApiClient } from '../api';

export interface CarriageHand {
  seatIndex: number; // 0..7 (1号..8号位置)
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
  id: string;              // e.g. "car_000001"
  index: number;           // 车厢序号 (1, 2, 3...)
  createdAt: string;
  hands: CarriageHand[];   // 8副手牌
  submissions: { [seatIndex: number]: CarriageSubmission };
  status: 'unclaimed' | 'in_progress' | 'completed';
  completedAt?: string;
  matchResults?: PlayerScoreDetail[];
}

export interface CarriagePoolStats {
  totalCarriagesGenerated: number; // 累计生成车厢总数
  unclaimedCount: number;         // 当前已发牌未领取的库存数
  inProgressCount: number;        // 进行中车厢数
  completedCount: number;         // 已结算车厢数
  currentPlayingIndex: number;    // 玩家当前处于第几节车厢
}

const CARRIAGE_STORAGE_KEY = 'thirteen_water_carriage_pool_v3';
const PLAYER_PROGRESS_KEY = 'thirteen_water_player_carriage_progress_v3';

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

// Helper: 生成一节标准8人车厢 (双副扑克牌104张 -> 8副13张)
function generateSingleCarriage(index: number): Carriage {
  const doubleDeck = shuffle(createDoubleDeck());
  const hands: CarriageHand[] = [];

  for (let s = 0; s < 8; s++) {
    const handCards = doubleDeck.slice(s * 13, (s + 1) * 13);
    hands.push({
      seatIndex: s,
      cards: handCards
    });
  }

  return {
    id: `car_${String(index).padStart(6, '0')}`,
    index,
    createdAt: new Date().toISOString(),
    hands,
    submissions: {},
    status: 'unclaimed'
  };
}

// 📦 从 LocalStorage 获取全部车厢数据
function loadCarriageStorage(): {
  totalGeneratedCount: number;
  carriages: Carriage[];
} {
  try {
    const raw = localStorage.getItem(CARRIAGE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.carriages) && typeof parsed.totalGeneratedCount === 'number') {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load carriage storage:', e);
  }

  // 第一次初始化：生成 300 局预发牌车厢
  return initialize300Carriages(0, []);
}

// 💾 保存车厢数据至 LocalStorage
function saveCarriageStorage(data: { totalGeneratedCount: number; carriages: Carriage[] }) {
  try {
    localStorage.setItem(CARRIAGE_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save carriage storage:', e);
  }
}

// ⚡ 初始化或补充 300 局预发牌
function initialize300Carriages(currentTotal: number, existingCarriages: Carriage[]): {
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
    newGenerated.push(generateSingleCarriage(nextIndex));
    nextIndex++;
  }

  const updatedCarriages = [...existingCarriages, ...newGenerated];
  const updatedData = {
    totalGeneratedCount: nextIndex - 1,
    carriages: updatedCarriages
  };

  saveCarriageStorage(updatedData);
  return updatedData;
}

// 🔄 检查库存：若可用未领取的车厢不足 50 局，则自动补充回 300 局
export function checkAndReplenishCarriages(): CarriagePoolStats {
  const data = loadCarriageStorage();
  const unclaimed = data.carriages.filter(c => c.status === 'unclaimed');

  // 当库存不足 50 局时，自动补充满 300 局
  if (unclaimed.length < 50) {
    const replenished = initialize300Carriages(data.totalGeneratedCount, data.carriages);
    return getCarriageStats(replenished.carriages, replenished.totalGeneratedCount);
  }

  return getCarriageStats(data.carriages, data.totalGeneratedCount);
}

// 📊 获取当前车厢库存与进度统计
export function getCarriageStats(carriagesInput?: Carriage[], totalGenInput?: number): CarriagePoolStats {
  const storage = carriagesInput
    ? { carriages: carriagesInput, totalGeneratedCount: totalGenInput || carriagesInput.length }
    : loadCarriageStorage();

  const unclaimedCount = storage.carriages.filter(c => c.status === 'unclaimed').length;
  const inProgressCount = storage.carriages.filter(c => c.status === 'in_progress').length;
  const completedCount = storage.carriages.filter(c => c.status === 'completed').length;
  const currentProgress = getPlayerCarriageIndexProgress();

  return {
    totalCarriagesGenerated: storage.totalGeneratedCount,
    unclaimedCount,
    inProgressCount,
    completedCount,
    currentPlayingIndex: currentProgress
  };
}

// 📍 获取玩家当前的车厢轮次进度 (默认第 1 节车厢)
export function getPlayerCarriageIndexProgress(): number {
  try {
    const raw = localStorage.getItem(PLAYER_PROGRESS_KEY);
    if (raw) {
      const idx = parseInt(raw, 10);
      if (!isNaN(idx) && idx > 0) return idx;
    }
  } catch (e) {}
  return 1;
}

// 📍 设置玩家当前车厢轮次进度
export function setPlayerCarriageIndexProgress(index: number) {
  try {
    localStorage.setItem(PLAYER_PROGRESS_KEY, String(index));
  } catch (e) {}
}

// 🚂 获取玩家进入的当前/下一节车厢 (如当前车厢不存在，自动从预发牌池分配)
export function getOrCreateCurrentCarriage(preferredSeatIndex: number = 0): {
  carriage: Carriage;
  seatIndex: number;
  handCards: Card[];
  stats: CarriagePoolStats;
} {
  // 1. 检查并补充库存 (低于 50 局自动补回 300 局)
  const stats = checkAndReplenishCarriages();
  const storage = loadCarriageStorage();
  const playerIndex = getPlayerCarriageIndexProgress();

  // 2. 查找是否已存在该序号的车厢
  let carriage = storage.carriages.find(c => c.index === playerIndex);

  // 3. 若无，从未分配的领用第一个，或新建该序号车厢
  if (!carriage) {
    const unclaimed = storage.carriages.find(c => c.status === 'unclaimed');
    if (unclaimed) {
      unclaimed.index = playerIndex;
      unclaimed.status = 'in_progress';
      carriage = unclaimed;
    } else {
      // 紧急分配新车厢
      carriage = generateSingleCarriage(playerIndex);
      carriage.status = 'in_progress';
      storage.carriages.push(carriage);
    }
    saveCarriageStorage(storage);
  } else if (carriage.status === 'unclaimed') {
    carriage.status = 'in_progress';
    saveCarriageStorage(storage);
  }

  // 4. 获取该车厢指定手牌位置的 13 张牌
  const validSeat = Math.max(0, Math.min(7, preferredSeatIndex));
  const handCards = carriage.hands[validSeat]?.cards || [];

  return {
    carriage,
    seatIndex: validSeat,
    handCards,
    stats: getCarriageStats(storage.carriages, storage.totalGeneratedCount)
  };
}

// 📝 提交理牌并自动结算车厢 & 无缝跳转下一节车厢
export async function submitCarriageHandAndAdvance(params: {
  carriageId: string;
  seatIndex: number;
  playerAccount: UserAccount;
  arrangement: PlayerArrangement;
  handCards: Card[];
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
  const { carriageId, seatIndex, playerAccount, arrangement, handCards } = params;
  const storage = loadCarriageStorage();
  const carriageIndex = storage.carriages.findIndex(c => c.id === carriageId);

  if (carriageIndex === -1) {
    throw new Error('未找到对应车厢牌局');
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

  // 2. 为其余 7 个位置自动匹配/生成 AI 玩家理牌结果，确保 8 人场结算
  const usedAiNames = new Set<string>();
  const matchPlayersInput: {
    id: string;
    name: string;
    isAi: boolean;
    avatar: string;
    cards: Card[];
    arrangement: PlayerArrangement;
  }[] = [];

  for (let s = 0; s < 8; s++) {
    if (s === seatIndex) {
      // 本人
      matchPlayersInput.push({
        id: 'player_user',
        name: playerAccount.nickname || '玩家',
        isAi: false,
        avatar: playerAccount.avatar || '😎',
        cards: handCards,
        arrangement
      });
    } else {
      // 检查该位置是否有先提交的玩家，没有则补充 AI
      const existing = carriage.submissions[s];
      const seatHandCards = carriage.hands[s].cards;

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
        // 分配一个形象生动的 AI 玩家
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

  // 3. 计算 8 人十三水比牌结果 (8人对决)
  const allMatchResults = calculateMatchScores(matchPlayersInput);
  const playerResult = allMatchResults.find(r => r.playerId === 'player_user') || allMatchResults[0];

  // 4. 标注车厢完成
  carriage.status = 'completed';
  carriage.completedAt = new Date().toISOString();
  carriage.matchResults = allMatchResults;

  // 5. 更新本地存储
  storage.carriages[carriageIndex] = carriage;
  saveCarriageStorage(storage);

  // 6. 给玩家结算积分与战绩历史
  const pointsDelta = playerResult.finalPoints;
  addPoints(
    pointsDelta * 100,
    pointsDelta >= 0 ? 'MATCH_WIN' : 'MATCH_LOSS',
    `【第 ${carriage.index} 节车厢】8人场比牌`
  );

  try {
    await ApiClient.recordGame({
      playerName: playerAccount.nickname,
      mode: 'vs_ai_8p',
      pointsWon: pointsDelta,
      result: pointsDelta > 0 ? (playerResult.specialHand ? 'SPECIAL_WIN' : 'WIN') : pointsDelta < 0 ? 'LOSE' : 'DRAW',
      specialHand: playerResult.specialHand || null,
      frontType: playerResult.frontScore.type,
      midType: playerResult.midScore.type,
      backType: playerResult.backScore.type,
      opponentsSummary: `车厢 #${carriage.index} (8人场)`
    });
  } catch (e) {
    console.error('Cloud sync carriage record error:', e);
  }

  // 7. 车厢自动前进：轮次 progress + 1
  const nextCarriageIndex = carriage.index + 1;
  setPlayerCarriageIndexProgress(nextCarriageIndex);

  // 8. 自动拉取下一节车厢 (保持在相同位置, 例如 1号手牌 seatIndex)
  const nextCarriageData = getOrCreateCurrentCarriage(seatIndex);

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

// 📜 获取已结算的车厢战绩记录列表
export function getCompletedCarriagesList(): Carriage[] {
  const storage = loadCarriageStorage();
  return storage.carriages
    .filter(c => c.status === 'completed')
    .sort((a, b) => b.index - a.index);
}

// 🧹 重置车厢库存池 (重新生成 300 局)
export function resetCarriagePool(): CarriagePoolStats {
  try {
    localStorage.removeItem(CARRIAGE_STORAGE_KEY);
    localStorage.removeItem(PLAYER_PROGRESS_KEY);
  } catch (e) {}

  const newStorage = initialize300Carriages(0, []);
  return getCarriageStats(newStorage.carriages, newStorage.totalGeneratedCount);
}
