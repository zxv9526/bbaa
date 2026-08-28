export type Suit = 'S' | 'H' | 'C' | 'D'; // Spades, Hearts, Clubs, Diamonds
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  id: string; // Unique ID
  suit: Suit;
  rank: Rank;
}

export type HandType = 
  | 'High Card'       // 乌龙 / 单张
  | 'Pair'            // 一对
  | 'Two Pair'        // 两对
  | 'Three of a Kind' // 三条
  | 'Straight'        // 顺子
  | 'Flush'           // 同花
  | 'Full House'      // 葫芦
  | 'Four of a Kind'  // 铁支 / 炸弹
  | 'Straight Flush'; // 同花顺

export type SpecialHandType =
  | 'Supreme Dragon'       // 至尊青龙 (同花一条龙)
  | 'Dragon'               // 一条龙 (13张各一张)
  | 'Twelve Royals'        // 十二皇族 (全J Q K A)
  | 'Three Straight Flushes'// 三同花顺
  | 'Three Quads'          // 三分天下 (三套炸弹)
  | 'All High'             // 全大 (8-A)
  | 'All Low'              // 全小 (2-8)
  | 'Same Color'           // 凑一色 (全红或全黑)
  | 'Four Triples'         // 四套三条
  | 'Five Pairs One Triple'// 五对三条
  | 'Six Pairs'            // 六对半
  | 'Three Flushes'        // 三同花
  | 'Three Straights';     // 三顺子

export interface HandEvaluation {
  score: number;
  type: HandType;
  cards: Card[];
  description: string;
  bonusPoints?: number; // 墩位特殊加分
}

export interface PlayerArrangement {
  front: Card[];
  middle: Card[];
  back: Card[];
  specialHand?: SpecialHandType | null;
  isValid: boolean;
  isDaoShui: boolean; // 倒水
}

export interface PlayerScoreDetail {
  playerId: string;
  name: string;
  isAi: boolean;
  avatar: string;
  cards: Card[];
  arrangement: PlayerArrangement;
  frontScore: HandEvaluation;
  midScore: HandEvaluation;
  backScore: HandEvaluation;
  specialHand?: SpecialHandType | null;
  
  // Scoring against other players
  dunScores: { [opponentId: string]: { front: number; mid: number; back: number; total: number; isGun: boolean } };
  bonusPoints: number;
  specialPoints: number;
  finalPoints: number;
  isHomeRun: boolean; // 全垒打
}

export interface GameRecord {
  id: string;
  playerName: string;
  mode: 'vs_ai_2p' | 'vs_ai_4p' | 'multiplayer';
  pointsWon: number;
  result: 'WIN' | 'LOSE' | 'DRAW' | 'SPECIAL_WIN';
  specialHand?: string | null;
  frontType: string;
  midType: string;
  backType: string;
  opponentsSummary: string;
  createdAt: string;
}

export interface PlayerStats {
  id: string;
  name: string;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  totalPoints: number;
  specialHandsCount: number;
}

export interface RoomState {
  roomCode: string;
  hostName: string;
  maxPlayers: number;
  status: 'waiting' | 'arranging' | 'revealing' | 'finished';
  players: {
    id: string;
    name: string;
    avatar: string;
    isReady: boolean;
    hasSubmitted: boolean;
    cards?: Card[];
    arrangement?: PlayerArrangement;
    scoreResult?: PlayerScoreDetail;
  }[];
  createdAt: string;
  updatedAt: string;
}
