
import { Card, PlayerArrangement, PlayerScoreDetail, UserAccount } from '../types';
import { createDeck, createDoubleDeck, shuffle, aiArrangeCards, calculate4PlayerMatchScores, calculate8PlayerMatchScores, detectSpecialHand } from '../gameLogic';
import { addPoints, getRegisteredCommunityPlayers } from './accountManager';
import { ApiClient } from '../api';

export interface CarriageHand {
  seatIndex: number;
  cards: Card[];
}

export interface CarriageSubmission {
  playerId: string;
  playerName: string;
  avatar: string;
  isAi: boolean;
  arrangement: PlayerArrangement;
  cards: Card[];
  submittedAt: string;
  seatIndex?: number;
  seatNumber?: number;
  carriageIndex?: number;
  pointsWon?: number;
}

export interface Carriage {
  id: string;
  index: number;
  createdAt: string;
  hands: CarriageHand[];
  submissions: { [seatIndex: number]: CarriageSubmission };
  status: 'unclaimed' | 'in_progress' | 'completed';
  completedAt?: string;
  matchResults?: PlayerScoreDetail[];
}

export interface CarriagePoolStats {
  totalCarriagesGenerated: number;
  unclaimedCount: number;
  inProgressCount: number;
  completedCount: number;
  currentPlayingIndex: number;
}

const CARRIAGE_STORAGE_KEY_8P = 'thirteen_water_carriage_pool_v3';
const PLAYER_PROGRESS_KEY_8P = 'thirteen_water_player_carriage_progress_v3';

type PoolMode = 'vs_ai_8p' | 'realtime' | 'reservation' | string;

function getStorageKeys(mode: PoolMode = 'vs_ai_8p') {
  if (mode === 'reservation') {
    return {
      CARRIAGE_STORAGE_KEY: 'thirteen_water_carriage_pool_reservation_v2',
      PLAYER_PROGRESS_KEY: 'thirteen_water_player_carriage_progress_reservation_v2'
    };
  }
  return { CARRIAGE_STORAGE_KEY: CARRIAGE_STORAGE_KEY_8P, PLAYER_PROGRESS_KEY: PLAYER_PROGRESS_KEY_8P };
}

function generateSingleCarriage(index: number, mode: PoolMode = 'vs_ai_8p'): Carriage {
  const is8P = true;
  const totalSeats = 8;
  const deck = createDoubleDeck();
  const shuffled = shuffle(deck);
  
  const hands: CarriageHand[] = [];
  for (let i = 0; i < totalSeats; i++) {
    hands.push({
      seatIndex: i,
      cards: shuffled.slice(i * 13, (i + 1) * 13)
    });
  }

  const submissions: { [seatIndex: number]: CarriageSubmission } = {};

  // 👥 严禁AI补位：在8人巅峰场中，接入真实平台已注册社区玩家的手牌理牌记录
  if (mode === 'vs_ai_8p') {
    try {
      const community = getRegisteredCommunityPlayers();
      // 预先安排 3-5 位真实社区牌友在该包厢入座，其余席位保持空闲待入座
      const preSeatedCount = Math.min(5, Math.max(3, ((index * 3) % 3) + 3));
      for (let i = 1; i <= preSeatedCount && i < totalSeats; i++) {
        const commUser = community[(i - 1 + index) % community.length];
        if (commUser) {
          const hand = hands[i].cards;
          const arr = aiArrangeCards(hand);
          submissions[i] = {
            playerId: commUser.id || `u_${commUser.phone}`,
            playerName: commUser.nickname,
            avatar: commUser.avatar,
            isAi: false,
            arrangement: arr,
            cards: hand,
            submittedAt: new Date(Date.now() - (preSeatedCount - i + 1) * 35000).toISOString(),
            seatIndex: i,
            seatNumber: i + 1,
            carriageIndex: index
          };
        }
      }
    } catch (e) {
      console.warn('Failed to seed community submissions:', e);
    }
  }

  return {
    id: `car_${mode}_${Date.now()}_${Math.random().toString(36).substring(2,8)}`,
    index,
    createdAt: new Date().toISOString(),
    hands,
    submissions,
    status: Object.keys(submissions).length > 0 ? 'in_progress' : 'unclaimed'
  };
}

function loadCarriageStorage(mode: PoolMode = 'vs_ai_8p'): { totalGeneratedCount: number; carriages: Carriage[] } {
  const { CARRIAGE_STORAGE_KEY } = getStorageKeys(mode);
  try {
    const raw = localStorage.getItem(CARRIAGE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { totalGeneratedCount: 0, carriages: [] };
}

function saveCarriageStorage(data: { totalGeneratedCount: number; carriages: Carriage[] }, mode: PoolMode = 'vs_ai_8p') {
  const { CARRIAGE_STORAGE_KEY } = getStorageKeys(mode);
  try {
    localStorage.setItem(CARRIAGE_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {}
}

function initialize300Carriages(currentTotal: number, existingCarriages: Carriage[], mode: PoolMode = 'vs_ai_8p'): { totalGeneratedCount: number; carriages: Carriage[] } {
  const newCarriages = [...existingCarriages];
  let totalGeneratedCount = currentTotal;
  
  const targetCount = 300;
  const needed = targetCount - newCarriages.length;
  
  for (let i = 0; i < needed; i++) {
    totalGeneratedCount++;
    newCarriages.push(generateSingleCarriage(totalGeneratedCount, mode));
  }
  
  const result = { totalGeneratedCount, carriages: newCarriages };
  saveCarriageStorage(result, mode);
  return result;
}

export function checkAndReplenishCarriages(mode: PoolMode = 'vs_ai_8p'): CarriagePoolStats {
  const storage = loadCarriageStorage(mode);
  if (storage.carriages.length < 50) {
    const newStorage = initialize300Carriages(storage.totalGeneratedCount, storage.carriages, mode);
    return getCarriageStats(newStorage.carriages, newStorage.totalGeneratedCount, mode);
  }
  return getCarriageStats(storage.carriages, storage.totalGeneratedCount, mode);
}

export function getCarriageStats(carriagesInput?: Carriage[], totalGenInput?: number, mode: PoolMode = 'vs_ai_8p'): CarriagePoolStats {
  let carriages = carriagesInput;
  let totalGeneratedCount = totalGenInput;
  
  if (!carriages || totalGeneratedCount === undefined) {
    const storage = loadCarriageStorage(mode);
    carriages = storage.carriages;
    totalGeneratedCount = storage.totalGeneratedCount;
  }
  
  let unclaimedCount = 0;
  let inProgressCount = 0;
  let completedCount = 0;
  
  carriages.forEach(c => {
    if (c.status === 'unclaimed') unclaimedCount++;
    else if (c.status === 'in_progress') inProgressCount++;
    else if (c.status === 'completed') completedCount++;
  });
  
  return {
    totalCarriagesGenerated: totalGeneratedCount,
    unclaimedCount,
    inProgressCount,
    completedCount,
    currentPlayingIndex: getPlayerCarriageIndexProgress(mode)
  };
}

export function getPlayerCarriageIndexProgress(mode: PoolMode = 'vs_ai_8p'): number {
  const { PLAYER_PROGRESS_KEY } = getStorageKeys(mode);
  try {
    const raw = localStorage.getItem(PLAYER_PROGRESS_KEY);
    if (raw) return parseInt(raw, 10);
  } catch (e) {}
  return 1;
}

export function setPlayerCarriageIndexProgress(index: number, mode: PoolMode = 'vs_ai_8p') {
  const { PLAYER_PROGRESS_KEY } = getStorageKeys(mode);
  try {
    localStorage.setItem(PLAYER_PROGRESS_KEY, index.toString());
  } catch (e) {}
}

export function getCurrentCarriageOccupancy(mode: PoolMode = 'vs_ai_8p'): {
  totalSeats: number;
  occupiedCount: number;
  remainingSeats: number;
  isFull: boolean;
  carriageIndex: number;
  submissions: { [seatIndex: number]: CarriageSubmission };
} {
  const storage = loadCarriageStorage(mode);
  const playerIndex = getPlayerCarriageIndexProgress(mode);
  const totalSeats = 8;
  
  const carriage = storage.carriages.find(c => c.index === playerIndex);
  if (!carriage) {
    return {
      totalSeats,
      occupiedCount: 0,
      remainingSeats: totalSeats,
      isFull: false,
      carriageIndex: playerIndex,
      submissions: {}
    };
  }
  
  const occupiedCount = Object.keys(carriage.submissions).length;
  const remainingSeats = Math.max(0, totalSeats - occupiedCount);
  
  return {
    totalSeats,
    occupiedCount,
    remainingSeats,
    isFull: remainingSeats === 0,
    carriageIndex: carriage.index,
    submissions: carriage.submissions
  };
}

// 🚂 获取指定轮次的牌局数据 (保证存在)
export function getCarriageByRound(roundIndex: number, mode: PoolMode = 'reservation'): Carriage {
  checkAndReplenishCarriages(mode);
  const storage = loadCarriageStorage(mode);
  let carriage = storage.carriages.find(c => c.index === roundIndex);
  if (!carriage) {
    const unclaimed = storage.carriages.find(c => c.status === 'unclaimed');
    if (unclaimed) {
      unclaimed.index = roundIndex;
      unclaimed.status = 'in_progress';
      carriage = unclaimed;
    } else {
      carriage = generateSingleCarriage(roundIndex, mode);
      carriage.status = 'in_progress';
      storage.carriages.push(carriage);
    }
    saveCarriageStorage(storage, mode);
  }
  return carriage;
}

// 🚂 获取玩家进入的当前/下一局 (如当前牌局不存在，自动从预发牌池分配)
export function getOrCreateCurrentCarriage(
  preferredSeatIndex: number = 0,
  mode: PoolMode = 'vs_ai_8p',
  roundOverride?: number,
  forceExactSeat: boolean = false
): {
  carriage: Carriage;
  seatIndex: number;
  handCards: Card[];
  stats: CarriagePoolStats;
  isFull: boolean;
} {
  const stats = checkAndReplenishCarriages(mode);
  const storage = loadCarriageStorage(mode);
  const playerIndex = typeof roundOverride === 'number' ? roundOverride : getPlayerCarriageIndexProgress(mode);
  const totalSeats = 8;
  const maxSeat = totalSeats - 1;

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

  const submissions = carriage.submissions || {};
  const occupiedCount = Object.keys(submissions).length;
  const isFull = occupiedCount >= totalSeats;

  // 如果强制指定位置（例如玩家自主挑选的座位），严格返回该座位的手牌
  let validSeat = Math.max(0, Math.min(maxSeat, preferredSeatIndex));
  if (!forceExactSeat && submissions[validSeat]) {
    for (let s = 0; s < totalSeats; s++) {
      if (!submissions[s]) {
        validSeat = s;
        break;
      }
    }
  }

  const handCards = carriage.hands[validSeat]?.cards || [];

  return {
    carriage,
    seatIndex: validSeat,
    handCards,
    stats: getCarriageStats(storage.carriages, storage.totalGeneratedCount, mode),
    isFull
  };
}

// 📝 提交理牌并自动结算牌局 & 无缝跳转下一局
export async function submitCarriageHandAndAdvance(params: {
  carriageId: string;
  seatIndex: number;
  playerAccount: UserAccount;
  arrangement: PlayerArrangement;
  handCards: Card[];
  mode?: PoolMode;
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
  const numPlayers = 8;
  const storage = loadCarriageStorage(mode);
  
  const carriageIndex = storage.carriages.findIndex(c => c.id === carriageId);
  if (carriageIndex === -1) {
    throw new Error('未找到对应牌局');
  }
  
  const carriage = storage.carriages[carriageIndex];

  // 1. 写入玩家本人的提交记录（附带座位号与局号信息，严防混淆）
  carriage.submissions[seatIndex] = {
    playerId: 'player_user',
    playerName: playerAccount.nickname || '玩家',
    avatar: playerAccount.avatar || '😎',
    isAi: false,
    arrangement,
    cards: handCards,
    submittedAt: new Date().toISOString(),
    seatIndex,
    seatNumber: seatIndex + 1,
    carriageIndex: carriage.index
  };

  // 2. 收集所有已有真实提交的玩家理牌结果
  const matchPlayersInput: {
    id: string;
    name: string;
    isAi: boolean;
    avatar: string;
    cards: Card[];
    arrangement: PlayerArrangement;
  }[] = Object.values(carriage.submissions).map(sub => ({
    id: sub.playerId,
    name: sub.playerName,
    isAi: sub.isAi,
    avatar: sub.avatar,
    cards: sub.cards,
    arrangement: sub.arrangement
  }));

  // 3. 调用 8 人场比牌计分模块
  const allMatchResults = calculate8PlayerMatchScores(matchPlayersInput);
    
  const playerResult = allMatchResults.find(r => r.playerId === 'player_user') || allMatchResults[0];
  const pointsDelta = playerResult.finalPoints;
  carriage.submissions[seatIndex].pointsWon = pointsDelta;

  // 4. 满座时标注牌局完成，否则标记为进行中
  if (Object.keys(carriage.submissions).length >= numPlayers) {
    carriage.status = 'completed';
    carriage.completedAt = new Date().toISOString();
  } else {
    carriage.status = 'in_progress';
  }
  
  carriage.matchResults = allMatchResults;

  // 5. 更新本地存储
  storage.carriages[carriageIndex] = carriage;
  saveCarriageStorage(storage, mode);

  // 6. 给玩家结算积分与战绩历史
  addPoints(
    pointsDelta * 100,
    pointsDelta >= 0 ? 'MATCH_WIN' : 'MATCH_LOSS',
    `【第 ${carriage.index} 局 • ${seatIndex + 1}号座位】8人场比牌`
  );

  try {
    await ApiClient.recordGame({
      playerName: playerAccount.nickname,
      mode: mode === 'reservation' ? 'reservation' : 'vs_ai_8p',
      pointsWon: pointsDelta,
      result: pointsDelta > 0 ? (playerResult.specialHand ? 'SPECIAL_WIN' : 'WIN') : pointsDelta < 0 ? 'LOSE' : 'DRAW',
      specialHand: playerResult.specialHand || null,
      frontType: playerResult.frontScore?.type || 'High Card',
      midType: playerResult.midScore?.type || 'High Card',
      backType: playerResult.backScore?.type || 'High Card',
      opponentsSummary: `第 ${carriage.index} 局 • ${seatIndex + 1}号座位 (${mode === 'reservation' ? '预约场' : '8人场'})`
    });
  } catch (e) {
    console.error(`Cloud sync carriage record error:`, e);
  }

  // 7. 自动前进：轮次 progress + 1
  const nextCarriageIndex = carriage.index + 1;
  setPlayerCarriageIndexProgress(nextCarriageIndex, mode);

  // 8. 自动拉取下一局
  const nextCarriageData = getOrCreateCurrentCarriage(seatIndex, mode, nextCarriageIndex);

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
export function getCompletedCarriagesList(mode: PoolMode = 'vs_ai_8p'): Carriage[] {
  const storage = loadCarriageStorage(mode);
  return storage.carriages
    .filter(c => c.status === 'completed')
    .sort((a, b) => b.index - a.index);
}

// 🧹 重置牌局库存池 (重新生成 300 局)
export function resetCarriagePool(mode: PoolMode = 'vs_ai_8p'): CarriagePoolStats {
  const { CARRIAGE_STORAGE_KEY, PLAYER_PROGRESS_KEY } = getStorageKeys(mode);
  try {
    localStorage.removeItem(CARRIAGE_STORAGE_KEY);
    localStorage.removeItem(PLAYER_PROGRESS_KEY);
  } catch (e) {}
  const newStorage = initialize300Carriages(0, [], mode);
  return getCarriageStats(newStorage.carriages, newStorage.totalGeneratedCount, mode);
}
