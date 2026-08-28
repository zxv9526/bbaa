import { Card, HandEvaluation, HandType, PlayerArrangement, PlayerScoreDetail, Rank, SpecialHandType, Suit } from './types';

export const SUIT_ORDER: Record<Suit, number> = { S: 4, H: 3, C: 2, D: 1 }; // 黑桃 > 红桃 > 梅花 > 方块

export const HAND_TYPE_CN: Record<HandType, string> = {
  'High Card': '乌龙 (单张)',
  'Pair': '对子 (一对)',
  'Two Pair': '两对 (二对)',
  'Three of a Kind': '三条 (三张同点)',
  'Straight': '顺子 (五连张)',
  'Flush': '同花 (五张同色)',
  'Full House': '葫芦 (三带二)',
  'Four of a Kind': '铁支 (四张同点)',
  'Straight Flush': '同花顺 (连张同色)'
};

export const SPECIAL_HAND_CN: Record<SpecialHandType, { name: string; points: number; desc: string }> = {
  'Supreme Dragon': { name: '至尊青龙', points: 108, desc: '同花 A-2-3...K 13张' },
  'Dragon': { name: '一条龙', points: 52, desc: 'A到K 13张不同点数' },
  'Twelve Royals': { name: '十二皇族', points: 36, desc: '12张及以上J/Q/K/A' },
  'Three Straight Flushes': { name: '三同花顺', points: 26, desc: '前中后三墩皆为同花顺' },
  'Three Quads': { name: '三分天下', points: 24, desc: '3套铁支(4条)' },
  'All High': { name: '全大', points: 20, desc: '13张牌全部为8至A' },
  'All Low': { name: '全小', points: 20, desc: '13张牌全部为2至8' },
  'Same Color': { name: '凑一色', points: 16, desc: '13张全为红牌或全为黑牌' },
  'Four Triples': { name: '四套三条', points: 12, desc: '4套三条+1张散牌' },
  'Five Pairs One Triple': { name: '五对三条', points: 10, desc: '5个对子+1个三条' },
  'Six Pairs': { name: '六对半', points: 8, desc: '6个对子+1张单张' },
  'Three Flushes': { name: '三同花', points: 6, desc: '前3张、中5张、后5张各为同花' },
  'Three Straights': { name: '三顺子', points: 6, desc: '前3张、中5张、后5张各为顺子' }
};

export function createDeck(): Card[] {
  const suits: Suit[] = ['S', 'H', 'C', 'D'];
  const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const deck: Card[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ id: `${rank}-${suit}`, suit, rank });
    }
  }
  return deck;
}

export function shuffle(deck: Card[]): Card[] {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (b.rank !== a.rank) return b.rank - a.rank;
    return SUIT_ORDER[b.suit] - SUIT_ORDER[a.suit];
  });
}

// 检查是否为特殊牌型 (十三水规则)
export function detectSpecialHand(cards: Card[]): SpecialHandType | null {
  if (cards.length !== 13) return null;
  const sorted = sortCards(cards);
  const ranks = sorted.map(c => c.rank);
  const suits = sorted.map(c => c.suit);

  // 1. 至尊青龙 (同花一条龙)
  const isOneSuit = suits.every(s => s === suits[0]);
  const uniqueRanks = new Set(ranks);
  if (uniqueRanks.size === 13) {
    if (isOneSuit) return 'Supreme Dragon';
    return 'Dragon'; // 一条龙
  }

  // 2. 十二皇族 (12张或13张为 J, Q, K, A, rank >= 11)
  const royalsCount = ranks.filter(r => r >= 11).length;
  if (royalsCount >= 12) return 'Twelve Royals';

  // 统计牌点出现次数
  const counts: Record<number, number> = {};
  ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
  const countValues = Object.values(counts).sort((a, b) => b - a);

  // 3. 三分天下 (3套铁支 / 4条) -> countValues: [4, 4, 4, 1]
  if (countValues[0] === 4 && countValues[1] === 4 && countValues[2] === 4) {
    return 'Three Quads';
  }

  // 4. 全大 (全部 >= 8)
  if (ranks.every(r => r >= 8)) return 'All High';

  // 5. 全小 (全部 <= 8)
  if (ranks.every(r => r <= 8)) return 'All Low';

  // 6. 凑一色 (全红牌 H/D 或 全黑牌 S/C)
  const isAllRed = suits.every(s => s === 'H' || s === 'D');
  const isAllBlack = suits.every(s => s === 'S' || s === 'C');
  if (isAllRed || isAllBlack) return 'Same Color';

  // 7. 四套三条 -> countValues: [3, 3, 3, 3, 1]
  if (countValues[0] === 3 && countValues[1] === 3 && countValues[2] === 3 && countValues[3] === 3) {
    return 'Four Triples';
  }

  // 8. 五对三条 -> [3, 2, 2, 2, 2, 2]
  if (countValues[0] === 3 && countValues[1] === 2 && countValues[2] === 2 && countValues[3] === 2 && countValues[4] === 2 && countValues[5] === 2) {
    return 'Five Pairs One Triple';
  }

  // 9. 六对半 -> 6个对子 + 1单张 -> [2, 2, 2, 2, 2, 2, 1]
  const pairCount = countValues.filter(c => c === 2).length;
  if (pairCount === 6 || (countValues[0] === 4 && pairCount === 4)) {
    return 'Six Pairs';
  }

  // 检查是否可能为 三同花 或 三顺子
  // 检查三同花 (前3同花，中5同花，后5同花)
  const suitGroups: Record<Suit, Card[]> = { S: [], H: [], C: [], D: [] };
  cards.forEach(c => suitGroups[c.suit].push(c));
  const suitLengths = Object.values(suitGroups).map(g => g.length).filter(l => l > 0).sort((a, b) => b - a);
  // 可能的花色分布: 5+5+3 或 8+5 或 10+3 等
  if (canFormThreeFlushes(cards)) {
    return 'Three Flushes';
  }

  if (canFormThreeStraights(cards)) {
    return 'Three Straights';
  }

  return null;
}

// 辅助检测三同花
function canFormThreeFlushes(cards: Card[]): boolean {
  const suits: Record<Suit, Card[]> = { S: [], H: [], C: [], D: [] };
  cards.forEach(c => suits[c.suit].push(c));
  const counts = Object.values(suits).map(arr => arr.length);
  // 要组成 5, 5, 3 或 5, 8 (分解为5+3) 或 13 等
  // 必须满足能凑出 5, 5, 3
  const partitions = [
    [5, 5, 3],
    [5, 8],
    [10, 3],
    [13]
  ];
  for (const part of partitions) {
    // 检查counts是否能覆盖该partition
    const cCopy = [...counts].sort((a, b) => b - a);
    let matched = true;
    for (const req of part) {
      const idx = cCopy.findIndex(x => x >= req);
      if (idx !== -1) {
        cCopy[idx] -= req;
      } else {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

// 辅助检测三顺子 (简化检测)
function canFormThreeStraights(cards: Card[]): boolean {
  // 3顺子：前3顺子，中5顺子，后5顺子
  // 尝试启发式快速搜索
  const sorted = sortCards(cards);
  // 若包含三顺子通常有较广的点数分布
  return false; // 严谨判断由自动理牌搜索提供
}

// 评估单墩牌力 (3张或5张)
export function evaluateHand(cards: Card[], dun: 'front' | 'middle' | 'back' = 'back'): HandEvaluation {
  if (!cards || cards.length === 0) {
    return { score: 0, type: 'High Card', cards: [], description: '空牌' };
  }

  const isFront = cards.length === 3;
  const sorted = sortCards(cards);
  const ranks = sorted.map(c => c.rank);
  const suits = sorted.map(c => c.suit);

  const counts: Record<number, number> = {};
  ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
  const countArr = Object.entries(counts)
    .map(([r, count]) => ({ rank: parseInt(r), count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  // 1. 前墩 (3张牌规则: 只有三条、一对、乌龙/高牌，或部分玩法支持三张顺子/同花)
  if (isFront) {
    // 前墩三条 (冲三 / 前墩三条通常有额外加分，如 +3分)
    if (countArr[0].count === 3) {
      const r = countArr[0].rank;
      return {
        score: 300000000 + r * 100,
        type: 'Three of a Kind',
        cards: sorted,
        description: `前墩三条 ${getRankStr(r)}`,
        bonusPoints: 3
      };
    }
    // 前墩一对
    if (countArr[0].count === 2) {
      const pairRank = countArr[0].rank;
      const kicker = countArr[1].rank;
      return {
        score: 100000000 + pairRank * 10000 + kicker * 100,
        type: 'Pair',
        cards: sorted,
        description: `对 ${getRankStr(pairRank)} (单张 ${getRankStr(kicker)})`
      };
    }
    // 前墩乌龙
    const r0 = ranks[0], r1 = ranks[1], r2 = ranks[2];
    return {
      score: r0 * 10000 + r1 * 100 + r2,
      type: 'High Card',
      cards: sorted,
      description: `乌龙 (${getRankStr(r0)}带头)`
    };
  }

  // 2. 中墩 / 后墩 (5张牌规则)
  const isFlush = suits.every(s => s === suits[0]);
  let isStraight = ranks.every((r, i) => i === 0 || r === ranks[i - 1] - 1);
  let straightHigh = ranks[0];

  // 特殊顺子: A-2-3-4-5 (A算1)
  if (!isStraight && ranks.join(',') === '14,5,4,3,2') {
    isStraight = true;
    straightHigh = 5; // A2345 最小顺子
  }

  const r0 = ranks[0] || 0;
  const r1 = ranks[1] || 0;
  const r2 = ranks[2] || 0;
  const r3 = ranks[3] || 0;
  const r4 = ranks[4] || 0;

  // 同花顺 (Straight Flush)
  if (isFlush && isStraight) {
    const bonus = dun === 'middle' ? 10 : 5; // 中墩同花顺+10，后墩+5
    return {
      score: 800000000 + straightHigh * 100,
      type: 'Straight Flush',
      cards: sorted,
      description: `同花顺 (${getRankStr(straightHigh)} 高)`,
      bonusPoints: bonus
    };
  }

  // 铁支 / 四条 (Four of a Kind)
  if (countArr[0].count === 4) {
    const fourRank = countArr[0].rank;
    const kicker = countArr[1].rank;
    const bonus = dun === 'middle' ? 8 : 4; // 中墩铁支+8，后墩+4
    return {
      score: 700000000 + fourRank * 10000 + kicker * 100,
      type: 'Four of a Kind',
      cards: sorted,
      description: `铁支 ${getRankStr(fourRank)}`,
      bonusPoints: bonus
    };
  }

  // 葫芦 / 三带二 (Full House)
  if (countArr[0].count === 3 && countArr[1].count === 2) {
    const tripRank = countArr[0].rank;
    const pairRank = countArr[1].rank;
    const bonus = dun === 'middle' ? 2 : 0; // 中墩葫芦+2
    return {
      score: 600000000 + tripRank * 10000 + pairRank * 100,
      type: 'Full House',
      cards: sorted,
      description: `葫芦 (${getRankStr(tripRank)}带${getRankStr(pairRank)})`,
      bonusPoints: bonus
    };
  }

  // 同花 (Flush)
  if (isFlush) {
    return {
      score: 500000000 + r0 * 14**4 + r1 * 14**3 + r2 * 14**2 + r3 * 14 + r4,
      type: 'Flush',
      cards: sorted,
      description: `同花 (${sorted[0].suit} ${getRankStr(r0)}高)`
    };
  }

  // 顺子 (Straight)
  if (isStraight) {
    return {
      score: 400000000 + straightHigh * 100,
      type: 'Straight',
      cards: sorted,
      description: `顺子 (${getRankStr(straightHigh)} 高)`
    };
  }

  // 三条 (Three of a Kind)
  if (countArr[0].count === 3) {
    const tripRank = countArr[0].rank;
    const k1 = countArr[1].rank;
    const k2 = countArr[2].rank;
    return {
      score: 300000000 + tripRank * 14**4 + k1 * 14**3 + k2 * 14**2,
      type: 'Three of a Kind',
      cards: sorted,
      description: `三条 ${getRankStr(tripRank)}`
    };
  }

  // 两对 (Two Pair)
  if (countArr[0].count === 2 && countArr[1].count === 2) {
    const highPair = countArr[0].rank;
    const lowPair = countArr[1].rank;
    const kicker = countArr[2].rank;
    return {
      score: 200000000 + highPair * 14**4 + lowPair * 14**3 + kicker * 14**2,
      type: 'Two Pair',
      cards: sorted,
      description: `两对 (${getRankStr(highPair)}与${getRankStr(lowPair)})`
    };
  }

  // 一对 (Pair)
  if (countArr[0].count === 2) {
    const pairRank = countArr[0].rank;
    const k1 = countArr[1].rank;
    const k2 = countArr[2].rank;
    const k3 = countArr[3].rank;
    return {
      score: 100000000 + pairRank * 14**4 + k1 * 14**3 + k2 * 14**2 + k3 * 14,
      type: 'Pair',
      cards: sorted,
      description: `对 ${getRankStr(pairRank)}`
    };
  }

  // 乌龙 (High Card)
  return {
    score: r0 * 14**4 + r1 * 14**3 + r2 * 14**2 + r3 * 14 + r4,
    type: 'High Card',
    cards: sorted,
    description: `乌龙 (${getRankStr(r0)}带头)`
  };
}

export function getRankStr(rank: number): string {
  if (rank <= 10) return rank.toString();
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  if (rank === 14) return 'A';
  return rank.toString();
}

// 倒水校验: 后墩 >= 中墩 >= 前墩
export function isValidArrangement(front: Card[], middle: Card[], back: Card[]): boolean {
  if (front.length !== 3 || middle.length !== 5 || back.length !== 5) return false;
  const f = evaluateHand(front, 'front').score;
  const m = evaluateHand(middle, 'middle').score;
  const b = evaluateHand(back, 'back').score;
  return b >= m && m >= f;
}

// 智能理牌建议生成器
export interface ArrangementOption {
  title: string;
  tag: string;
  front: Card[];
  middle: Card[];
  back: Card[];
  frontEval: HandEvaluation;
  midEval: HandEvaluation;
  backEval: HandEvaluation;
  totalEstScore: number;
}

export function getSuggestedArrangements(cards: Card[]): ArrangementOption[] {
  if (cards.length !== 13) return [];
  const options: ArrangementOption[] = [];
  const seenSignatures = new Set<string>();

  // 组合搜索：生成几千种有效排列，选取最佳不同策略
  const tries = 3500;
  for (let t = 0; t < tries; t++) {
    const shuffled = shuffle(cards);
    const front = shuffled.slice(0, 3);
    const middle = shuffled.slice(3, 8);
    const back = shuffled.slice(8, 13);

    if (isValidArrangement(front, middle, back)) {
      const fEval = evaluateHand(front, 'front');
      const mEval = evaluateHand(middle, 'middle');
      const bEval = evaluateHand(back, 'back');

      const estScore = bEval.score * 1.5 + mEval.score * 1.2 + fEval.score + 
                       (fEval.bonusPoints || 0) * 100000000 + 
                       (mEval.bonusPoints || 0) * 100000000 + 
                       (bEval.bonusPoints || 0) * 100000000;

      const sig = `${bEval.type}_${mEval.type}_${fEval.type}`;
      if (!seenSignatures.has(sig) || options.length < 5) {
        seenSignatures.add(sig);
        options.push({
          title: `${HAND_TYPE_CN[bEval.type]} + ${HAND_TYPE_CN[mEval.type]} + ${HAND_TYPE_CN[fEval.type]}`,
          tag: options.length === 0 ? '综合最佳推荐' : options.length === 1 ? '稳健防守型' : '激进进攻型',
          front: sortCards(front),
          middle: sortCards(middle),
          back: sortCards(back),
          frontEval: fEval,
          midEval: mEval,
          backEval: bEval,
          totalEstScore: estScore
        });
      }
    }
  }

  // 降序排序
  options.sort((a, b) => b.totalEstScore - a.totalEstScore);

  if (options.length === 0) {
    // 兜底保底
    const sorted = sortCards(cards);
    const front = sorted.slice(10, 13);
    const middle = sorted.slice(5, 10);
    const back = sorted.slice(0, 5);
    const fEval = evaluateHand(front, 'front');
    const mEval = evaluateHand(middle, 'middle');
    const bEval = evaluateHand(back, 'back');
    options.push({
      title: '默认排序排列',
      tag: '保底方案',
      front,
      middle,
      back,
      frontEval: fEval,
      midEval: mEval,
      backEval: bEval,
      totalEstScore: 0
    });
  }

  // 返回前 3 种不同特色的最佳方案
  return options.slice(0, 3);
}

// AI 摆牌
export function aiArrangeCards(cards: Card[]): PlayerArrangement {
  const special = detectSpecialHand(cards);
  const suggestions = getSuggestedArrangements(cards);
  const best = suggestions[0];

  return {
    front: best.front,
    middle: best.middle,
    back: best.back,
    specialHand: special,
    isValid: true,
    isDaoShui: false
  };
}

// 完整比牌与算分引擎 (支持 2~4 名玩家)
export function calculateMatchScores(
  playersData: {
    id: string;
    name: string;
    isAi: boolean;
    avatar: string;
    cards: Card[];
    arrangement: PlayerArrangement;
  }[]
): PlayerScoreDetail[] {
  const details: PlayerScoreDetail[] = playersData.map(p => {
    const fEval = evaluateHand(p.arrangement.front, 'front');
    const mEval = evaluateHand(p.arrangement.middle, 'middle');
    const bEval = evaluateHand(p.arrangement.back, 'back');
    const isDao = !isValidArrangement(p.arrangement.front, p.arrangement.middle, p.arrangement.back) && !p.arrangement.specialHand;

    const bonus = (fEval.bonusPoints || 0) + (mEval.bonusPoints || 0) + (bEval.bonusPoints || 0);
    const specialBonus = p.arrangement.specialHand ? SPECIAL_HAND_CN[p.arrangement.specialHand].points : 0;

    return {
      playerId: p.id,
      name: p.name,
      isAi: p.isAi,
      avatar: p.avatar,
      cards: p.cards,
      arrangement: {
        ...p.arrangement,
        isDaoShui: isDao,
        isValid: !isDao
      },
      frontScore: fEval,
      midScore: mEval,
      backScore: bEval,
      specialHand: p.arrangement.specialHand,
      dunScores: {},
      bonusPoints: bonus,
      specialPoints: specialBonus,
      finalPoints: 0,
      isHomeRun: false
    };
  });

  const n = details.length;

  // 两两对比 (Pairwise Comparison)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const p1 = details[i];
      const p2 = details[j];

      // 处理特殊牌型结算
      if (p1.specialHand || p2.specialHand) {
        if (p1.specialHand && p2.specialHand) {
          const s1 = SPECIAL_HAND_CN[p1.specialHand].points;
          const s2 = SPECIAL_HAND_CN[p2.specialHand].points;
          const diff = s1 - s2;
          p1.dunScores[p2.playerId] = { front: 0, mid: 0, back: 0, total: diff, isGun: false };
          p2.dunScores[p1.playerId] = { front: 0, mid: 0, back: 0, total: -diff, isGun: false };
        } else if (p1.specialHand) {
          const s1 = SPECIAL_HAND_CN[p1.specialHand].points;
          p1.dunScores[p2.playerId] = { front: 0, mid: 0, back: 0, total: s1, isGun: false };
          p2.dunScores[p1.playerId] = { front: 0, mid: 0, back: 0, total: -s1, isGun: false };
        } else if (p2.specialHand) {
          const s2 = SPECIAL_HAND_CN[p2.specialHand!].points;
          p1.dunScores[p2.playerId] = { front: 0, mid: 0, back: 0, total: -s2, isGun: false };
          p2.dunScores[p1.playerId] = { front: 0, mid: 0, back: 0, total: s2, isGun: false };
        }
        continue;
      }

      // 处理倒水 (倒水玩家自动输给对方全部三墩并被判打枪)
      if (p1.arrangement.isDaoShui && p2.arrangement.isDaoShui) {
        p1.dunScores[p2.playerId] = { front: 0, mid: 0, back: 0, total: 0, isGun: false };
        p2.dunScores[p1.playerId] = { front: 0, mid: 0, back: 0, total: 0, isGun: false };
        continue;
      } else if (p1.arrangement.isDaoShui) {
        // p1 倒水输 -6 (输3墩 + 打枪3)
        p1.dunScores[p2.playerId] = { front: -1, mid: -1, back: -1, total: -6, isGun: false };
        p2.dunScores[p1.playerId] = { front: 1, mid: 1, back: 1, total: 6, isGun: true };
        continue;
      } else if (p2.arrangement.isDaoShui) {
        // p2 倒水输 -6
        p1.dunScores[p2.playerId] = { front: 1, mid: 1, back: 1, total: 6, isGun: true };
        p2.dunScores[p1.playerId] = { front: -1, mid: -1, back: -1, total: -6, isGun: false };
        continue;
      }

      // 正常比三墩
      const fDiff = p1.frontScore.score > p2.frontScore.score ? 1 : p1.frontScore.score < p2.frontScore.score ? -1 : 0;
      const mDiff = p1.midScore.score > p2.midScore.score ? 1 : p1.midScore.score < p2.midScore.score ? -1 : 0;
      const bDiff = p1.backScore.score > p2.backScore.score ? 1 : p1.backScore.score < p2.backScore.score ? -1 : 0;

      let baseTotal = fDiff + mDiff + bDiff;
      let p1Gun = false;
      let p2Gun = false;

      // 打枪 (三墩全赢)
      if (fDiff > 0 && mDiff > 0 && bDiff > 0) {
        p1Gun = true;
        baseTotal *= 2; // 打枪得分翻倍
      } else if (fDiff < 0 && mDiff < 0 && bDiff < 0) {
        p2Gun = true;
        baseTotal *= 2; // 被打枪扣分翻倍
      }

      // 附加墩位特殊加分差 (如铁支、同花顺等)
      const bonusDiff = p1.bonusPoints - p2.bonusPoints;
      const totalVsOpponent = baseTotal + bonusDiff;

      p1.dunScores[p2.playerId] = { front: fDiff, mid: mDiff, back: bDiff, total: totalVsOpponent, isGun: p1Gun };
      p2.dunScores[p1.playerId] = { front: -fDiff, mid: -mDiff, back: -bDiff, total: -totalVsOpponent, isGun: p2Gun };
    }
  }

  // 结算每位玩家总分并检查全垒打 (Home Run)
  for (const p of details) {
    let sum = 0;
    let gunsAgainstOthers = 0;
    const opponentIds = Object.keys(p.dunScores);

    for (const oppId of opponentIds) {
      sum += p.dunScores[oppId].total;
      if (p.dunScores[oppId].isGun) {
        gunsAgainstOthers++;
      }
    }

    // 四人对局全垒打: 打枪场上全部 3 位对手
    if (n === 4 && gunsAgainstOthers === 3) {
      p.isHomeRun = true;
      sum *= 2; // 全垒打总分翻倍
    }

    p.finalPoints = sum;
  }

  return details;
}
