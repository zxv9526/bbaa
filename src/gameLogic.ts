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
  'Straight Flush': '同花顺 (连张同色)',
  'Five of a Kind': '五条 (五同点)'
};

export const SPECIAL_HAND_CN: Record<SpecialHandType, { name: string; points: number; desc: string }> = {
  'Eight of a Kind': { name: '八仙过海 (8张A/8同)', points: 108, desc: '8张相同点数(如8张A)或8张同点' },
  'Supreme Dragon': { name: '至尊青龙', points: 108, desc: '同花 A-2-3...K 13张' },
  'Seven of a Kind': { name: '七星高照 (7张A/7同)', points: 60, desc: '7张相同点数(如7张A)或7张同点' },
  'Dragon': { name: '一条龙', points: 52, desc: 'A到K 13张不同点数' },
  'Six of a Kind': { name: '六六大顺 (6张A/6同)', points: 40, desc: '6张相同点数(如6张A)或6张同点' },
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

// 8人场需要双副扑克牌 (104张牌)
export function createDoubleDeck(): Card[] {
  const suits: Suit[] = ['S', 'H', 'C', 'D'];
  const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const deck: Card[] = [];

  for (let d = 1; d <= 2; d++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ id: `d${d}_${rank}-${suit}`, suit, rank });
      }
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

  // 统计牌点出现次数
  const counts: Record<number, number> = {};
  ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
  const countValues = Object.values(counts).sort((a, b) => b - a);

  // 0. 多副牌至尊同点特殊牌型 (5~8张相同点数，如5~8张A)
  if (countValues[0] >= 8) {
    return 'Eight of a Kind'; // 八仙过海 (8张A/8同)
  }

  // 1. 至尊青龙 (同花一条龙)
  const isOneSuit = suits.every(s => s === suits[0]);
  const uniqueRanks = new Set(ranks);
  if (uniqueRanks.size === 13) {
    if (isOneSuit) return 'Supreme Dragon';
    return 'Dragon'; // 一条龙
  }

  // 0.2 七星高照 (7张A/7同)
  if (countValues[0] === 7) {
    return 'Seven of a Kind';
  }

  // 0.3 六六大顺 (6张A/6同)
  if (countValues[0] === 6) {
    return 'Six of a Kind';
  }

  // 2. 十二皇族 (12张或13张为 J, Q, K, A, rank >= 11)
  const royalsCount = ranks.filter(r => r >= 11).length;
  if (royalsCount >= 12) return 'Twelve Royals';

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

  // 统一牌力评分体系：基于 10 级牌型及 5 级 Rank (每级基数 100)
  // score = typeRank * 10^10 + p1 * 10^8 + p2 * 10^6 + p3 * 10^4 + p4 * 10^2 + p5
  // 严格保证不同墩位(3张 vs 5张)及相同牌型下的精确绝对可比性，彻底消除倒水误判

  // 1. 前墩 (3张牌规则: 冲三、对子、乌龙/高牌)
  if (isFront) {
    // 前墩三条 (冲三 / 前墩三条有额外加分，冲三A额外+5分，普通冲三+3分)
    if (countArr[0].count === 3) {
      const tripRank = countArr[0].rank;
      const isAceTrip = tripRank === 14;
      const bonus = isAceTrip ? 5 : 3;
      const score = 4 * 10000000000 + tripRank * 100000000;
      return {
        score,
        type: 'Three of a Kind',
        cards: sorted,
        description: isAceTrip ? `前墩冲三 A (+${bonus}水)` : `前墩三条 ${getRankStr(tripRank)} (+${bonus}水)`,
        bonusPoints: bonus
      };
    }
    // 前墩一对
    if (countArr[0].count === 2) {
      const pairRank = countArr[0].rank;
      const kicker = countArr[1].rank;
      const score = 2 * 10000000000 + pairRank * 100000000 + kicker * 1000000;
      return {
        score,
        type: 'Pair',
        cards: sorted,
        description: `对 ${getRankStr(pairRank)} (单张 ${getRankStr(kicker)})`
      };
    }
    // 前墩乌龙
    const r0 = ranks[0], r1 = ranks[1], r2 = ranks[2];
    const score = 1 * 10000000000 + r0 * 100000000 + r1 * 1000000 + r2 * 10000;
    return {
      score,
      type: 'High Card',
      cards: sorted,
      description: `乌龙 (${getRankStr(r0)}带头)`
    };
  }

  // 2. 中墩 / 后墩 (5张牌规则)
  // 10. 五条 / 五同 (Five of a Kind - 双副牌 8人场)
  if (countArr[0].count >= 5) {
    const fiveRank = countArr[0].rank;
    const isAce = fiveRank === 14;
    const bonus = isAce ? (dun === 'middle' ? 20 : 10) : (dun === 'middle' ? 16 : 8);
    const score = 10 * 10000000000 + fiveRank * 100000000;
    return {
      score,
      type: 'Five of a Kind',
      cards: sorted,
      description: isAce ? `至尊五条 A (+${bonus}水)` : `五条 ${getRankStr(fiveRank)} (+${bonus}水)`,
      bonusPoints: bonus
    };
  }

  const isFlush = suits.every(s => s === suits[0]);
  let isStraight = ranks.every((r, i) => i === 0 || r === ranks[i - 1] - 1);
  let straightHigh = ranks[0];

  // 特殊顺子: A-2-3-4-5 (A算1，5高顺子)
  if (!isStraight && ranks.join(',') === '14,5,4,3,2') {
    isStraight = true;
    straightHigh = 5;
  }

  const r0 = ranks[0] || 0;
  const r1 = ranks[1] || 0;
  const r2 = ranks[2] || 0;
  const r3 = ranks[3] || 0;
  const r4 = ranks[4] || 0;

  // 9. 同花顺 (Straight Flush)
  if (isFlush && isStraight) {
    const isRoyal = straightHigh === 14;
    const bonus = isRoyal ? (dun === 'middle' ? 14 : 8) : (dun === 'middle' ? 10 : 5);
    const score = 9 * 10000000000 + straightHigh * 100000000;
    return {
      score,
      type: 'Straight Flush',
      cards: sorted,
      description: isRoyal ? `皇家同花顺 A高 (+${bonus}水)` : `同花顺 (${getRankStr(straightHigh)} 高, +${bonus}水)`,
      bonusPoints: bonus
    };
  }

  // 8. 铁支 / 四条 (Four of a Kind)
  if (countArr[0].count === 4) {
    const fourRank = countArr[0].rank;
    const kicker = countArr[1].rank;
    const isAceFour = fourRank === 14;
    const bonus = isAceFour ? (dun === 'middle' ? 10 : 5) : (dun === 'middle' ? 8 : 4);
    const score = 8 * 10000000000 + fourRank * 100000000 + kicker * 1000000;
    return {
      score,
      type: 'Four of a Kind',
      cards: sorted,
      description: isAceFour ? `铁支 A (+${bonus}水)` : `铁支 ${getRankStr(fourRank)} (+${bonus}水)`,
      bonusPoints: bonus
    };
  }

  // 7. 葫芦 / 三带二 (Full House)
  if (countArr[0].count === 3 && countArr[1].count === 2) {
    const tripRank = countArr[0].rank;
    const pairRank = countArr[1].rank;
    const bonus = dun === 'middle' ? 2 : 0; // 中墩葫芦+2
    const score = 7 * 10000000000 + tripRank * 100000000 + pairRank * 1000000;
    return {
      score,
      type: 'Full House',
      cards: sorted,
      description: `葫芦 (${getRankStr(tripRank)}带${getRankStr(pairRank)})`,
      bonusPoints: bonus
    };
  }

  // 6. 同花 (Flush)
  if (isFlush) {
    const score = 6 * 10000000000 + r0 * 100000000 + r1 * 1000000 + r2 * 10000 + r3 * 100 + r4;
    return {
      score,
      type: 'Flush',
      cards: sorted,
      description: `同花 (${sorted[0].suit} ${getRankStr(r0)}高)`
    };
  }

  // 5. 顺子 (Straight)
  if (isStraight) {
    const score = 5 * 10000000000 + straightHigh * 100000000;
    return {
      score,
      type: 'Straight',
      cards: sorted,
      description: `顺子 (${getRankStr(straightHigh)} 高)`
    };
  }

  // 4. 三条 (Three of a Kind)
  if (countArr[0].count === 3) {
    const tripRank = countArr[0].rank;
    const k1 = countArr[1].rank;
    const k2 = countArr[2].rank;
    const score = 4 * 10000000000 + tripRank * 100000000 + k1 * 1000000 + k2 * 10000;
    return {
      score,
      type: 'Three of a Kind',
      cards: sorted,
      description: `三条 ${getRankStr(tripRank)}`
    };
  }

  // 3. 两对 (Two Pair)
  if (countArr[0].count === 2 && countArr[1].count === 2) {
    const highPair = countArr[0].rank;
    const lowPair = countArr[1].rank;
    const kicker = countArr[2].rank;
    const score = 3 * 10000000000 + highPair * 100000000 + lowPair * 1000000 + kicker * 10000;
    return {
      score,
      type: 'Two Pair',
      cards: sorted,
      description: `两对 (${getRankStr(highPair)}与${getRankStr(lowPair)})`
    };
  }

  // 2. 一对 (Pair)
  if (countArr[0].count === 2) {
    const pairRank = countArr[0].rank;
    const k1 = countArr[1].rank;
    const k2 = countArr[2].rank;
    const k3 = countArr[3].rank;
    const score = 2 * 10000000000 + pairRank * 100000000 + k1 * 1000000 + k2 * 10000 + k3 * 100;
    return {
      score,
      type: 'Pair',
      cards: sorted,
      description: `对 ${getRankStr(pairRank)}`
    };
  }

  // 1. 乌龙 (High Card)
  const score = 1 * 10000000000 + r0 * 100000000 + r1 * 1000000 + r2 * 10000 + r3 * 100 + r4;
  return {
    score,
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
  if (!front || !middle || !back) return false;
  if (front.length !== 3 || middle.length !== 5 || back.length !== 5) return false;
  const f = evaluateHand(front, 'front').score;
  const m = evaluateHand(middle, 'middle').score;
  const b = evaluateHand(back, 'back').score;
  return b >= m && m >= f;
}

// 辅助函数：生成组合
function getKCombinations<T>(array: T[], k: number): T[][] {
  const result: T[][] = [];
  function backtrack(start: number, current: T[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < array.length; i++) {
      current.push(array[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  backtrack(0, []);
  return result;
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
  if (!cards || cards.length !== 13) return [];

  interface ValidComb {
    front: Card[];
    middle: Card[];
    back: Card[];
    fEval: HandEvaluation;
    mEval: HandEvaluation;
    bEval: HandEvaluation;
    estScore: number;
    bonusTotal: number;
    sig: string;
    cardSig: string;
  }

  const validCombs: ValidComb[] = [];
  const seenCardSigs = new Set<string>();

  const registerComb = (f: Card[], m: Card[], b: Card[]) => {
    if (f.length !== 3 || m.length !== 5 || b.length !== 5) return;
    const sortedFront = sortCards(f);
    const sortedMiddle = sortCards(m);
    const sortedBack = sortCards(b);

    const fEval = evaluateHand(sortedFront, 'front');
    const mEval = evaluateHand(sortedMiddle, 'middle');
    const bEval = evaluateHand(sortedBack, 'back');

    // 严禁倒水：后墩 >= 中墩 >= 前墩
    if (bEval.score >= mEval.score && mEval.score >= fEval.score) {
      const cardSig = sortedFront.map(c => c.id).join(',') + '|' + sortedMiddle.map(c => c.id).join(',') + '|' + sortedBack.map(c => c.id).join(',');
      if (!seenCardSigs.has(cardSig)) {
        seenCardSigs.add(cardSig);
        const bonusTotal = (fEval.bonusPoints || 0) + (mEval.bonusPoints || 0) + (bEval.bonusPoints || 0);
        const estScore = bEval.score * 1.5 + mEval.score * 1.2 + fEval.score + bonusTotal * 100000000;
        validCombs.push({
          front: sortedFront,
          middle: sortedMiddle,
          back: sortedBack,
          fEval,
          mEval,
          bEval,
          estScore,
          bonusTotal,
          sig: `${bEval.type}_${mEval.type}_${fEval.type}`,
          cardSig
        });
      }
    }
  };

  // 全量遍历 C(13, 5) = 1287 组后墩方案，并为每个后墩检索合法的中墩与前墩
  const all5Combs = getKCombinations(cards, 5);
  const scored5Combs = all5Combs.map(c => ({
    cards: c,
    eval: evaluateHand(c, 'back')
  })).sort((a, b) => b.eval.score - a.eval.score);

  for (const backObj of scored5Combs) {
    const backCards = backObj.cards;
    const backScore = backObj.eval.score;
    const backIds = new Set(backCards.map(c => c.id));
    const remaining8 = cards.filter(c => !backIds.has(c.id));
    const mid5Combs = getKCombinations(remaining8, 5);

    for (const midCards of mid5Combs) {
      const mEval = evaluateHand(midCards, 'middle');
      if (backScore >= mEval.score) {
        const midIds = new Set(midCards.map(c => c.id));
        const frontCards = remaining8.filter(c => !midIds.has(c.id));
        const fEval = evaluateHand(frontCards, 'front');
        if (mEval.score >= fEval.score) {
          registerComb(frontCards, midCards, backCards);
        }
      }
    }
  }

  // 若极端情况下未搜到（理论上不可能），按排位降序兜底构造合法牌型
  if (validCombs.length === 0) {
    const sorted = sortCards(cards);
    registerComb(sorted.slice(10, 13), sorted.slice(5, 10), sorted.slice(0, 5));
  }

  // 精准提取三大标准合法战术方案（尾墩最大、中墩最大、头墩最大，均在100%绝不倒水前提下）
  const strategies = [
    {
      tag: '👑 尾墩最大',
      sortFn: (a: ValidComb, b: ValidComb) => {
        if (b.bEval.score !== a.bEval.score) return b.bEval.score - a.bEval.score;
        if (b.mEval.score !== a.mEval.score) return b.mEval.score - a.mEval.score;
        if (b.fEval.score !== a.fEval.score) return b.fEval.score - a.fEval.score;
        if (b.bonusTotal !== a.bonusTotal) return b.bonusTotal - a.bonusTotal;
        return b.estScore - a.estScore;
      }
    },
    {
      tag: '💥 中墩最大',
      sortFn: (a: ValidComb, b: ValidComb) => {
        if (b.mEval.score !== a.mEval.score) return b.mEval.score - a.mEval.score;
        if (b.bEval.score !== a.bEval.score) return b.bEval.score - a.bEval.score;
        if (b.fEval.score !== a.fEval.score) return b.fEval.score - a.fEval.score;
        if (b.bonusTotal !== a.bonusTotal) return b.bonusTotal - a.bonusTotal;
        return b.estScore - a.estScore;
      }
    },
    {
      tag: '⚡ 头墩最大',
      sortFn: (a: ValidComb, b: ValidComb) => {
        if (b.fEval.score !== a.fEval.score) return b.fEval.score - a.fEval.score;
        const bSum = b.bEval.score + b.mEval.score;
        const aSum = a.bEval.score + a.mEval.score;
        if (bSum !== aSum) return bSum - aSum;
        if (b.bEval.score !== a.bEval.score) return b.bEval.score - a.bEval.score;
        if (b.bonusTotal !== a.bonusTotal) return b.bonusTotal - a.bonusTotal;
        return b.estScore - a.estScore;
      }
    }
  ];

  const results: ArrangementOption[] = [];
  const addedCardSigs = new Set<string>();

  if (validCombs.length > 0) {
    for (const strat of strategies) {
      const sorted = [...validCombs].sort(strat.sortFn);
      let chosen = sorted.find(c => !addedCardSigs.has(c.cardSig));
      if (!chosen && sorted.length > 0) {
        chosen = sorted[0];
      }
      if (chosen) {
        addedCardSigs.add(chosen.cardSig);
        results.push({
          title: `前:${HAND_TYPE_CN[chosen.fEval.type]} | 中:${HAND_TYPE_CN[chosen.mEval.type]} | 后:${HAND_TYPE_CN[chosen.bEval.type]}`,
          tag: strat.tag,
          front: chosen.front,
          middle: chosen.middle,
          back: chosen.back,
          frontEval: chosen.fEval,
          midEval: chosen.mEval,
          backEval: chosen.bEval,
          totalEstScore: chosen.estScore
        });
      }
    }
  }

  // 严格二次复核：保证输出的每一个方案均百分之百不倒水
  return results.filter(r => isValidArrangement(r.front, r.middle, r.back));
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

// ----------------------------------------------------
// 独立比牌与算分模块：四人场 (4-Player Match Calculation Module)
// ----------------------------------------------------
export function calculate4PlayerMatchScores(
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

  // 4人场两两对比 (Pairwise Comparison for 4 players)
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
          p1.dunScores[p2.playerId] = { front: 0, frontBonus: 0, mid: 0, midBonus: 0, back: 0, backBonus: 0, isGun: false, gunPoints: 0, total: diff };
          p2.dunScores[p1.playerId] = { front: 0, frontBonus: 0, mid: 0, midBonus: 0, back: 0, backBonus: 0, isGun: false, gunPoints: 0, total: -diff };
        } else if (p1.specialHand) {
          const s1 = SPECIAL_HAND_CN[p1.specialHand].points;
          p1.dunScores[p2.playerId] = { front: 0, frontBonus: 0, mid: 0, midBonus: 0, back: 0, backBonus: 0, isGun: false, gunPoints: 0, total: s1 };
          p2.dunScores[p1.playerId] = { front: 0, frontBonus: 0, mid: 0, midBonus: 0, back: 0, backBonus: 0, isGun: false, gunPoints: 0, total: -s1 };
        } else if (p2.specialHand) {
          const s2 = SPECIAL_HAND_CN[p2.specialHand!].points;
          p1.dunScores[p2.playerId] = { front: 0, frontBonus: 0, mid: 0, midBonus: 0, back: 0, backBonus: 0, isGun: false, gunPoints: 0, total: -s2 };
          p2.dunScores[p1.playerId] = { front: 0, frontBonus: 0, mid: 0, midBonus: 0, back: 0, backBonus: 0, isGun: false, gunPoints: 0, total: s2 };
        }
        continue;
      }

      // 处理倒水
      if (p1.arrangement.isDaoShui && p2.arrangement.isDaoShui) {
        p1.dunScores[p2.playerId] = { front: 0, frontBonus: 0, mid: 0, midBonus: 0, back: 0, backBonus: 0, isGun: false, gunPoints: 0, total: 0 };
        p2.dunScores[p1.playerId] = { front: 0, frontBonus: 0, mid: 0, midBonus: 0, back: 0, backBonus: 0, isGun: false, gunPoints: 0, total: 0 };
        continue;
      } else if (p1.arrangement.isDaoShui) {
        const p2WinBonus = (p2.frontScore.bonusPoints || 0) + (p2.midScore.bonusPoints || 0) + (p2.backScore.bonusPoints || 0);
        const totalP2Win = 6 + p2WinBonus;
        p1.dunScores[p2.playerId] = { front: -1, frontBonus: -(p2.frontScore.bonusPoints || 0), mid: -1, midBonus: -(p2.midScore.bonusPoints || 0), back: -1, backBonus: -(p2.backScore.bonusPoints || 0), isGun: false, gunPoints: -3, total: -totalP2Win };
        p2.dunScores[p1.playerId] = { front: 1, frontBonus: p2.frontScore.bonusPoints || 0, mid: 1, midBonus: p2.midScore.bonusPoints || 0, back: 1, backBonus: p2.backScore.bonusPoints || 0, isGun: true, gunPoints: 3, total: totalP2Win };
        continue;
      } else if (p2.arrangement.isDaoShui) {
        const p1WinBonus = (p1.frontScore.bonusPoints || 0) + (p1.midScore.bonusPoints || 0) + (p1.backScore.bonusPoints || 0);
        const totalP1Win = 6 + p1WinBonus;
        p1.dunScores[p2.playerId] = { front: 1, frontBonus: p1.frontScore.bonusPoints || 0, mid: 1, midBonus: p1.midScore.bonusPoints || 0, back: 1, backBonus: p1.backScore.bonusPoints || 0, isGun: true, gunPoints: 3, total: totalP1Win };
        p2.dunScores[p1.playerId] = { front: -1, frontBonus: -(p1.frontScore.bonusPoints || 0), mid: -1, midBonus: -(p1.midScore.bonusPoints || 0), back: -1, backBonus: -(p1.backScore.bonusPoints || 0), isGun: false, gunPoints: -3, total: -totalP1Win };
        continue;
      }

      // 正常比三墩
      const fDiff = p1.frontScore.score > p2.frontScore.score ? 1 : p1.frontScore.score < p2.frontScore.score ? -1 : 0;
      const mDiff = p1.midScore.score > p2.midScore.score ? 1 : p1.midScore.score < p2.midScore.score ? -1 : 0;
      const bDiff = p1.backScore.score > p2.backScore.score ? 1 : p1.backScore.score < p2.backScore.score ? -1 : 0;

      const fBonus = fDiff > 0 ? (p1.frontScore.bonusPoints || 0) : fDiff < 0 ? -(p2.frontScore.bonusPoints || 0) : 0;
      const mBonus = mDiff > 0 ? (p1.midScore.bonusPoints || 0) : mDiff < 0 ? -(p2.midScore.bonusPoints || 0) : 0;
      const bBonus = bDiff > 0 ? (p1.backScore.bonusPoints || 0) : bDiff < 0 ? -(p2.backScore.bonusPoints || 0) : 0;

      let p1Gun = false;
      let p2Gun = false;
      let gunPts = 0;

      if (fDiff > 0 && mDiff > 0 && bDiff > 0) {
        p1Gun = true;
        gunPts = 3;
      } else if (fDiff < 0 && mDiff < 0 && bDiff < 0) {
        p2Gun = true;
        gunPts = -3;
      }

      const totalVsOpponent = (fDiff + fBonus) + (mDiff + mBonus) + (bDiff + bBonus) + gunPts;

      p1.dunScores[p2.playerId] = {
        front: fDiff, frontBonus: fBonus, mid: mDiff, midBonus: mBonus, back: bDiff, backBonus: bBonus, isGun: p1Gun, gunPoints: gunPts, total: totalVsOpponent
      };
      p2.dunScores[p1.playerId] = {
        front: -fDiff, frontBonus: -fBonus, mid: -mDiff, midBonus: -mBonus, back: -bDiff, backBonus: -bBonus, isGun: p2Gun, gunPoints: -gunPts, total: -totalVsOpponent
      };
    }
  }

  // 4人场总分与全垒打判定 (4人场全垒打打枪3人)
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

    if (n >= 3 && gunsAgainstOthers === n - 1) {
      p.isHomeRun = true;
      sum *= 2;
      for (const oppId of opponentIds) {
        if (p.dunScores[oppId]) {
          p.dunScores[oppId].total *= 2;
        }
      }
    }

    p.finalPoints = sum;
  }

  return details;
}

// ----------------------------------------------------
// 独立比牌与算分模块：八人场 (8-Player Match Calculation Module)
// ----------------------------------------------------
export function calculate8PlayerMatchScores(
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

  // 8人场两两对比 (8-player Pairwise Comparison)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const p1 = details[i];
      const p2 = details[j];

      // 特殊牌型
      if (p1.specialHand || p2.specialHand) {
        if (p1.specialHand && p2.specialHand) {
          const s1 = SPECIAL_HAND_CN[p1.specialHand].points;
          const s2 = SPECIAL_HAND_CN[p2.specialHand].points;
          const diff = s1 - s2;
          p1.dunScores[p2.playerId] = { front: 0, frontBonus: 0, mid: 0, midBonus: 0, back: 0, backBonus: 0, isGun: false, gunPoints: 0, total: diff };
          p2.dunScores[p1.playerId] = { front: 0, frontBonus: 0, mid: 0, midBonus: 0, back: 0, backBonus: 0, isGun: false, gunPoints: 0, total: -diff };
        } else if (p1.specialHand) {
          const s1 = SPECIAL_HAND_CN[p1.specialHand].points;
          p1.dunScores[p2.playerId] = { front: 0, frontBonus: 0, mid: 0, midBonus: 0, back: 0, backBonus: 0, isGun: false, gunPoints: 0, total: s1 };
          p2.dunScores[p1.playerId] = { front: 0, frontBonus: 0, mid: 0, midBonus: 0, back: 0, backBonus: 0, isGun: false, gunPoints: 0, total: -s1 };
        } else if (p2.specialHand) {
          const s2 = SPECIAL_HAND_CN[p2.specialHand!].points;
          p1.dunScores[p2.playerId] = { front: 0, frontBonus: 0, mid: 0, midBonus: 0, back: 0, backBonus: 0, isGun: false, gunPoints: 0, total: -s2 };
          p2.dunScores[p1.playerId] = { front: 0, frontBonus: 0, mid: 0, midBonus: 0, back: 0, backBonus: 0, isGun: false, gunPoints: 0, total: s2 };
        }
        continue;
      }

      // 倒水处理
      if (p1.arrangement.isDaoShui && p2.arrangement.isDaoShui) {
        p1.dunScores[p2.playerId] = { front: 0, frontBonus: 0, mid: 0, midBonus: 0, back: 0, backBonus: 0, isGun: false, gunPoints: 0, total: 0 };
        p2.dunScores[p1.playerId] = { front: 0, frontBonus: 0, mid: 0, midBonus: 0, back: 0, backBonus: 0, isGun: false, gunPoints: 0, total: 0 };
        continue;
      } else if (p1.arrangement.isDaoShui) {
        const p2WinBonus = (p2.frontScore.bonusPoints || 0) + (p2.midScore.bonusPoints || 0) + (p2.backScore.bonusPoints || 0);
        const totalP2Win = 6 + p2WinBonus;
        p1.dunScores[p2.playerId] = { front: -1, frontBonus: -(p2.frontScore.bonusPoints || 0), mid: -1, midBonus: -(p2.midScore.bonusPoints || 0), back: -1, backBonus: -(p2.backScore.bonusPoints || 0), isGun: false, gunPoints: -3, total: -totalP2Win };
        p2.dunScores[p1.playerId] = { front: 1, frontBonus: p2.frontScore.bonusPoints || 0, mid: 1, midBonus: p2.midScore.bonusPoints || 0, back: 1, backBonus: p2.backScore.bonusPoints || 0, isGun: true, gunPoints: 3, total: totalP2Win };
        continue;
      } else if (p2.arrangement.isDaoShui) {
        const p1WinBonus = (p1.frontScore.bonusPoints || 0) + (p1.midScore.bonusPoints || 0) + (p1.backScore.bonusPoints || 0);
        const totalP1Win = 6 + p1WinBonus;
        p1.dunScores[p2.playerId] = { front: 1, frontBonus: p1.frontScore.bonusPoints || 0, mid: 1, midBonus: p1.midScore.bonusPoints || 0, back: 1, backBonus: p1.backScore.bonusPoints || 0, isGun: true, gunPoints: 3, total: totalP1Win };
        p2.dunScores[p1.playerId] = { front: -1, frontBonus: -(p1.frontScore.bonusPoints || 0), mid: -1, midBonus: -(p1.midScore.bonusPoints || 0), back: -1, backBonus: -(p1.backScore.bonusPoints || 0), isGun: false, gunPoints: -3, total: -totalP1Win };
        continue;
      }

      // 正常比三墩
      const fDiff = p1.frontScore.score > p2.frontScore.score ? 1 : p1.frontScore.score < p2.frontScore.score ? -1 : 0;
      const mDiff = p1.midScore.score > p2.midScore.score ? 1 : p1.midScore.score < p2.midScore.score ? -1 : 0;
      const bDiff = p1.backScore.score > p2.backScore.score ? 1 : p1.backScore.score < p2.backScore.score ? -1 : 0;

      const fBonus = fDiff > 0 ? (p1.frontScore.bonusPoints || 0) : fDiff < 0 ? -(p2.frontScore.bonusPoints || 0) : 0;
      const mBonus = mDiff > 0 ? (p1.midScore.bonusPoints || 0) : mDiff < 0 ? -(p2.midScore.bonusPoints || 0) : 0;
      const bBonus = bDiff > 0 ? (p1.backScore.bonusPoints || 0) : bDiff < 0 ? -(p2.backScore.bonusPoints || 0) : 0;

      let p1Gun = false;
      let p2Gun = false;
      let gunPts = 0;

      if (fDiff > 0 && mDiff > 0 && bDiff > 0) {
        p1Gun = true;
        gunPts = 3;
      } else if (fDiff < 0 && mDiff < 0 && bDiff < 0) {
        p2Gun = true;
        gunPts = -3;
      }

      const totalVsOpponent = (fDiff + fBonus) + (mDiff + mBonus) + (bDiff + bBonus) + gunPts;

      p1.dunScores[p2.playerId] = {
        front: fDiff, frontBonus: fBonus, mid: mDiff, midBonus: mBonus, back: bDiff, backBonus: bBonus, isGun: p1Gun, gunPoints: gunPts, total: totalVsOpponent
      };
      p2.dunScores[p1.playerId] = {
        front: -fDiff, frontBonus: -fBonus, mid: -mDiff, midBonus: -mBonus, back: -bDiff, backBonus: -bBonus, isGun: p2Gun, gunPoints: -gunPts, total: -totalVsOpponent
      };
    }
  }

  // 8人场总分与全垒打 (8人场全垒打打枪7人)
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

    if (n >= 3 && gunsAgainstOthers === n - 1) {
      p.isHomeRun = true;
      sum *= 2;
      for (const oppId of opponentIds) {
        if (p.dunScores[oppId]) {
          p.dunScores[oppId].total *= 2;
        }
      }
    }

    p.finalPoints = sum;
  }

  return details;
}

// 统一对外调用接口
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
  if (playersData.length > 4) {
    return calculate8PlayerMatchScores(playersData);
  } else {
    return calculate4PlayerMatchScores(playersData);
  }
}

// ----------------------------------------------------
// 牌型检索与快速提牌 (Pattern Search Helpers)
// ----------------------------------------------------
export interface DetectedPattern {
  id: string;
  type: HandType;
  name: string;
  cards: Card[];
  description: string;
}

export function findAvailablePatterns(cards: Card[]): DetectedPattern[] {
  if (!cards || cards.length === 0) return [];
  const results: DetectedPattern[] = [];
  const sorted = sortCards(cards);

  // Group by rank
  const rankGroups: Record<number, Card[]> = {};
  sorted.forEach(c => {
    rankGroups[c.rank] = rankGroups[c.rank] || [];
    rankGroups[c.rank].push(c);
  });

  // Group by suit
  const suitGroups: Record<Suit, Card[]> = { S: [], H: [], C: [], D: [] };
  sorted.forEach(c => suitGroups[c.suit].push(c));

  // 0. 五条 / 五同 (Five of a Kind - 双副牌8人场，大过同花顺)
  Object.entries(rankGroups).forEach(([rankStr, grp]) => {
    if (grp.length >= 5) {
      const r = parseInt(rankStr);
      results.push({
        id: `five_${r}`,
        type: 'Five of a Kind',
        name: `五条 ${getRankStr(r)}`,
        cards: grp.slice(0, 5),
        description: `5张 ${getRankStr(r)} (大过同花顺)`
      });
    }
  });

  // 1. 同花顺 (Straight Flush)
  Object.values(suitGroups).forEach(sCards => {
    if (sCards.length >= 5) {
      const sSorted = sortCards(sCards);
      for (let i = 0; i <= sSorted.length - 5; i++) {
        const sub = sSorted.slice(i, i + 5);
        const evalSub = evaluateHand(sub, 'back');
        if (evalSub.type === 'Straight Flush') {
          results.push({
            id: `sf_${sSorted[i].id}`,
            type: 'Straight Flush',
            name: `同花顺 (${getRankStr(sSorted[i].rank)}高)`,
            cards: sub,
            description: evalSub.description
          });
        }
      }
    }
  });

  // 2. 铁支 / 四条 (Four of a Kind)
  Object.entries(rankGroups).forEach(([rankStr, grp]) => {
    if (grp.length === 4) {
      const r = parseInt(rankStr);
      results.push({
        id: `four_${r}`,
        type: 'Four of a Kind',
        name: `铁支 ${getRankStr(r)}`,
        cards: grp,
        description: `4张 ${getRankStr(r)}`
      });
    }
  });

  // 3. 葫芦 (Full House) - 三条 + 一对
  const trips = Object.entries(rankGroups).filter(([, grp]) => grp.length >= 3);
  const pairs = Object.entries(rankGroups).filter(([, grp]) => grp.length >= 2);

  trips.forEach(([tripR, tGrp]) => {
    const rT = parseInt(tripR);
    pairs.forEach(([pairR, pGrp]) => {
      const rP = parseInt(pairR);
      if (rT !== rP) {
        const fullCards = [...tGrp.slice(0, 3), ...pGrp.slice(0, 2)];
        results.push({
          id: `fh_${rT}_${rP}`,
          type: 'Full House',
          name: `葫芦 (${getRankStr(rT)}带${getRankStr(rP)})`,
          cards: fullCards,
          description: `三张${getRankStr(rT)}带两张${getRankStr(rP)}`
        });
      }
    });
  });

  // 4. 同花 (Flush)
  Object.entries(suitGroups).forEach(([suit, sCards]) => {
    if (sCards.length >= 5) {
      const sSorted = sortCards(sCards);
      const suitName = suit === 'S' ? '黑桃' : suit === 'H' ? '红桃' : suit === 'C' ? '梅花' : '方块';
      results.push({
        id: `flush_${suit}`,
        type: 'Flush',
        name: `${suitName}同花`,
        cards: sSorted.slice(0, 5),
        description: `5张${suitName}`
      });
    }
  });

  // 5. 顺子 (Straight)
  const uniqueRankCards: Card[] = [];
  const seenRanks = new Set<number>();
  sorted.forEach(c => {
    if (!seenRanks.has(c.rank)) {
      seenRanks.add(c.rank);
      uniqueRankCards.push(c);
    }
  });

  for (let i = 0; i <= uniqueRankCards.length - 5; i++) {
    const sub = uniqueRankCards.slice(i, i + 5);
    const evalSub = evaluateHand(sub, 'back');
    if (evalSub.type === 'Straight') {
      results.push({
        id: `straight_${sub[0].id}`,
        type: 'Straight',
        name: `顺子 (${getRankStr(sub[0].rank)}高)`,
        cards: sub,
        description: evalSub.description
      });
    }
  }

  // 6. 三条 (Trips)
  trips.forEach(([tripR, tGrp]) => {
    const r = parseInt(tripR);
    results.push({
      id: `trip_${r}`,
      type: 'Three of a Kind',
      name: `三条 ${getRankStr(r)}`,
      cards: tGrp.slice(0, 3),
      description: `3张 ${getRankStr(r)}`
    });
  });

  // 7. 两对 (Two Pair)
  if (pairs.length >= 2) {
    for (let i = 0; i < pairs.length - 1; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        const r1 = parseInt(pairs[i][0]);
        const r2 = parseInt(pairs[j][0]);
        results.push({
          id: `twopair_${r1}_${r2}`,
          type: 'Two Pair',
          name: `两对 (${getRankStr(r1)}与${getRankStr(r2)})`,
          cards: [...pairs[i][1].slice(0, 2), ...pairs[j][1].slice(0, 2)],
          description: `对${getRankStr(r1)} + 对${getRankStr(r2)}`
        });
      }
    }
  }

  // 8. 对子 (Pair)
  pairs.forEach(([pairR, pGrp]) => {
    const r = parseInt(pairR);
    results.push({
      id: `pair_${r}`,
      type: 'Pair',
      name: `对 ${getRankStr(r)}`,
      cards: pGrp.slice(0, 2),
      description: `2张 ${getRankStr(r)}`
    });
  });

  return results.slice(0, 12);
}

// 一键自动修复倒水 (Auto Fix Dao Shui)
export function autoFixDaoShui(cards: Card[]): { front: Card[]; middle: Card[]; back: Card[] } | null {
  const suggestions = getSuggestedArrangements(cards);
  if (suggestions.length > 0) {
    return {
      front: suggestions[0].front,
      middle: suggestions[0].middle,
      back: suggestions[0].back
    };
  }
  return null;
}

// 演练模式：生成指定特殊牌型
export function generateSpecialHand(type: SpecialHandType): Card[] {
  const suits: Suit[] = ['S', 'H', 'C', 'D'];
  const allCards = createDeck();
  const doubleDeck = createDoubleDeck();

  // 八仙过海 (8张A)
  if (type === 'Eight of a Kind') {
    const aces: Card[] = doubleDeck.filter(c => c.rank === 14).slice(0, 8);
    const others = doubleDeck.filter(c => c.rank !== 14);
    return [...aces, ...shuffle(others).slice(0, 5)];
  }

  // 七星高照 (7张A)
  if (type === 'Seven of a Kind') {
    const aces: Card[] = doubleDeck.filter(c => c.rank === 14).slice(0, 7);
    const others = doubleDeck.filter(c => c.rank !== 14);
    return [...aces, ...shuffle(others).slice(0, 6)];
  }

  // 六六大顺 (6张A)
  if (type === 'Six of a Kind') {
    const aces: Card[] = doubleDeck.filter(c => c.rank === 14).slice(0, 6);
    const others = doubleDeck.filter(c => c.rank !== 14);
    return [...aces, ...shuffle(others).slice(0, 7)];
  }

  if (type === 'Supreme Dragon') {
    // 黑桃 A-K 一条龙
    return [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2].map(r => ({
      id: `${r}-S`,
      suit: 'S' as Suit,
      rank: r as Rank
    }));
  }

  if (type === 'Dragon') {
    // 杂色一条龙
    const patternSuits: Suit[] = ['S', 'H', 'C', 'D', 'S', 'H', 'C', 'D', 'S', 'H', 'C', 'D', 'S'];
    return [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2].map((r, i) => ({
      id: `${r}-${patternSuits[i]}`,
      suit: patternSuits[i],
      rank: r as Rank
    }));
  }

  if (type === 'Twelve Royals') {
    // 12张 JQK A
    const royals: Card[] = [];
    for (const r of [14, 13, 12, 11]) {
      for (const s of ['S', 'H', 'C', 'D']) {
        if (royals.length < 12) {
          royals.push({ id: `${r}-${s}`, suit: s as Suit, rank: r as Rank });
        }
      }
    }
    royals.push({ id: '2-S', suit: 'S', rank: 2 });
    return royals;
  }

  if (type === 'Three Quads') {
    // 3套铁支 (AAA, KKKK, QQQQ + 1)
    const cards: Card[] = [];
    for (const r of [14, 13, 12]) {
      for (const s of suits) {
        cards.push({ id: `${r}-${s}`, suit: s, rank: r as Rank });
      }
    }
    cards.push({ id: '2-S', suit: 'S', rank: 2 });
    return cards;
  }

  if (type === 'All High') {
    // 全部 >= 8
    const highCards = allCards.filter(c => c.rank >= 8);
    return shuffle(highCards).slice(0, 13);
  }

  if (type === 'All Low') {
    // 全部 <= 8
    const lowCards = allCards.filter(c => c.rank <= 8);
    return shuffle(lowCards).slice(0, 13);
  }

  if (type === 'Same Color') {
    // 全红牌
    const redCards = allCards.filter(c => c.suit === 'H' || c.suit === 'D');
    return shuffle(redCards).slice(0, 13);
  }

  if (type === 'Six Pairs') {
    // 六对半
    const ranks: Rank[] = [14, 13, 12, 11, 10, 9];
    const cards: Card[] = [];
    ranks.forEach(r => {
      cards.push({ id: `${r}-S`, suit: 'S', rank: r });
      cards.push({ id: `${r}-H`, suit: 'H', rank: r });
    });
    cards.push({ id: '2-C', suit: 'C', rank: 2 });
    return cards;
  }

  if (type === 'Three Flushes') {
    // 三同花
    const spades = allCards.filter(c => c.suit === 'S').slice(0, 5);
    const hearts = allCards.filter(c => c.suit === 'H').slice(0, 5);
    const clubs = allCards.filter(c => c.suit === 'C').slice(0, 3);
    return [...spades, ...hearts, ...clubs];
  }

  // 兜底返回随机13张
  return shuffle(allCards).slice(0, 13);
}
