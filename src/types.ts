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
  | 'Straight Flush'  // 同花顺
  | 'Five of a Kind'; // 五条 / 五同 (双副牌)

export type SpecialHandType =
  | 'Eight of a Kind'      // 八仙过海 (8张A/8条)
  | 'Seven of a Kind'      // 七星高照 (7张A/7条)
  | 'Six of a Kind'        // 六六大顺 (6张A/6条)
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

export interface DunScoreVsOpponent {
  front: number;      // 前墩胜负 (1, -1, 0)
  frontBonus: number; // 前墩喜分差 (冲三 +3)
  mid: number;        // 中墩胜负 (1, -1, 0)
  midBonus: number;   // 中墩喜分差 (葫芦 +2, 铁支 +8, 同花顺 +10)
  back: number;       // 后墩胜负 (1, -1, 0)
  backBonus: number;  // 后墩喜分差 (铁支 +4, 同花顺 +5)
  isGun: boolean;     // 是否打枪对手 (三墩全胜)
  gunPoints: number;  // 打枪额外水数 (+3)
  total: number;      // 对阵该对手的总水数
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
  dunScores: { [opponentId: string]: DunScoreVsOpponent };
  bonusPoints: number;
  specialPoints: number;
  finalPoints: number;
  isHomeRun: boolean; // 全垒打
}

export interface GameRecord {
  id: string;
  playerName: string;
  mode: 'vs_ai_2p' | 'vs_ai_4p' | 'vs_ai_8p' | 'multiplayer';
  pointsWon: number;
  result: 'WIN' | 'LOSE' | 'DRAW' | 'SPECIAL_WIN';
  specialHand?: string | null;
  frontType: string;
  midType: string;
  backType: string;
  opponentsSummary: string;
  createdAt: string;
}

export interface UserAccount {
  id: string;
  phone: string; // 注册手机号
  username: string; // 同 phone
  nickname: string;
  avatar: string;
  points: number;
  createdAt: string;
  lastLoginAt: string;
}

export interface PointsTransaction {
  id: string;
  type: 'MATCH_WIN' | 'MATCH_LOSS' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'REGISTER_BONUS' | 'ADMIN_ADJUST' | 'BOT_ADD' | 'BOT_DEDUCT' | 'RELIEF_BONUS';
  title: string;
  amount: number;
  balanceAfter: number;
  timestamp: string;
  relatedPhone?: string;
  relatedNickname?: string;
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

export interface TelegramBotStatus {
  ok: boolean;
  hasBotToken: boolean;
  botUsername: string | null;
  botFirstName: string | null;
  webhookInfo: {
    url?: string;
    has_custom_certificate?: boolean;
    pending_update_count?: number;
    last_error_date?: number;
    last_error_message?: string;
  } | null;
  recommendedWebhookUrl: string;
  configuredAdminIdsCount: number;
  dbAdminsCount: number;
  dbAdmins: {
    chat_id: string;
    username: string;
    first_name: string;
    role: string;
    created_at: string;
  }[];
  d1Bound: boolean;
  hasAdminPassword: boolean;
}
