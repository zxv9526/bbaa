import { PatternChanger } from './lib/patternChanger';
import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Card, GameRecord, PlayerArrangement, PlayerScoreDetail, SpecialHandType, PlayerStats, UserAccount } from './types';
import {
  createDeck,
  createDoubleDeck,
  shuffle,
  sortCards,
  isValidArrangement,
  aiArrangeCards,
  getSuggestedArrangements,
  detectSpecialHand,
  calculateMatchScores,
  ArrangementOption,
  HAND_TYPE_CN,
  evaluateHand,
  findAvailablePatterns,
  DetectedPattern,
  autoFixDaoShui,
  generateSpecialHand,
  SPECIAL_HAND_CN,
  PRACTICE_SPECIAL_HANDS_SEQUENCE
} from './gameLogic';
import { CardView } from './components/CardView';
import { HandSummary } from './components/HandSummary';
import { SpecialHandBanner } from './components/SpecialHandBanner';
import { RuleModal } from './components/RuleModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { MultiplayerRoom } from './components/MultiplayerRoom';
import { PracticeModal } from './components/PracticeModal';
import { ShowdownStage } from './components/ShowdownStage';
import { CardSkinModal } from './components/CardSkinModal';
import { AuthModal } from './components/AuthModal';
import { PointsManagementModal } from './components/PointsManagementModal';
import { NoPointsModal } from './components/NoPointsModal';
import { PracticeHeaderBar } from './components/PracticeHeaderBar';
import { SpecialHandLabModal } from './components/SpecialHandLabModal';
import { initCardSkins } from './lib/cardSkin';
import {
  getCurrentAccount,
  subscribeAccount,
  addPoints
} from './lib/accountManager';
import { ApiClient } from './api';
import { sounds } from './sound';
import {
  Play,
  Users,
  Trophy,
  BookOpen,
  Volume2,
  VolumeX,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowRight,
  ArrowLeft,
  User,
  Plus,
  Compass,
  Zap,
  Swords,
  FlaskConical,
  ArrowUpDown,
  Wand2,
  Layers,
  HelpCircle,
  Palette,
  Crown,
  Coins,
  Shield,
  ShieldAlert,
  KeyRound,
  UserCheck,
  ChevronRight,
  Gem,
  Gift,
  Train
} from 'lucide-react';

import {
  getOrCreateCurrentCarriage,
  submitCarriageHandAndAdvance,
  getCarriageStats,
  getPlayerCarriageIndexProgress,
  setPlayerCarriageIndexProgress,
  getCurrentCarriageOccupancy,
  CarriagePoolStats,
  CarriageSubmission,
  resetCarriagePool
} from './lib/carriageManager';
import { CarriageHeaderBar } from './components/CarriageHeaderBar';
import { CarriageHubModal } from './components/CarriageHubModal';
import { SubmitChoiceModal } from './components/SubmitChoiceModal';
import { MatchReplayModal } from './components/MatchReplayModal';
import {
  saveActiveMatchSession,
  loadActiveMatchSession,
  clearActiveMatchSession,
  ActiveMatchSession
} from './lib/matchPersistence';
import { saveMatchReplay } from './lib/matchReplay';
import { triggerHaptic } from './lib/haptics';
import { ArrowLeftRight, History, GraduationCap } from 'lucide-react';

type GameMode = 'vs_ai_8p' | 'vs_ai_4p' | 'vs_ai_2p' | 'multiplayer' | 'practice';

export default function App() {
  const [currentAccount, setCurrentAccount] = useState<UserAccount>(() => getCurrentAccount());
  const [playerName, setPlayerName] = useState<string>(() => currentAccount.nickname);

  const [mode, setMode] = useState<GameMode>('vs_ai_4p');
  const [gameState, setGameState] = useState<'menu' | 'room_lobby' | 'arranging' | 'revealing'>('menu');
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinInputCode8P, setJoinInputCode8P] = useState<string>('');
  const [joinInputCode4P, setJoinInputCode4P] = useState<string>('');

  // Carriage Mode State (8-player & 4-player Async Carriage Flow)
  const [carriageSeatIndex, setCarriageSeatIndex] = useState<number>(0);
  const [carriageIndex, setCarriageIndex] = useState<number>(() => getPlayerCarriageIndexProgress());
  const [carriageId, setCarriageId] = useState<string>('');
  const [carriageStats, setCarriageStats] = useState<CarriagePoolStats>(() => getCarriageStats());
  const [carriageSubmissions, setCarriageSubmissions] = useState<{ [seatIndex: number]: CarriageSubmission }>({});
  const [showCarriageHubModal, setShowCarriageHubModal] = useState<boolean>(false);
  const [carriageToast, setCarriageToast] = useState<{ show: boolean; msg: string; pts: number } | null>(null);

  // Audio mute state
  const [isMuted, setIsMuted] = useState(false);

  // Modals
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [showNoPointsModal, setShowNoPointsModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showRankModal, setShowRankModal] = useState(false);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [showSpecialTesterModal, setShowSpecialTesterModal] = useState(false);
  const [showSkinModal, setShowSkinModal] = useState(false);
  const [showSubmitChoiceModal, setShowSubmitChoiceModal] = useState(false);
  const [showReplayModal, setShowReplayModal] = useState(false);
  const [pendingArrangement, setPendingArrangement] = useState<PlayerArrangement | null>(null);

  // Player Hand State
  const [originalHand, setOriginalHand] = useState<Card[]>([]);
  const [pool, setPool] = useState<Card[]>([]);
  const [front, setFront] = useState<Card[]>([]);
  const [mid, setMid] = useState<Card[]>([]);
  const [back, setBack] = useState<Card[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Detected Special Hand
  const [specialHand, setSpecialHand] = useState<SpecialHandType | null>(null);
  const [useSpecialHand, setUseSpecialHand] = useState<boolean>(false);
  const [practiceSpecialIndex, setPracticeSpecialIndex] = useState<number>(0);
  const practiceSpecialIndexRef = useRef<number>(0);

  // AI Suggestions & Pattern Changer
  const [suggestions, setSuggestions] = useState<ArrangementOption[]>([]);
  const [patternInfo, setPatternInfo] = useState<{ tag: string; index: number; total: number } | null>(null);
  const patternChangerRef = useRef<PatternChanger | null>(null);
  
  // Match State (Supports 2, 4, or 8 players)
  const [playersInMatch, setPlayersInMatch] = useState<{
    id: string;
    name: string;
    isAi: boolean;
    avatar: string;
    cards: Card[];
    arrangement: PlayerArrangement;
  }[]>([]);

  const [matchResults, setMatchResults] = useState<PlayerScoreDetail[] | null>(null);

  // Current Player Stats for Lobby
  const [myStats, setMyStats] = useState<PlayerStats | null>(null);

  // 🔄 牌局恢复函数：严格落实契约精神，恢复未完成牌局
  const restoreFromSavedSession = (saved: ActiveMatchSession, reason: string = '自动恢复') => {
    setMode(saved.mode);
    setCarriageId(saved.carriageId);
    setCarriageIndex(saved.carriageIndex);
    setCarriageSeatIndex(saved.carriageSeatIndex);
    setCarriageSubmissions(saved.carriageSubmissions || {});
    if (saved.carriageStats) {
      setCarriageStats(saved.carriageStats);
    }
    setOriginalHand(saved.originalHand);
    setFront(saved.front || []);
    setMid(saved.mid || []);
    setBack(saved.back || []);
    setPool(saved.pool || []);
    setSelectedCardIds(saved.selectedCardIds || []);
    setPlayersInMatch(saved.playersInMatch || []);
    setSpecialHand(saved.specialHand);
    setUseSpecialHand(saved.useSpecialHand);
    const smartSuggestions = getSuggestedArrangements(saved.originalHand);
    setSuggestions(smartSuggestions);
    patternChangerRef.current = new PatternChanger(saved.originalHand);
    setGameState('arranging');
    setCarriageToast({
      show: true,
      msg: `🔄 契约精神：${reason}，已为您恢复第 ${saved.carriageIndex} 局进行中牌局。`,
      pts: 0
    });
    setTimeout(() => setCarriageToast(null), 4000);
  };

  // 1. On Mount: Auto-check and initialize D1 database & load player stats & card skins & restore unfinished match
  useEffect(() => {
    ApiClient.initializeDatabase();
    initCardSkins();
    refreshPlayerStats(playerName);

    // 🔄 检查是否存在因掉线或关闭网页未结束的对局
    const saved = loadActiveMatchSession(currentAccount?.phone);
    if (saved && saved.originalHand && saved.originalHand.length === 13) {
      restoreFromSavedSession(saved, '欢迎回来');
    }
  }, []);

  // 🔄 牌局进行中实时自动持久化 (防止掉线/刷新丢失，真实场次强制保存)
  useEffect(() => {
    if (gameState === 'arranging' && originalHand.length === 13 && mode !== 'practice') {
      saveActiveMatchSession({
        phone: currentAccount.phone,
        mode,
        carriageId,
        carriageIndex,
        carriageSeatIndex,
        carriageSubmissions,
        carriageStats,
        originalHand,
        front,
        mid,
        back,
        pool,
        selectedCardIds,
        playersInMatch,
        specialHand,
        useSpecialHand,
        timestamp: Date.now()
      });
    }
  }, [
    gameState,
    mode,
    carriageId,
    carriageIndex,
    carriageSeatIndex,
    carriageSubmissions,
    carriageStats,
    originalHand,
    front,
    mid,
    back,
    pool,
    selectedCardIds,
    playersInMatch,
    specialHand,
    useSpecialHand,
    currentAccount.phone
  ]);

  // Sync account updates
  useEffect(() => {
    return subscribeAccount(acc => {
      setCurrentAccount(acc);
      setPlayerName(acc.nickname);

      // 切换账号后自动检查该账号名下是否有未完成的牌局
      const saved = loadActiveMatchSession(acc.phone);
      if (saved && saved.originalHand && saved.originalHand.length === 13) {
        restoreFromSavedSession(saved, `检测到账号【${acc.nickname}】有未完成牌局`);
      }
    });
  }, []);

  const refreshPlayerStats = async (name: string) => {
    try {
      const statsRes = await ApiClient.getStats();
      const current = statsRes.leaderboard.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (current) {
        setMyStats(current);
      } else {
        setMyStats({
          id: name,
          name: name,
          totalGames: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          totalPoints: 0,
          specialHandsCount: 0
        });
      }
    } catch {
      // fallback
    }
  };

  const handleMuteToggle = () => {
    const next = !isMuted;
    setIsMuted(next);
    sounds.setMuted(next);
  };

  const handleNameChange = (newName: string) => {
    setPlayerName(newName);
    localStorage.setItem('thirteen_player_name', newName);
    refreshPlayerStats(newName);
  };

  // Start a new local match (8P, 4P, 2P, or practice)
  const startNewMatch = (
    selectedMode: GameMode = mode,
    seatOverride?: number,
    practiceSpecialType?: SpecialHandType
  ) => {
    // 🛡️ 积分门槛限制：没有积分不允许进入真实牌局（试玩练习场免积分自由体验）
    if (selectedMode !== 'practice' && currentAccount.points <= 0) {
      setShowNoPointsModal(true);
      return;
    }

    // 🛡️ 契约精神核心防线：检查是否存在该账号未提交的真实牌局，不允许玩家因牌烂而中途放弃
    if (selectedMode !== 'practice') {
      const saved = loadActiveMatchSession(currentAccount.phone);
      if (saved && saved.originalHand && saved.originalHand.length === 13) {
        restoreFromSavedSession(saved, '根据游戏契约精神');
        return;
      }
    }

    sounds.playDeal();
    setMode(selectedMode);
    setErrorMsg('');
    setMatchResults(null);
    setUseSpecialHand(false);

    // 🎮 试玩练习场：固定特殊牌型轮换发牌，让玩家每局都能体验各种震撼特殊牌型，快速熟悉规则与算分！
    if (selectedMode === 'practice') {
      let targetSpecialType = practiceSpecialType;

      if (targetSpecialType) {
        // 如果外部显式指定了特殊牌型（如特殊牌型库自选），同步当前序列索引
        const foundIdx = PRACTICE_SPECIAL_HANDS_SEQUENCE.indexOf(targetSpecialType);
        if (foundIdx !== -1) {
          practiceSpecialIndexRef.current = foundIdx;
          setPracticeSpecialIndex(foundIdx);
        }
      } else {
        // 关键逻辑：若未指定牌型（例如在结算比牌页点击"再来一局"，或重新开局），每局自动递增轮换到下一个不同的特殊牌型！
        if (gameState === 'revealing') {
          const nextIdx = (practiceSpecialIndexRef.current + 1) % PRACTICE_SPECIAL_HANDS_SEQUENCE.length;
          practiceSpecialIndexRef.current = nextIdx;
          setPracticeSpecialIndex(nextIdx);
          targetSpecialType = PRACTICE_SPECIAL_HANDS_SEQUENCE[nextIdx];
        } else {
          targetSpecialType =
            PRACTICE_SPECIAL_HANDS_SEQUENCE[
              practiceSpecialIndexRef.current % PRACTICE_SPECIAL_HANDS_SEQUENCE.length
            ];
        }
      }

      const playerDealt = generateSpecialHand(targetSpecialType);
      const sortedPlayerHand = sortCards(playerDealt);

      setOriginalHand(sortedPlayerHand);
      setPool([]);
      setSelectedCardIds([]);

      // 检测特殊牌型 (确保必命中 targetSpecialType)
      const special = detectSpecialHand(sortedPlayerHand) || targetSpecialType;
      setSpecialHand(special);
      setUseSpecialHand(true); // 默认启用特殊牌型免摆直接出牌，也可随时切换常规理牌

      sounds.playVictory();
      triggerHaptic('heavy');
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.35 } });

      // 计算智能非倒水推荐牌型 (供常规摆牌参考)
      const smartSuggestions = getSuggestedArrangements(sortedPlayerHand);
      setSuggestions(smartSuggestions);
      patternChangerRef.current = new PatternChanger(sortedPlayerHand);

      if (smartSuggestions.length > 0) {
        setFront(smartSuggestions[0].front);
        setMid(smartSuggestions[0].middle);
        setBack(smartSuggestions[0].back);
        setPatternInfo({
          tag: smartSuggestions[0].tag,
          index: 1,
          total: smartSuggestions.length
        });
      } else {
        setFront(sortedPlayerHand.slice(0, 3));
        setMid(sortedPlayerHand.slice(3, 8));
        setBack(sortedPlayerHand.slice(8, 13));
      }

      // 生成 3 位高拟真电脑对手，排除玩家已用卡牌，同台比牌
      const userCardIds = new Set(playerDealt.map(c => c.id));
      const aiDeck = shuffle(createDoubleDeck().filter(c => !userCardIds.has(c.id)));

      const aiAvatars = ['🤖', '🦊', '🧔'];
      const aiNames = ['智多星 (AI)', '十三妹 (AI)', '雀圣阿旺 (AI)'];
      const playersList: typeof playersInMatch = [
        {
          id: 'player_user',
          name: currentAccount.nickname || playerName,
          isAi: false,
          avatar: currentAccount.avatar || '😎',
          cards: sortedPlayerHand,
          arrangement: {
            front: [],
            middle: [],
            back: [],
            specialHand: special,
            isValid: true,
            isDaoShui: false
          }
        }
      ];

      for (let i = 1; i <= 3; i++) {
        const aiCards = aiDeck.slice((i - 1) * 13, i * 13);
        const aiArrange = aiArrangeCards(aiCards);
        playersList.push({
          id: `ai_${i}`,
          name: aiNames[i - 1] || `电脑对手 ${i}`,
          isAi: true,
          avatar: aiAvatars[i - 1] || '🤖',
          cards: aiCards,
          arrangement: aiArrange
        });
      }

      setPlayersInMatch(playersList);
      setGameState('arranging');

      const specInfo = SPECIAL_HAND_CN[targetSpecialType];
      const seqDisplayIndex = (practiceSpecialIndexRef.current % PRACTICE_SPECIAL_HANDS_SEQUENCE.length) + 1;
      setCarriageToast({
        show: true,
        msg: `🎯 试玩特训第${seqDisplayIndex}/13局：【${specInfo ? specInfo.name : targetSpecialType}】(+${specInfo ? specInfo.points : 0}水)`,
        pts: 0
      });
      setTimeout(() => setCarriageToast(null), 3200);
      return;
    }

    // 🚆 8人模式与4人模式：使用预发牌存储与无缝连战逻辑
    if (selectedMode === 'vs_ai_8p' || selectedMode === 'vs_ai_4p') {
      const activeSeat = typeof seatOverride === 'number' ? seatOverride : carriageSeatIndex;
      const { carriage, seatIndex, handCards, stats, isFull } = getOrCreateCurrentCarriage(activeSeat, selectedMode);

      const totalSeats = selectedMode === 'vs_ai_8p' ? 8 : 4;
      if (isFull && carriage.submissions && Object.keys(carriage.submissions).length >= totalSeats && !carriage.submissions[seatIndex]) {
        setErrorMsg(`该【${selectedMode === 'vs_ai_8p' ? '八人场' : '四人场'}】房间已满座 (0/${totalSeats})，无法再进入！`);
        return;
      }
      
      setCarriageSeatIndex(seatIndex);
      setCarriageIndex(carriage.index);
      setCarriageId(carriage.id);
      setCarriageStats(stats);
      setCarriageSubmissions(carriage.submissions || {});

      const sortedPlayerHand = sortCards(handCards);
      setOriginalHand(sortedPlayerHand);
      setPool([]);
      setFront(sortedPlayerHand.slice(0, 3));
      setMid(sortedPlayerHand.slice(3, 8));
      setBack(sortedPlayerHand.slice(8, 13));
      setSelectedCardIds([]);

      // Detect Special Hand
      const special = detectSpecialHand(sortedPlayerHand);
      setSpecialHand(special);
      if (special) {
        sounds.playVictory();
        triggerHaptic('heavy');
        confetti({ particleCount: 120, spread: 90, origin: { y: 0.35 } });
      }

      // Compute AI Suggestions for player (100% legal, non-daoshui)
      const smartSuggestions = getSuggestedArrangements(sortedPlayerHand);
      setSuggestions(smartSuggestions);
      patternChangerRef.current = new PatternChanger(sortedPlayerHand);

      if (smartSuggestions.length > 0) {
        setFront(smartSuggestions[0].front);
        setMid(smartSuggestions[0].middle);
        setBack(smartSuggestions[0].back);
        setPatternInfo({
          tag: smartSuggestions[0].tag,
          index: 1,
          total: smartSuggestions.length
        });
      } else {
        setFront(sortedPlayerHand.slice(0, 3));
        setMid(sortedPlayerHand.slice(3, 8));
        setBack(sortedPlayerHand.slice(8, 13));
      }

      const is8P = selectedMode === 'vs_ai_8p';
      const numPlayers = is8P ? 8 : 4;

      // Prepare players list (User at seatIndex + other submissions or empty seat placeholders; NO AI BOTS)
      const playersList: {
        id: string;
        name: string;
        isAi: boolean;
        avatar: string;
        cards: Card[];
        arrangement: PlayerArrangement;
      }[] = [];

      for (let s = 0; s < numPlayers; s++) {
        if (s === seatIndex) {
          playersList.push({
            id: 'player_user',
            name: `${currentAccount.nickname || playerName} (${s + 1}号位)`,
            isAi: false,
            avatar: currentAccount.avatar || '😎',
            cards: sortedPlayerHand,
            arrangement: {
              front: [],
              middle: [],
              back: [],
              specialHand: null,
              isValid: false,
              isDaoShui: false
            }
          });
        } else if (carriage.submissions && carriage.submissions[s]) {
          const sub = carriage.submissions[s];
          playersList.push({
            id: sub.playerId,
            name: `${sub.playerName} (${s + 1}号位)`,
            isAi: sub.isAi,
            avatar: sub.avatar,
            cards: sub.cards,
            arrangement: sub.arrangement
          });
        } else {
          playersList.push({
            id: `empty_${s}`,
            name: `空位 (${s + 1}号位)`,
            isAi: false,
            avatar: '🪑',
            cards: [],
            arrangement: {
              front: [],
              middle: [],
              back: [],
              specialHand: null,
              isValid: false,
              isDaoShui: false
            }
          });
        }
      }

      setPlayersInMatch(playersList);
      setGameState('arranging');
      return;
    }

    // 4人场与2人场：标准对局逻辑
    const deck = shuffle(createDeck());
    const numPlayers = selectedMode === 'vs_ai_2p' ? 2 : 4;
    const playerDealt = deck.slice(0, 13);
    const sortedPlayerHand = sortCards(playerDealt);

    setOriginalHand(sortedPlayerHand);
    setPool([]);
    setSelectedCardIds([]);

    // Detect Special Hand
    const special = detectSpecialHand(sortedPlayerHand);
    setSpecialHand(special);

    // Compute AI Suggestions for player (100% legal, non-daoshui)
    const smartSuggestions = getSuggestedArrangements(sortedPlayerHand);
    setSuggestions(smartSuggestions);
    patternChangerRef.current = new PatternChanger(sortedPlayerHand);

    if (smartSuggestions.length > 0) {
      setFront(smartSuggestions[0].front);
      setMid(smartSuggestions[0].middle);
      setBack(smartSuggestions[0].back);
      setPatternInfo({
        tag: smartSuggestions[0].tag,
        index: 1,
        total: smartSuggestions.length
      });
    } else {
      setFront(sortedPlayerHand.slice(0, 3));
      setMid(sortedPlayerHand.slice(3, 8));
      setBack(sortedPlayerHand.slice(8, 13));
    }

    // Prepare other players (AI)
    const playersList: {
      id: string;
      name: string;
      isAi: boolean;
      avatar: string;
      cards: Card[];
      arrangement: PlayerArrangement;
    }[] = [
      {
        id: 'player_user',
        name: currentAccount.nickname || playerName,
        isAi: false,
        avatar: currentAccount.avatar || '🀄',
        cards: sortedPlayerHand,
        arrangement: {
          front: [],
          middle: [],
          back: [],
          specialHand: null,
          isValid: false,
          isDaoShui: false
        }
      }
    ];

    const aiAvatars = ['🤖', '🦊', '🐼', '🐯', '🐉', '🥷', '🦁'];
    const aiNames = [
      '智多星 (AI)',
      '百胜侯 (AI)',
      '十三叔 (AI)',
      '猛虎客 (AI)',
      '龙行天下 (AI)',
      '幻影刺客 (AI)',
      '东方不败 (AI)'
    ];

    for (let i = 1; i < numPlayers; i++) {
      const aiCards = deck.slice(i * 13, (i + 1) * 13);
      const aiArrange = aiArrangeCards(aiCards);
      playersList.push({
        id: `ai_${i}`,
        name: aiNames[i - 1] || `对手 ${i}`,
        isAi: true,
        avatar: aiAvatars[i - 1] || '🤖',
        cards: aiCards,
        arrangement: aiArrange
      });
    }

    setPlayersInMatch(playersList);
    setGameState('arranging');
  };

  // Multi-card selection toggle & Instant Two-Card Swap (点选两张牌直接对调)
  const handleToggleCardSelect = (cardId: string) => {
    // If exactly 1 card is already selected and player clicks a DIFFERENT card -> Instant Swap!
    if (selectedCardIds.length === 1 && selectedCardIds[0] !== cardId) {
      const firstId = selectedCardIds[0];
      const secondId = cardId;

      const allCards = [...front, ...mid, ...back, ...pool];
      const card1 = allCards.find(c => c.id === firstId);
      const card2 = allCards.find(c => c.id === secondId);

      if (card1 && card2) {
        sounds.playSwap();
        triggerHaptic('medium');

        const swapInArray = (arr: Card[]) =>
          arr.map(c => (c.id === firstId ? card2 : c.id === secondId ? card1 : c));

        setFront(prev => swapInArray(prev));
        setMid(prev => swapInArray(prev));
        setBack(prev => swapInArray(prev));
        setPool(prev => swapInArray(prev));

        setSelectedCardIds([]);
        setErrorMsg('');
        return;
      }
    }

    sounds.playCardPick();
    triggerHaptic('light');
    setSelectedCardIds(prev =>
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };

  // Move all selected cards to target row ('front' | 'mid' | 'back')
  const handleMoveSelectedTo = (target: 'front' | 'mid' | 'back') => {
    if (selectedCardIds.length === 0) return;

    sounds.playCardPick();
    const selectedSet = new Set(selectedCardIds);
    const movedCards: Card[] = [];

    const newFront = front.filter(c => {
      if (c && selectedSet.has(c.id)) {
        movedCards.push(c);
        return false;
      }
      return true;
    });

    const newMid = mid.filter(c => {
      if (c && selectedSet.has(c.id)) {
        movedCards.push(c);
        return false;
      }
      return true;
    });

    const newBack = back.filter(c => {
      if (c && selectedSet.has(c.id)) {
        movedCards.push(c);
        return false;
      }
      return true;
    });

    if (target === 'front') {
      setFront([...newFront, ...movedCards]);
      setMid(newMid);
      setBack(newBack);
    } else if (target === 'mid') {
      setFront(newFront);
      setMid([...newMid, ...movedCards]);
      setBack(newBack);
    } else if (target === 'back') {
      setFront(newFront);
      setMid(newMid);
      setBack([...newBack, ...movedCards]);
    }

    setSelectedCardIds([]);
    setErrorMsg('');
  };

  // Reset hand cards to best legal arrangement
  const handleResetHand = () => {
    sounds.playCardPick();
    triggerHaptic('light');
    if (suggestions && suggestions.length > 0) {
      const best = suggestions[0];
      setFront([...best.front]);
      setMid([...best.middle]);
      setBack([...best.back]);
      setPatternInfo({
        tag: best.tag,
        index: 1,
        total: suggestions.length
      });
    } else {
      const all = sortCards([...front, ...mid, ...back, ...pool]);
      const fixed = autoFixDaoShui(all);
      if (fixed) {
        setFront(fixed.front);
        setMid(fixed.middle);
        setBack(fixed.back);
      }
    }
    setPool([]);
    setSelectedCardIds([]);
    setErrorMsg('');
  };

  // Swap Middle and Back Duns
  const handleSwapMidBack = () => {
    sounds.playSwap();
    triggerHaptic('medium');
    const currentMid = [...mid];
    const currentBack = [...back];
    setMid(currentBack);
    setBack(currentMid);
    setErrorMsg('');
  };

  // Swap Front and Middle Duns (Takes top 3 cards from middle)
  const handleSwapFrontMid = () => {
    sounds.playSwap();
    triggerHaptic('medium');
    if (front.length === 3 && mid.length === 5) {
      const newFront = mid.slice(0, 3);
      const newMid = [...front, ...mid.slice(3, 5)];
      setFront(newFront);
      setMid(newMid);
      setErrorMsg('');
    } else {
      const tempF = [...front];
      setFront([...mid.slice(0, 3)]);
      setMid([...tempF, ...mid.slice(3)]);
      setErrorMsg('');
    }
  };

  // Clear all placed cards back to hand pool for manual placement
  const handleClearAllToPool = () => {
    sounds.playCardPick();
    triggerHaptic('light');
    const all = [...front, ...mid, ...back, ...pool];
    setFront([]);
    setMid([]);
    setBack([]);
    setPool(sortCards(all));
    setSelectedCardIds([]);
    setErrorMsg('');
  };

  // Direct strategy selector ('tail' | 'mid' | 'head')
  const handleSelectStrategy = (strategy: 'tail' | 'mid' | 'head') => {
    sounds.playSwap();
    triggerHaptic('light');
    if (patternChangerRef.current) {
      const res = patternChangerRef.current.getPatternByStrategy(strategy);
      if (res && res.pattern) {
        setFront([...res.pattern.front]);
        setMid([...res.pattern.middle]);
        setBack([...res.pattern.back]);
        setPool([]);
        setSelectedCardIds([]);
        setErrorMsg('');
        setPatternInfo({
          tag: res.pattern.tag,
          index: res.index,
          total: res.total
        });
      }
    }
  };

  // Smart Pattern Changer (严格保证绝不倒水)
  const handleChangePattern = () => {
    sounds.playSwap();
    triggerHaptic('light');
    if (patternChangerRef.current) {
      const res = patternChangerRef.current.getNextPatternDifferentFrom(front, mid, back);
      if (res && res.pattern) {
        setFront([...res.pattern.front]);
        setMid([...res.pattern.middle]);
        setBack([...res.pattern.back]);
        setPool([]);
        setSelectedCardIds([]);
        setErrorMsg('');
        setPatternInfo({
          tag: res.pattern.tag,
          index: res.index,
          total: res.total
        });
      }
    }
  };

  // Auto Fix Dao Shui
  const handleAutoFix = () => {
    sounds.playAutoArrange();
    triggerHaptic('medium');
    const allPlacedOrPool = [
      ...front,
      ...mid,
      ...back,
      ...pool
    ];

    const fixed = autoFixDaoShui(allPlacedOrPool);
    if (fixed) {
      setFront(fixed.front);
      setMid(fixed.middle);
      setBack(fixed.back);
      setPool([]);
      setSelectedCardIds([]);
      setErrorMsg('');
      setCarriageToast({
        show: true,
        msg: '🛡️ 已成功自动纠正倒水，恢复合法不倒水方案！',
        pts: 0
      });
      setTimeout(() => setCarriageToast(null), 2500);
    }
  };

  // Apply suggestion
  const applySuggestion = (option: ArrangementOption) => {
    sounds.playAutoArrange();
    triggerHaptic('light');
    setFront([...option.front]);
    setMid([...option.middle]);
    setBack([...option.back]);
    setPool([]);
    setSelectedCardIds([]);
    setErrorMsg('');
  };

  // Reset slots to top legal arrangement
  const handleResetSlots = () => {
    sounds.playCardPick();
    triggerHaptic('light');
    if (suggestions && suggestions.length > 0) {
      const best = suggestions[0];
      setFront([...best.front]);
      setMid([...best.middle]);
      setBack([...best.back]);
      setPatternInfo({
        tag: best.tag,
        index: 1,
        total: suggestions.length
      });
    }
    setPool([]);
    setSelectedCardIds([]);
    setErrorMsg('');
  };

  // 🎮 试玩模式专属：自动前进或后退轮换特殊牌型特训
  const handleAdvancePracticeMatch = (step: number = 1) => {
    const currentIdx = practiceSpecialIndexRef.current;
    const nextIdx =
      (currentIdx + step + PRACTICE_SPECIAL_HANDS_SEQUENCE.length) %
      PRACTICE_SPECIAL_HANDS_SEQUENCE.length;
    practiceSpecialIndexRef.current = nextIdx;
    setPracticeSpecialIndex(nextIdx);
    startNewMatch('practice', undefined, PRACTICE_SPECIAL_HANDS_SEQUENCE[nextIdx]);
  };

  // 🧪 试玩模式专属：载入指定固定特殊牌型测试
  const handleLoadSpecialHandInPractice = (type: SpecialHandType) => {
    const idx = PRACTICE_SPECIAL_HANDS_SEQUENCE.indexOf(type);
    if (idx !== -1) {
      practiceSpecialIndexRef.current = idx;
      setPracticeSpecialIndex(idx);
    }
    startNewMatch('practice', undefined, type);
    setShowSpecialTesterModal(false);
  };

  // Submit Player Arrangement & Reveal (Opens Choice Modal)
  const handleSubmitArrangement = async () => {
    if (useSpecialHand && specialHand) {
      const userArrangement: PlayerArrangement = {
        front: [],
        middle: [],
        back: [],
        specialHand,
        isValid: true,
        isDaoShui: false
      };
      if (mode === 'practice') {
        settleMatch(userArrangement, true);
        return;
      }
      setPendingArrangement(userArrangement);
      setShowSubmitChoiceModal(true);
      return;
    }

    if (pool.length > 0) {
      sounds.playError();
      setErrorMsg(`⚠️ 手牌尚未全部分配！还剩 ${pool.length} 张牌在手牌区，请先分配完毕。`);
      return;
    }

    if (front.length !== 3) {
      sounds.playError();
      setErrorMsg(`⚠️ 前墩张数不符！前墩必须正好为 3 张牌（当前为 ${front.length} 张）。`);
      return;
    }

    if (mid.length !== 5) {
      sounds.playError();
      setErrorMsg(`⚠️ 中墩张数不符！中墩必须正好为 5 张牌（当前为 ${mid.length} 张）。`);
      return;
    }

    if (back.length !== 5) {
      sounds.playError();
      setErrorMsg(`⚠️ 后墩张数不符！后墩必须正好为 5 张牌（当前为 ${back.length} 张）。`);
      return;
    }

    const isValid = isValidArrangement(front, mid, back);
    if (!isValid) {
      sounds.playError();
      setErrorMsg('⚠️ 发生违规倒水（后墩 < 中墩 或 中墩 < 前墩）！请调整牌位或点击“一键调水”。');
      return;
    }

    const userArrangement: PlayerArrangement = {
      front,
      middle: mid,
      back,
      isValid: true,
      isDaoShui: false
    };

    if (mode === 'practice') {
      settleMatch(userArrangement, true);
      return;
    }

    setPendingArrangement(userArrangement);
    setShowSubmitChoiceModal(true);
  };

  const handleConfirmSubmit = (advanceToNext: boolean) => {
    setShowSubmitChoiceModal(false);
    if (pendingArrangement) {
      settleMatch(pendingArrangement, advanceToNext);
    }
  };

  const settleMatch = async (userArrangement: PlayerArrangement, advanceToNext: boolean = true) => {
    // 🎮 试玩练习场模式：不扣减/增加真实积分，直接进行 4 人模拟比牌与全流程战报呈现
    if (mode === 'practice') {
      const updatedPlayers = playersInMatch.map(p => {
        if (!p.isAi) {
          return { ...p, arrangement: userArrangement };
        }
        return p;
      });

      const results = calculateMatchScores(updatedPlayers);
      setMatchResults(results);

      const userResult = results.find(r => r.playerId === 'player_user');
      if (userResult && userResult.finalPoints > 0) {
        sounds.playVictory();
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 } });
      } else {
        sounds.playDunWin();
      }

      setGameState('revealing');
      return;
    }
    // 🚆 8人模式与4人模式：预发牌异步结算
    if (mode === 'vs_ai_8p' || mode === 'vs_ai_4p') {
      try {
        const res = await submitCarriageHandAndAdvance({
          carriageId,
          seatIndex: carriageSeatIndex,
          playerAccount: currentAccount,
          arrangement: userArrangement,
          handCards: originalHand,
          mode
        });

        if (res.playerResult.finalPoints > 0) {
          sounds.playVictory();
          confetti({ particleCount: 70, spread: 70, origin: { y: 0.5 } });
        } else {
          sounds.playDunWin();
        }

        const deltaStr = res.playerResult.finalPoints >= 0 ? `+${res.playerResult.finalPoints}` : `${res.playerResult.finalPoints}`;

        // 📝 保存对局复盘记录
        try {
          const replayPlayers = (res.allMatchResults && res.allMatchResults.length > 0 ? res.allMatchResults : [res.playerResult]).map(r => ({
            id: r.playerId,
            name: r.name,
            avatar: r.avatar,
            isAi: r.isAi,
            isMe: r.playerId === 'player_user',
            specialHand: r.specialHand,
            front: r.arrangement?.front || [],
            mid: r.arrangement?.middle || [],
            back: r.arrangement?.back || [],
            frontEval: r.frontScore ? {
              typeName: HAND_TYPE_CN[r.frontScore.type],
              desc: r.frontScore.description,
              bonus: r.frontScore.bonusPoints || 0
            } : undefined,
            midEval: r.midScore ? {
              typeName: HAND_TYPE_CN[r.midScore.type],
              desc: r.midScore.description,
              bonus: r.midScore.bonusPoints || 0
            } : undefined,
            backEval: r.backScore ? {
              typeName: HAND_TYPE_CN[r.backScore.type],
              desc: r.backScore.description,
              bonus: r.backScore.bonusPoints || 0
            } : undefined,
            finalScore: r.finalPoints,
            isHomeRun: r.isHomeRun
          }));

          saveMatchReplay(currentAccount.phone, {
            phone: currentAccount.phone,
            mode,
            carriageIndex,
            myScore: res.playerResult.finalPoints,
            players: replayPlayers,
            summaryText: `第 ${carriageIndex} 局 • 本局总得失: ${deltaStr} 水`
          });
        } catch (e) {
          console.error('Failed to record replay:', e);
        }

        if (advanceToNext) {
          // 🚀 提交并进入下一局
          setCarriageToast({
            show: true,
            msg: `🎉 理牌完成！获得 ${deltaStr} 水！已自动为你加载第 ${res.nextCarriageData.carriage.index} 局...`,
            pts: res.playerResult.finalPoints
          });

          setTimeout(() => {
            setCarriageToast(null);
          }, 4500);

          // 自动无缝切换到下一局
          setCarriageIndex(res.nextCarriageData.carriage.index);
          setCarriageId(res.nextCarriageData.carriage.id);
          setCarriageStats(res.updatedStats);
          setCarriageSubmissions(res.nextCarriageData.carriage.submissions || {});

          const nextHand = sortCards(res.nextCarriageData.handCards);
          setOriginalHand(nextHand);
          setPool([]);
          setFront(nextHand.slice(0, 3));
          setMid(nextHand.slice(3, 8));
          setBack(nextHand.slice(8, 13));
          setSelectedCardIds([]);
          setErrorMsg('');
          setUseSpecialHand(false);

          const special = detectSpecialHand(nextHand);
          setSpecialHand(special);
          const smartSuggestions = getSuggestedArrangements(nextHand);
          setSuggestions(smartSuggestions);
          patternChangerRef.current = new PatternChanger(nextHand);

          const is8P = mode === 'vs_ai_8p';
          const numPlayers = is8P ? 8 : 4;
          const nextCarriage = res.nextCarriageData.carriage;
          const nextSeatIndex = res.nextCarriageData.seatIndex;

          const nextPlayersList: typeof playersInMatch = [];
          for (let s = 0; s < numPlayers; s++) {
            if (s === nextSeatIndex) {
              nextPlayersList.push({
                id: 'player_user',
                name: `${currentAccount.nickname || playerName} (${s + 1}号位)`,
                isAi: false,
                avatar: currentAccount.avatar || '😎',
                cards: nextHand,
                arrangement: {
                  front: [],
                  middle: [],
                  back: [],
                  specialHand: null,
                  isValid: false,
                  isDaoShui: false
                }
              });
            } else if (nextCarriage.submissions && nextCarriage.submissions[s]) {
              const sub = nextCarriage.submissions[s];
              nextPlayersList.push({
                id: sub.playerId,
                name: `${sub.playerName} (${s + 1}号位)`,
                isAi: sub.isAi,
                avatar: sub.avatar,
                cards: sub.cards,
                arrangement: sub.arrangement
              });
            } else {
              nextPlayersList.push({
                id: `empty_${s}`,
                name: `空位 (${s + 1}号位)`,
                isAi: false,
                avatar: '🪑',
                cards: [],
                arrangement: {
                  front: [],
                  middle: [],
                  back: [],
                  specialHand: null,
                  isValid: false,
                  isDaoShui: false
                }
              });
            }
          }
          setPlayersInMatch(nextPlayersList);

          // 保存下一局为进行中状态
          saveActiveMatchSession({
            phone: currentAccount.phone,
            mode,
            carriageId: res.nextCarriageData.carriage.id,
            carriageIndex: res.nextCarriageData.carriage.index,
            carriageSeatIndex: nextSeatIndex,
            carriageSubmissions: res.nextCarriageData.carriage.submissions || {},
            carriageStats: res.updatedStats,
            originalHand: nextHand,
            front: nextHand.slice(0, 3),
            mid: nextHand.slice(3, 8),
            back: nextHand.slice(8, 13),
            pool: [],
            selectedCardIds: [],
            playersInMatch: nextPlayersList,
            specialHand: special,
            useSpecialHand: false,
            timestamp: Date.now()
          });

          refreshPlayerStats(currentAccount.nickname || playerName);
        } else {
          // 🏁 提交后结束游戏 -> 结算并返回大厅
          clearActiveMatchSession(currentAccount.phone);
          setGameState('menu');
          refreshPlayerStats(currentAccount.nickname || playerName);
        }
      } catch (err: any) {
        setErrorMsg(err.message || '理牌提交失败');
      }
      return;
    }

    // 2人场标准结算
    const updatedPlayers = playersInMatch.map(p => {
      if (!p.isAi) {
        return { ...p, arrangement: userArrangement };
      }
      return p;
    });

    const results = calculateMatchScores(updatedPlayers);
    setMatchResults(results);

    const userResult = results.find(r => r.playerId === 'player_user');
    if (userResult) {
      // Sync points to User Account
      const pointsDelta = userResult.finalPoints * 100;
      addPoints(
        pointsDelta,
        pointsDelta >= 0 ? 'MATCH_WIN' : 'MATCH_LOSS',
        `双人单挑结算 (${userResult.finalPoints >= 0 ? '+' : ''}${userResult.finalPoints}道)`
      );

      // Record to D1
      const outcome: GameRecord['result'] = userResult.specialHand
        ? 'SPECIAL_WIN'
        : userResult.finalPoints > 0
        ? 'WIN'
        : userResult.finalPoints < 0
        ? 'LOSE'
        : 'DRAW';

      await ApiClient.recordGame({
        playerName: currentAccount.nickname || playerName,
        mode,
        pointsWon: userResult.finalPoints,
        result: outcome,
        specialHand: userResult.specialHand || null,
        frontType: userResult.frontScore.type,
        midType: userResult.midScore.type,
        backType: userResult.backScore.type,
        opponentsSummary: `${results.length - 1}位对手`
      });

      refreshPlayerStats(currentAccount.nickname || playerName);

      // 📝 保存双人单挑复盘记录
      try {
        const replayPlayers = results.map(r => ({
          id: r.playerId,
          name: r.name,
          avatar: r.avatar,
          isAi: r.isAi,
          isMe: r.playerId === 'player_user',
          specialHand: r.specialHand,
          front: r.arrangement.front || [],
          mid: r.arrangement.middle || [],
          back: r.arrangement.back || [],
          frontEval: r.frontScore ? {
            typeName: HAND_TYPE_CN[r.frontScore.type],
            desc: r.frontScore.description,
            bonus: r.frontScore.bonusPoints || 0
          } : undefined,
          midEval: r.midScore ? {
            typeName: HAND_TYPE_CN[r.midScore.type],
            desc: r.midScore.description,
            bonus: r.midScore.bonusPoints || 0
          } : undefined,
          backEval: r.backScore ? {
            typeName: HAND_TYPE_CN[r.backScore.type],
            desc: r.backScore.description,
            bonus: r.backScore.bonusPoints || 0
          } : undefined,
          finalScore: r.finalPoints,
          isHomeRun: r.isHomeRun
        }));

        saveMatchReplay(currentAccount.phone, {
          phone: currentAccount.phone,
          mode: 'vs_ai_2p',
          carriageIndex: 1,
          myScore: userResult.finalPoints,
          players: replayPlayers,
          summaryText: `双人单挑 • 本局得分: ${userResult.finalPoints >= 0 ? '+' : ''}${userResult.finalPoints} 水`
        });
      } catch (e) {
        console.error('Failed to record 2p replay:', e);
      }
    }

    if (advanceToNext) {
      setGameState('revealing');
    } else {
      clearActiveMatchSession(currentAccount.phone);
      setGameState('menu');
    }
  };

  // Join Multiplayer Room (8P or 4P)
  const handleJoinRoom = async (codeToJoin: string) => {
    if (currentAccount.points <= 0) {
      setShowNoPointsModal(true);
      return;
    }
    if (!codeToJoin.trim()) return;
    const res = await ApiClient.joinRoom(codeToJoin.trim(), currentAccount.nickname || playerName, currentAccount.avatar);
    if (res.ok) {
      setRoomCode(codeToJoin.trim().toUpperCase());
      setGameState('room_lobby');
    } else {
      setErrorMsg(res.message || '加入房间失败');
    }
  };

  // Create Multiplayer Room
  const handleCreateRoom = async (maxPlayers: 4 | 8 = 4) => {
    if (currentAccount.points <= 0) {
      setShowNoPointsModal(true);
      return;
    }
    const res = await ApiClient.createRoom(currentAccount.nickname || playerName, maxPlayers);
    if (res.ok && res.roomCode) {
      setRoomCode(res.roomCode);
      setGameState('room_lobby');
    }
  };

  // Real-time evaluation on player's current slots
  const fEval = front.length === 3 ? evaluateHand(front, 'front') : null;
  const mEval = mid.length === 5 ? evaluateHand(mid, 'middle') : null;
  const bEval = back.length === 5 ? evaluateHand(back, 'back') : null;

  const isCurrentDaoShui =
    front.length === 3 &&
    mid.length === 5 &&
    back.length === 5 &&
    !isValidArrangement(front, mid, back);

  // Available patterns from original full hand or unplaced pool
  const availablePatterns = findAvailablePatterns(originalHand);

  return (
    <div className="h-screen h-[100dvh] max-h-[100dvh] w-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white overflow-hidden">
      {/* 1. Header Bar: ONLY shown on main menu/lobby; completely hidden during game match */}
      {gameState === 'menu' && (
        <header className="shrink-0 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3 flex items-center justify-between shadow-sm">
          {/* TOP LEFT: Registration / Login / Profile Entry */}
          <button
            id="user-auth-entry-btn"
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-3 px-3 py-1.5 rounded-2xl border border-slate-800 bg-slate-950/80 hover:bg-slate-900 hover:border-blue-500/50 transition active:scale-95 text-left group shadow-sm"
            title="手机号登录 / 注册 / 个人中心"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/40 flex items-center justify-center text-lg shadow-inner group-hover:scale-105 transition">
              {currentAccount.avatar}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold text-white group-hover:text-blue-300 transition truncate max-w-[110px]">
                  {currentAccount.nickname}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {currentAccount.phone}
              </div>
            </div>
          </button>
          
          {/* Center Brand Title */}
          <div
            onClick={() => setGameState('menu')}
            className="cursor-pointer select-none text-center"
          >
            <h1 className="font-black text-lg sm:text-xl tracking-wider text-white flex items-center justify-center gap-1.5">
              十三水
            </h1>
          </div>

          {/* TOP RIGHT: Points Management Entry */}
          <div className="flex items-center gap-3">
            <button
              id="points-management-entry-btn"
              onClick={() => setShowPointsModal(true)}
              className="flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/50 to-slate-950 hover:border-amber-400 text-amber-300 transition active:scale-95 shadow-md shadow-amber-500/10 group"
              title="点击打开积分管理：手机号互赠积分"
            >
              <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-sm text-amber-400 group-hover:scale-110 transition">
                🪙
              </div>
              <div className="text-left">
                <div className="text-[9px] text-amber-400/80 font-bold leading-tight">积分</div>
                <div className="text-xs sm:text-sm font-black text-amber-400 leading-none">
                  {currentAccount.points.toLocaleString()}
                </div>
              </div>
            </button>
          </div>
        </header>
      )}

      {/* 2. Main Body Content: Minimalist & Clean Two Arena Blocks */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-2 sm:px-6 py-1 sm:py-2 flex flex-col items-center justify-start overflow-y-auto no-scrollbar">
        {gameState === 'menu' && (() => {
          const occ8P = getCurrentCarriageOccupancy('vs_ai_8p');
          const occ4P = getCurrentCarriageOccupancy('vs_ai_4p');

          return (
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 my-auto">
              {/* BLOCK 1: 八人场 (8-Player Arena) */}
              <div
                id="arena-8p-section"
                onClick={() => {
                  if (currentAccount.points <= 0) {
                    setShowNoPointsModal(true);
                    return;
                  }
                  if (occ8P.isFull) {
                    setErrorMsg('八人场当前房间已满座 (0/8)，无法进入！');
                    return;
                  }
                  startNewMatch('vs_ai_8p');
                }}
                className={`relative bg-gradient-to-br from-red-950/70 via-slate-900 to-slate-950 border-2 border-red-900/60 p-6 sm:p-8 rounded-3xl flex flex-col justify-between gap-6 cursor-pointer transition-all duration-300 group ${
                  occ8P.isFull ? 'opacity-80 hover:border-red-600/50' : 'hover:border-amber-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-red-950/50'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-red-600 text-slate-950 flex items-center justify-center text-2xl font-black shadow-lg shadow-red-600/30 group-hover:scale-105 transition duration-300">
                      👑
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
                        双副 104 牌
                      </span>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                        occ8P.isFull
                          ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                          : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                      }`}>
                        {occ8P.isFull ? '🔴 满座 (0/8)' : `🟢 剩余位置: ${occ8P.remainingSeats}/8`}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight group-hover:text-amber-300 transition">
                      八人场
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                      双副扑克牌 · 8人同台竞技 · 7枪全垒打狂暴翻倍
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-sm sm:text-base font-bold text-amber-400 group-hover:text-amber-300">
                  <span>{occ8P.isFull ? '已满座 (无法进入)' : '立即进入八人场'}</span>
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center group-hover:translate-x-1.5 transition">
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
              </div>

              {/* BLOCK 2: 四人场 (4-Player Arena) */}
              <div
                id="arena-4p-section"
                onClick={() => {
                  if (currentAccount.points <= 0) {
                    setShowNoPointsModal(true);
                    return;
                  }
                  if (occ4P.isFull) {
                    setErrorMsg('四人场当前房间已满座 (0/4)，无法进入！');
                    return;
                  }
                  startNewMatch('vs_ai_4p');
                }}
                className={`relative bg-gradient-to-br from-blue-950/70 via-slate-900 to-slate-950 border-2 border-blue-900/60 p-6 sm:p-8 rounded-3xl flex flex-col justify-between gap-6 cursor-pointer transition-all duration-300 group ${
                  occ4P.isFull ? 'opacity-80 hover:border-blue-600/50' : 'hover:border-blue-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/50'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-slate-950 flex items-center justify-center text-2xl font-black shadow-lg shadow-blue-600/30 group-hover:scale-105 transition duration-300">
                      ⚔️
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/30">
                        单副 52 牌
                      </span>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                        occ4P.isFull
                          ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                          : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                      }`}>
                        {occ4P.isFull ? '🔴 满座 (0/4)' : `🟢 剩余位置: ${occ4P.remainingSeats}/4`}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight group-hover:text-blue-300 transition">
                      四人场
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                      单副扑克牌 · 经典四人对决 · 正宗三墩比拼
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-sm sm:text-base font-bold text-blue-400 group-hover:text-blue-300">
                  <span>{occ4P.isFull ? '已满座 (无法进入)' : '立即进入四人场'}</span>
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center group-hover:translate-x-1.5 transition">
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
              </div>

              {/* 🎮 大厅底部：试玩模式 (自由演练 · 模拟比牌计分 · 操作规则教学) */}
              <div
                id="lobby-practice-hero-card"
                onClick={() => startNewMatch('practice')}
                className="col-span-1 md:col-span-2 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 hover:from-emerald-950/80 hover:to-teal-950/80 border-2 border-emerald-500/40 hover:border-emerald-400 p-5 sm:p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer transition-all duration-300 group shadow-xl hover:shadow-2xl hover:shadow-emerald-950/50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-2xl sm:text-3xl font-black shadow-lg shadow-emerald-600/30 group-hover:scale-105 transition duration-300 shrink-0">
                    🎮
                  </div>
                  <div className="space-y-1 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-black text-white group-hover:text-emerald-300 transition">
                        免费试玩模式 (全真演练练习场)
                      </h3>
                      <span className="text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        零门槛 · 真实对局样式 · 无需积分
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                      采用与真实牌局 100% 完全相同的牌桌界面布局！自由理牌、点选双牌互换、一键修复倒水，模拟 4 人同台比拼与详细算分推导，帮您零成本精通十三水！
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-950/50 group-hover:translate-x-1 transition shrink-0 whitespace-nowrap">
                  <span>进入试玩模式</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>

              {/* Lobby Quick Tool Shelf */}
              <div className="col-span-1 md:col-span-2 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 pt-2">
                <button
                  id="btn-open-practice-modal"
                  onClick={() => startNewMatch('practice')}
                  className="px-4 py-2.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-emerald-300 text-xs sm:text-sm font-bold flex items-center gap-2 transition active:scale-95 shadow-md"
                >
                  <GraduationCap className="w-4 h-4 text-emerald-400" />
                  <span>试玩模式 (全真演练)</span>
                </button>

                <button
                  onClick={() => setShowReplayModal(true)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-slate-200 text-xs sm:text-sm font-bold flex items-center gap-2 transition active:scale-95 shadow-md"
                >
                  <History className="w-4 h-4 text-amber-400" />
                  <span>战绩复盘</span>
                </button>

                <button
                  onClick={() => setShowRankModal(true)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/40 text-slate-200 text-xs sm:text-sm font-bold flex items-center gap-2 transition active:scale-95 shadow-md"
                >
                  <Trophy className="w-4 h-4 text-blue-400" />
                  <span>排行榜</span>
                </button>

                <button
                  onClick={() => setShowRuleModal(true)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/40 text-slate-200 text-xs sm:text-sm font-bold flex items-center gap-2 transition active:scale-95 shadow-md"
                >
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  <span>规则说明</span>
                </button>

                <button
                  onClick={() => setShowSkinModal(true)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/40 text-slate-200 text-xs sm:text-sm font-bold flex items-center gap-2 transition active:scale-95 shadow-md"
                >
                  <Palette className="w-4 h-4 text-purple-400" />
                  <span>扑克装扮</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* 3. Multiplayer Lobby View */}
        {gameState === 'room_lobby' && (
          <MultiplayerRoom
            roomCode={roomCode}
            currentPlayerName={currentAccount.nickname || playerName}
            onStartRoomGame={room => {
              startNewMatch('multiplayer');
            }}
            onExit={() => setGameState('menu')}
          />
        )}

        {/* 4. Active Game Table (Arranging / Revealing) */}
        {gameState === 'revealing' && matchResults && (
          <div className="w-full max-w-6xl flex flex-col items-center gap-6 overflow-y-auto pb-safe p-2 sm:p-4">
            {mode === 'practice' && (
              <div className="w-full bg-emerald-950/90 border border-emerald-500/40 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-emerald-200 text-xs sm:text-sm font-bold shadow-lg animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg">🎮</span>
                  <span>
                    试玩练习场 · 【
                    {specialHand
                      ? SPECIAL_HAND_CN[specialHand]?.name || specialHand
                      : SPECIAL_HAND_CN[PRACTICE_SPECIAL_HANDS_SEQUENCE[practiceSpecialIndex % PRACTICE_SPECIAL_HANDS_SEQUENCE.length]]?.name}
                    】模拟对决完毕（不扣减真实积分）
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleAdvancePracticeMatch(1)}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs transition shadow shrink-0 cursor-pointer flex items-center gap-1 active:scale-95"
                  >
                    <span>体验下一特殊牌型 ➔</span>
                  </button>
                  <button
                    onClick={() => {
                      const currType =
                        PRACTICE_SPECIAL_HANDS_SEQUENCE[
                          practiceSpecialIndexRef.current % PRACTICE_SPECIAL_HANDS_SEQUENCE.length
                        ];
                      startNewMatch('practice', undefined, currType);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-amber-300 font-bold text-xs transition border border-amber-500/30 shrink-0 cursor-pointer active:scale-95"
                  >
                    重练本牌型
                  </button>
                  <button
                    onClick={() => setShowSpecialTesterModal(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs transition border border-slate-700 shrink-0 cursor-pointer active:scale-95"
                  >
                    选特殊牌型
                  </button>
                  <button
                    onClick={() => setGameState('menu')}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs transition border border-slate-700 shrink-0 cursor-pointer active:scale-95"
                  >
                    返回大厅
                  </button>
                </div>
              </div>
            )}
            <ShowdownStage
              results={matchResults}
              onPlayAgain={() => {
                if (mode === 'practice') {
                  handleAdvancePracticeMatch(1);
                } else {
                  startNewMatch(mode);
                }
              }}
              onBackToMenu={() => setGameState('menu')}
              isPractice={mode === 'practice'}
              nextSpecialName={
                SPECIAL_HAND_CN[
                  PRACTICE_SPECIAL_HANDS_SEQUENCE[
                    (practiceSpecialIndexRef.current + 1) % PRACTICE_SPECIAL_HANDS_SEQUENCE.length
                  ]
                ]?.name
              }
              onSelectSpecialHand={() => setShowSpecialTesterModal(true)}
            />
          </div>
        )}
        {gameState === 'arranging' && (
          <div className="w-full max-w-5xl flex-1 flex flex-col items-center justify-between gap-1 py-0.5 px-0 min-h-0 h-full overflow-hidden">
            {/* 🚆 Compact Carriage Header Bar */}
            {(mode === 'vs_ai_8p' || mode === 'vs_ai_4p') && (
              <CarriageHeaderBar
                mode={mode}
                currentCarriageIndex={carriageIndex}
                seatIndex={carriageSeatIndex}
                submissions={carriageSubmissions}
                onSeatChange={newSeat => {
                  setCarriageSeatIndex(newSeat);
                  startNewMatch(mode, newSeat);
                }}
                stats={carriageStats}
                onOpenHub={() => setShowCarriageHubModal(true)}
                points={currentAccount.points}
              />
            )}

            {/* 🎮 Compact Practice Header Bar for Practice Mode */}
            {mode === 'practice' && (
              <PracticeHeaderBar
                currentSpecialType={
                  specialHand ||
                  PRACTICE_SPECIAL_HANDS_SEQUENCE[
                    practiceSpecialIndex % PRACTICE_SPECIAL_HANDS_SEQUENCE.length
                  ]
                }
                currentIndex={practiceSpecialIndex % PRACTICE_SPECIAL_HANDS_SEQUENCE.length}
                totalSpecials={PRACTICE_SPECIAL_HANDS_SEQUENCE.length}
                onPrevSpecial={() => handleAdvancePracticeMatch(-1)}
                onNextSpecial={() => handleAdvancePracticeMatch(1)}
                onDealNewHand={() => handleAdvancePracticeMatch(1)}
                onOpenSpecialLab={() => setShowSpecialTesterModal(true)}
                onExit={() => setGameState('menu')}
                points={currentAccount.points}
              />
            )}

            {/* Special Hand Alert Banner (Compact) */}
            {specialHand && (
              <SpecialHandBanner
                specialHand={specialHand}
                isUsed={useSpecialHand}
                onUseSpecial={() => setUseSpecialHand(!useSpecialHand)}
              />
            )}

            {/* Error Message Banner */}
            {errorMsg && (
              <div className="w-full p-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center justify-center gap-2 shrink-0">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            {/* Arrangement Card Containers - Adaptive Height */}
            <div className="w-full flex-1 flex flex-col justify-between gap-1 bg-slate-900/90 border border-slate-800 rounded-2xl p-1 sm:p-2 shadow-xl min-h-0 overflow-hidden">
              
              {/* 1. FRONT DUN (前墩) */}
              <div
                onClick={() => selectedCardIds.length > 0 && handleMoveSelectedTo('front')}
                className={`flex-1 flex flex-col justify-between p-1 rounded-xl border transition-all min-h-0 overflow-hidden ${
                  selectedCardIds.length > 0
                    ? 'border-blue-500/60 bg-blue-950/30 cursor-pointer hover:bg-blue-900/40 hover:border-blue-400 shadow-md'
                    : 'border-slate-800/80 bg-slate-950/50'
                }`}
              >
                <div className="flex items-center justify-between w-full text-[11px] sm:text-xs font-bold px-1 pb-0.5 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-slate-300 text-[11px] sm:text-xs">前墩</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                      front.length === 3 ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {front.length}/3
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {fEval && (
                      <span className="text-blue-400 font-black text-[11px] sm:text-xs">
                        [{HAND_TYPE_CN[fEval.type]}] {fEval.description}
                      </span>
                    )}
                    {selectedCardIds.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSelectedTo('front');
                        }}
                        className="px-2 py-0.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] sm:text-xs shadow transition active:scale-95"
                      >
                        移入前墩 ({selectedCardIds.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-nowrap items-center justify-start p-0.5 rounded-lg bg-slate-900/40 flex-1 overflow-x-auto no-scrollbar pl-2 sm:pl-3 min-h-0">
                  {front.length === 0 ? (
                    <div className="w-full py-2 text-left pl-3 text-xs text-slate-500 font-medium">
                      {selectedCardIds.length > 0 ? '👉 点击此处放入前墩' : '前墩 (3张)'}
                    </div>
                  ) : (
                    front.map((c, idx) => (
                      <CardView
                        key={c.id}
                        card={c}
                        size="md"
                        className={idx > 0 ? '-ml-12 min-[375px]:-ml-14 min-[414px]:-ml-16 sm:-ml-20 md:-ml-23' : ''}
                        selected={selectedCardIds.includes(c.id)}
                        onClick={() => handleToggleCardSelect(c.id)}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* 2. MIDDLE DUN (中墩) */}
              <div
                onClick={() => selectedCardIds.length > 0 && handleMoveSelectedTo('mid')}
                className={`flex-1 flex flex-col justify-between p-1 rounded-xl border transition-all min-h-0 overflow-hidden ${
                  selectedCardIds.length > 0
                    ? 'border-indigo-500/60 bg-indigo-950/30 cursor-pointer hover:bg-indigo-900/40 hover:border-indigo-400 shadow-md'
                    : 'border-slate-800/80 bg-slate-950/50'
                }`}
              >
                <div className="flex items-center justify-between w-full text-[11px] sm:text-xs font-bold px-1 pb-0.5 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span className="text-slate-300 text-[11px] sm:text-xs">中墩</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                      mid.length === 5 ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {mid.length}/5
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {mEval && (
                      <span className="text-indigo-400 font-black text-[11px] sm:text-xs">
                        [{HAND_TYPE_CN[mEval.type]}] {mEval.description}
                      </span>
                    )}
                    {selectedCardIds.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSelectedTo('mid');
                        }}
                        className="px-2 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] sm:text-xs shadow transition active:scale-95"
                      >
                        移入中墩 ({selectedCardIds.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-nowrap items-center justify-start p-0.5 rounded-lg bg-slate-900/40 flex-1 overflow-x-auto no-scrollbar pl-2 sm:pl-3 min-h-0">
                  {mid.length === 0 ? (
                    <div className="w-full py-2 text-left pl-3 text-xs text-slate-500 font-medium">
                      {selectedCardIds.length > 0 ? '👉 点击此处放入中墩' : '中墩 (5张)'}
                    </div>
                  ) : (
                    mid.map((c, idx) => (
                      <CardView
                        key={c.id}
                        card={c}
                        size="md"
                        className={idx > 0 ? '-ml-12 min-[375px]:-ml-14 min-[414px]:-ml-16 sm:-ml-20 md:-ml-23' : ''}
                        selected={selectedCardIds.includes(c.id)}
                        onClick={() => handleToggleCardSelect(c.id)}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* 3. BACK DUN (后墩) */}
              <div
                onClick={() => selectedCardIds.length > 0 && handleMoveSelectedTo('back')}
                className={`flex-1 flex flex-col justify-between p-1 rounded-xl border transition-all min-h-0 overflow-hidden ${
                  selectedCardIds.length > 0
                    ? 'border-purple-500/60 bg-purple-950/30 cursor-pointer hover:bg-purple-900/40 hover:border-purple-400 shadow-md'
                    : 'border-slate-800/80 bg-slate-950/50'
                }`}
              >
                <div className="flex items-center justify-between w-full text-[11px] sm:text-xs font-bold px-1 pb-0.5 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-slate-300 text-[11px] sm:text-xs">后墩</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                      back.length === 5 ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {back.length}/5
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {bEval && (
                      <span className="text-purple-400 font-black text-[11px] sm:text-xs">
                        [{HAND_TYPE_CN[bEval.type]}] {bEval.description}
                      </span>
                    )}
                    {selectedCardIds.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSelectedTo('back');
                        }}
                        className="px-2 py-0.5 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] sm:text-xs shadow transition active:scale-95"
                      >
                        移入后墩 ({selectedCardIds.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-nowrap items-center justify-start p-0.5 rounded-lg bg-slate-900/40 flex-1 overflow-x-auto no-scrollbar pl-2 sm:pl-3 min-h-0">
                  {back.length === 0 ? (
                    <div className="w-full py-2 text-left pl-3 text-xs text-slate-500 font-medium">
                      {selectedCardIds.length > 0 ? '👉 点击此处放入后墩' : '后墩 (5张)'}
                    </div>
                  ) : (
                    back.map((c, idx) => (
                      <CardView
                        key={c.id}
                        card={c}
                        size="md"
                        className={idx > 0 ? '-ml-12 min-[375px]:-ml-14 min-[414px]:-ml-16 sm:-ml-20 md:-ml-23' : ''}
                        selected={selectedCardIds.includes(c.id)}
                        onClick={() => handleToggleCardSelect(c.id)}
                      />
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Bottom Actions: Clean Two Primary Action Buttons (变换牌型 / 一键纠正 & 提交牌型) */}
            <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-1 shrink-0 pt-0.5 pb-2 sm:pb-3">
              {/* Context hints / pattern info */}
              {selectedCardIds.length === 1 ? (
                <div className="text-[10px] sm:text-[11px] font-bold text-blue-300 bg-blue-950/80 border border-blue-500/50 px-3 py-0.5 rounded-full animate-in fade-in flex items-center gap-1.5 shadow-md">
                  <span>💡 已选 1 张牌，点击任意另一张牌即可直接对调位置</span>
                </div>
              ) : isCurrentDaoShui ? (
                <div className="text-[10px] sm:text-[11px] font-bold text-rose-300 bg-rose-950/80 border border-rose-500/60 px-3 py-0.5 rounded-full animate-in fade-in flex items-center gap-1.5 shadow-md">
                  <span>⚠️ 当前牌型倒水 (头墩大过中墩 或 中墩大过尾墩)，请点击一键纠正</span>
                </div>
              ) : patternInfo ? (
                <div className="text-[10px] sm:text-[11px] font-bold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-3 py-0.2 rounded-full animate-in fade-in flex items-center gap-1.5 shadow-sm">
                  <span>✨ 方案:</span>
                  <span className="text-amber-200">{patternInfo.tag}</span>
                  <span className="text-slate-400 font-medium">({patternInfo.index}/{patternInfo.total})</span>
                </div>
              ) : null}

              <div className="w-full flex items-center justify-center gap-2 sm:gap-4">
                {isCurrentDaoShui ? (
                  <button
                    id="btn-auto-fix-daoshui"
                    onClick={handleAutoFix}
                    className="flex-1 py-2.5 sm:py-3.5 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-rose-950/90 via-amber-950/80 to-rose-950/90 border-2 border-rose-500 text-amber-200 hover:text-white text-xs sm:text-base font-black flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg shadow-rose-950/60 transition active:scale-95 cursor-pointer animate-pulse"
                    title="当前摆法倒水！点击一键智能纠正并恢复最佳牌力"
                  >
                    <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" />
                    <span>一键纠正倒水</span>
                  </button>
                ) : (
                  <button
                    id="btn-change-pattern"
                    onClick={handleChangePattern}
                    className="flex-1 py-2.5 sm:py-3.5 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-slate-850 hover:bg-slate-800 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs sm:text-base font-black flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg shadow-amber-950/40 transition active:scale-95 cursor-pointer"
                    title="点击切换下一组不倒水合法方案"
                  >
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                    <span>变换牌型</span>
                  </button>
                )}

                <button
                  id="btn-submit-arrangement"
                  onClick={handleSubmitArrangement}
                  disabled={isCurrentDaoShui || (front.length + mid.length + back.length !== 13)}
                  className={`flex-1 py-2.5 sm:py-3.5 px-3 sm:px-4 rounded-xl sm:rounded-2xl text-xs sm:text-base font-black flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg transition active:scale-95 cursor-pointer ${
                    isCurrentDaoShui || (front.length + mid.length + back.length !== 13)
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                      : 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-600/30'
                  }`}
                  title="提交牌型"
                >
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>提交牌型 ({front.length + mid.length + back.length}/13)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        currentAccount={currentAccount}
        myStats={myStats}
        onAccountChange={acc => {
          setCurrentAccount(acc);
          setPlayerName(acc.nickname);
        }}
      />

      <PointsManagementModal
        isOpen={showPointsModal}
        onClose={() => setShowPointsModal(false)}
        currentAccount={currentAccount}
        onAccountUpdated={acc => setCurrentAccount(acc)}
      />

      <NoPointsModal
        isOpen={showNoPointsModal}
        onClose={() => setShowNoPointsModal(false)}
        onOpenPractice={() => startNewMatch('practice')}
        onOpenPoints={() => setShowPointsModal(true)}
        currentPoints={currentAccount.points}
      />

      <SpecialHandLabModal
        isOpen={showSpecialTesterModal}
        onClose={() => setShowSpecialTesterModal(false)}
        onSelectSpecial={handleLoadSpecialHandInPractice}
      />

      <RuleModal isOpen={showRuleModal} onClose={() => setShowRuleModal(false)} />

      <PracticeModal
        isOpen={showPracticeModal}
        onClose={() => setShowPracticeModal(false)}
      />

      <LeaderboardModal
        isOpen={showRankModal}
        onClose={() => {
          setShowRankModal(false);
          refreshPlayerStats(currentAccount.nickname || playerName);
        }}
        currentPlayerName={currentAccount.nickname || playerName}
      />

      <CardSkinModal
        isOpen={showSkinModal}
        onClose={() => setShowSkinModal(false)}
      />

      <CarriageHubModal
        isOpen={showCarriageHubModal}
        onClose={() => setShowCarriageHubModal(false)}
        mode={mode === 'vs_ai_8p' || mode === 'vs_ai_4p' ? mode : 'vs_ai_8p'}
        currentCarriageIndex={carriageIndex}
        onSelectCarriageIndex={idx => {
          const activeMode = mode === 'vs_ai_8p' || mode === 'vs_ai_4p' ? mode : 'vs_ai_8p';
          setPlayerCarriageIndexProgress(idx, activeMode);
          startNewMatch(activeMode);
          setShowCarriageHubModal(false);
        }}
        onResetPool={() => {
          const activeMode = mode === 'vs_ai_8p' || mode === 'vs_ai_4p' ? mode : 'vs_ai_8p';
          startNewMatch(activeMode);
        }}
      />

      <SubmitChoiceModal
        isOpen={showSubmitChoiceModal}
        onClose={() => setShowSubmitChoiceModal(false)}
        onConfirm={handleConfirmSubmit}
        onToggleSpecialHand={() => setUseSpecialHand(!useSpecialHand)}
        carriageIndex={carriageIndex}
        mode={mode === 'vs_ai_8p' || mode === 'vs_ai_4p' ? mode : 'vs_ai_4p'}
        front={front}
        mid={mid}
        back={back}
        specialHand={specialHand}
        useSpecialHand={useSpecialHand}
      />

      <MatchReplayModal
        isOpen={showReplayModal}
        onClose={() => setShowReplayModal(false)}
        phone={currentAccount.phone}
      />
    </div>
  );
}
