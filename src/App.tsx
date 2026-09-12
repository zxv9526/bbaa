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
  SPECIAL_HAND_CN
} from './gameLogic';
import { CardView } from './components/CardView';
import { HandSummary } from './components/HandSummary';
import { SpecialHandBanner } from './components/SpecialHandBanner';
import { RuleModal } from './components/RuleModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { ShowdownStage } from './components/ShowdownStage';
import { CardSkinModal } from './components/CardSkinModal';
import { AuthModal } from './components/AuthModal';
import { PointsManagementModal } from './components/PointsManagementModal';
import { NoPointsModal } from './components/NoPointsModal';
import { ChatDrawer } from './components/ChatDrawer';
import { ChatFloatingWidget } from './components/ChatFloatingWidget';
import { TableTacticalChatBar } from './components/TableTacticalChatBar';
import { ChatMessage, ChatMessageType } from './types';
import { getAiReplyForMessage, speakTextMessage, AI_NAMES_POOL, createSimulatedVoiceAudioUrl } from './lib/chatManager';
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
  MessageSquare,
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
  Train,
  History
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
  Carriage,
  getCarriageByRound,
  resetCarriagePool
} from './lib/carriageManager';
import { CarriageHeaderBar } from './components/CarriageHeaderBar';
import { CarriageHubModal } from './components/CarriageHubModal';
import { SubmitChoiceModal } from './components/SubmitChoiceModal';
import { MatchReplayModal } from './components/MatchReplayModal';
import { ReservationModal } from './components/ReservationModal';
import { ReservationSeatModal } from './components/ReservationSeatModal';
import {
  saveActiveMatchSession,
  loadActiveMatchSession,
  clearActiveMatchSession,
  ActiveMatchSession
} from './lib/matchPersistence';
import { saveMatchReplay } from './lib/matchReplay';
import { triggerHaptic } from './lib/haptics';
import { ArrowLeftRight, GraduationCap } from 'lucide-react';

type GameMode = 'realtime' | 'reservation' | 'vs_ai_8p';

export default function App() {
  const [currentAccount, setCurrentAccount] = useState<UserAccount>(() => getCurrentAccount());
  const [playerName, setPlayerName] = useState<string>(() => currentAccount.nickname);

  const [mode, setMode] = useState<GameMode>('realtime');
  const [gameState, setGameState] = useState<'menu' | 'arranging' | 'revealing'>('menu');

  // Carriage Mode State (8-player Async Carriage Flow)
  const [carriageSeatIndex, setCarriageSeatIndex] = useState<number>(0);
  const [carriageIndex, setCarriageIndex] = useState<number>(() => getPlayerCarriageIndexProgress());
  const [carriageId, setCarriageId] = useState<string>('');
  const [carriageStats, setCarriageStats] = useState<CarriagePoolStats>(() => getCarriageStats());
  const [carriageSubmissions, setCarriageSubmissions] = useState<{ [seatIndex: number]: CarriageSubmission }>({});
  const [showCarriageHubModal, setShowCarriageHubModal] = useState<boolean>(false);
  const [carriageToast, setCarriageToast] = useState<{ show: boolean; msg: string; pts: number } | null>(null);

  // Audio mute state
  const [isMuted, setIsMuted] = useState(false);

  // Chat & Voice State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showChatDrawer, setShowChatDrawer] = useState<boolean>(false);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);

  // Modals
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [showNoPointsModal, setShowNoPointsModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showRankModal, setShowRankModal] = useState(false);
  const [showSpecialTesterModal, setShowSpecialTesterModal] = useState(false);
  const [showSkinModal, setShowSkinModal] = useState(false);
  const [showSubmitChoiceModal, setShowSubmitChoiceModal] = useState(false);
  const [showReplayModal, setShowReplayModal] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [seatModalRound, setSeatModalRound] = useState<number>(1);
  const [seatModalCarriage, setSeatModalCarriage] = useState<Carriage | null>(null);
  const [previousRoundResult, setPreviousRoundResult] = useState<{
    roundIndex: number;
    seatNumber: number;
    pointsWon: number;
  } | null>(null);
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

  // 📅 预约场座位选择流程
  const openReservationSeatSelection = (
    round?: number,
    prevResult?: { roundIndex: number; seatNumber: number; pointsWon: number } | null
  ) => {
    const targetRound = typeof round === 'number' ? round : getPlayerCarriageIndexProgress('reservation');
    const carriage = getCarriageByRound(targetRound, 'reservation');
    setSeatModalRound(targetRound);
    setSeatModalCarriage(carriage);
    setPreviousRoundResult(prevResult || null);
    setShowSeatModal(true);
  };

  const handleSelectReservationSeat = (seatIndex: number, roundIndex: number) => {
    setShowSeatModal(false);
    startNewMatch('reservation', seatIndex, roundIndex, true);
  };

  // Start a new match (8P or 2P)
  const startNewMatch = (
    selectedMode: GameMode = mode,
    seatOverride?: number,
    roundOverride?: number,
    forceExactSeat: boolean = false
  ) => {
    // 🛡️ 积分门槛限制：没有积分不允许进入真实牌局
    if (currentAccount.points <= 0) {
      setShowNoPointsModal(true);
      return;
    }

    // 🛡️ 契约精神核心防线：检查是否存在该账号未提交的真实牌局，不允许玩家因牌烂而中途放弃
    const saved = loadActiveMatchSession(currentAccount.phone);
    if (saved && saved.originalHand && saved.originalHand.length === 13) {
      restoreFromSavedSession(saved, '根据游戏契约精神');
      return;
    }

    // 📅 预约场首要规则：进入后必须选择1-8号位置对应8副手牌
    if (selectedMode === 'reservation' && seatOverride === undefined) {
      openReservationSeatSelection(roundOverride);
      return;
    }

    sounds.playDeal();
    setMode(selectedMode);
    setErrorMsg('');
    setMatchResults(null);
    setUseSpecialHand(false);

    // 🚆 8人巅峰场 / 实时对战场 / 预约场：使用包厢存储与牌池系统
    const poolMode = selectedMode === 'reservation' ? 'reservation' : 'vs_ai_8p';
    const activeSeat = typeof seatOverride === 'number' ? seatOverride : carriageSeatIndex;
    const { carriage, seatIndex, handCards, stats, isFull } = getOrCreateCurrentCarriage(
      activeSeat,
      poolMode,
      roundOverride,
      forceExactSeat
    );

    const totalSeats = 8;
    if (isFull && carriage.submissions && Object.keys(carriage.submissions).length >= totalSeats && !carriage.submissions[seatIndex]) {
      setErrorMsg(`当前赛场已满座 (0/${totalSeats})，无法再进入！`);
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

    let initialFront: Card[];
    let initialMid: Card[];
    let initialBack: Card[];

    if (smartSuggestions.length > 0) {
      initialFront = smartSuggestions[0].front;
      initialMid = smartSuggestions[0].middle;
      initialBack = smartSuggestions[0].back;
      setFront(initialFront);
      setMid(initialMid);
      setBack(initialBack);
      setPatternInfo({
        tag: smartSuggestions[0].tag,
        index: 1,
        total: smartSuggestions.length
      });
    } else {
      initialFront = sortedPlayerHand.slice(10, 13);
      initialMid = sortedPlayerHand.slice(5, 10);
      initialBack = sortedPlayerHand.slice(0, 5);
      setFront(initialFront);
      setMid(initialMid);
      setBack(initialBack);
    }

    const numPlayers = 8;

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
        const defaultAI = AI_NAMES_POOL[s % AI_NAMES_POOL.length];
        playersList.push({
          id: `seat_${s}`,
          name: `${defaultAI.name} (${s + 1}号位)`,
          isAi: true,
          avatar: defaultAI.avatar,
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

    // 绑定并保存当前选座牌局状态，防止刷新或退出导致数据混乱
    saveActiveMatchSession({
      phone: currentAccount.phone,
      mode: selectedMode,
      carriageId: carriage.id,
      carriageIndex: carriage.index,
      carriageSeatIndex: seatIndex,
      carriageSubmissions: carriage.submissions || {},
      carriageStats: stats,
      originalHand: sortedPlayerHand,
      front: initialFront,
      mid: initialMid,
      back: initialBack,
      pool: [],
      selectedCardIds: [],
      playersInMatch: playersList,
      specialHand: special,
      useSpecialHand: false,
      timestamp: Date.now()
    });
  };

  // 💬 Chat & Voice Message Dispatcher
  const handleSendMessage = (
    type: ChatMessageType,
    content: string,
    audioUrl?: string,
    audioDuration?: number
  ) => {
    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      senderId: currentAccount.id || 'player_user',
      senderName: currentAccount.nickname || playerName || '我',
      senderAvatar: currentAccount.avatar || '😎',
      isUser: true,
      type,
      content,
      audioUrl,
      audioDuration,
      timestamp: Date.now()
    };
    setMessages((prev) => [...prev, userMsg]);

    // AI opponents respond contextually in real-time match (disabled in reservation mode)
    if (mode !== 'reservation') {
      let oppList = playersInMatch
        .filter((p) => p.id !== 'player_user')
        .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar }));

      if (oppList.length === 0) {
        oppList = AI_NAMES_POOL.map((ai, idx) => ({
          id: `seat_${idx + 1}`,
          name: `${ai.name} (${idx + 2}号位)`,
          avatar: ai.avatar
        }));
      }

      if (oppList.length > 0) {
        setTimeout(() => {
          const aiReply = getAiReplyForMessage(content, type, oppList);
          if (aiReply) {
            const isVoice = type === 'voice' || Math.random() < 0.25;
            const audioUrl = isVoice ? createSimulatedVoiceAudioUrl(2, 320 + Math.random() * 120) : undefined;
            
            const aiMsg: ChatMessage = {
              id: 'msg_ai_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
              senderId: aiReply.opponent.id,
              senderName: aiReply.opponent.name,
              senderAvatar: aiReply.opponent.avatar,
              isUser: false,
              type: isVoice ? 'voice' : aiReply.replyType,
              content: isVoice ? `[对讲回复] ${aiReply.replyContent}` : aiReply.replyContent,
              audioUrl,
              audioDuration: isVoice ? 2 : undefined,
              timestamp: Date.now()
            };
            setMessages((prev) => [...prev, aiMsg]);
            if (ttsEnabled && aiReply.replyType !== 'emoji') {
              speakTextMessage(aiReply.replyContent);
            }
          }
        }, 1200 + Math.random() * 800);
      }
    }
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
        settleMatch(userArrangement, 'reveal');
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
      settleMatch(userArrangement, 'reveal');
      return;
    }

    setPendingArrangement(userArrangement);
    setShowSubmitChoiceModal(true);
  };

  const handleConfirmSubmit = (action: 'reveal' | 'quick_next' | 'exit') => {
    setShowSubmitChoiceModal(false);
    if (!pendingArrangement) return;
    settleMatch(pendingArrangement, action);
  };

  const settleMatch = async (userArrangement: PlayerArrangement, action: 'reveal' | 'quick_next' | 'exit' = 'quick_next') => {
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
    // 🚆 8人模式 / 实时对战场 / 预约场：预发牌异步结算
    if (mode === 'vs_ai_8p' || mode === 'realtime' || mode === 'reservation') {
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
            seatNumber: carriageSeatIndex + 1,
            myScore: res.playerResult.finalPoints,
            players: replayPlayers,
            summaryText: `第 ${carriageIndex} 局 (${carriageSeatIndex + 1}号位) • 本局总得失: ${deltaStr} 水`
          });
        } catch (e) {
          console.error('Failed to record replay:', e);
        }

        // 🛡️ 当前局已成功提交，清空当前未完成契约
        clearActiveMatchSession(currentAccount.phone);

        if (action === 'exit') {
          // 提交并结束游戏：返回大厅
          setCarriageToast({
            show: true,
            msg: `🎉 第 ${carriageIndex} 局 (${carriageSeatIndex + 1}号位) 提交成功！获得 ${deltaStr} 水，战绩已保存！`,
            pts: res.playerResult.finalPoints
          });
          setTimeout(() => {
            setCarriageToast(null);
          }, 4500);
          setGameState('menu');
          refreshPlayerStats(currentAccount.nickname || playerName);
          return;
        }

        if (action === 'quick_next') {
          if (mode === 'reservation') {
            // 📅 预约场核心业务流程：理牌提交后，弹出选座窗口选择下一局席位继续牌局
            setCarriageToast({
              show: true,
              msg: `🎉 第 ${carriageIndex} 局 (${carriageSeatIndex + 1}号位) 提交成功！获得 ${deltaStr} 水！请选择第 ${res.nextCarriageData.carriage.index} 局座位继续牌局...`,
              pts: res.playerResult.finalPoints
            });
            setTimeout(() => {
              setCarriageToast(null);
            }, 4000);

            openReservationSeatSelection(
              res.nextCarriageData.carriage.index,
              {
                roundIndex: carriageIndex,
                seatNumber: carriageSeatIndex + 1,
                pointsWon: res.playerResult.finalPoints
              }
            );
            refreshPlayerStats(currentAccount.nickname || playerName);
            return;
          }

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
          setSelectedCardIds([]);
          setErrorMsg('');
          setUseSpecialHand(false);

          const special = detectSpecialHand(nextHand);
          setSpecialHand(special);
          const smartSuggestions = getSuggestedArrangements(nextHand);
          setSuggestions(smartSuggestions);
          patternChangerRef.current = new PatternChanger(nextHand);

          if (smartSuggestions && smartSuggestions.length > 0) {
            setFront(smartSuggestions[0].front);
            setMid(smartSuggestions[0].middle);
            setBack(smartSuggestions[0].back);
            setPatternInfo({
              tag: smartSuggestions[0].tag,
              index: 1,
              total: smartSuggestions.length
            });
          } else {
            setFront(nextHand.slice(10, 13));
            setMid(nextHand.slice(5, 10));
            setBack(nextHand.slice(0, 5));
          }

          const numPlayers = 8;
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
          return;
        }

        // 🏁 揭晓比牌阶段：展示全员三墩比牌与结算详情 (action === 'reveal')
        if (res.allMatchResults && res.allMatchResults.length > 0) {
          setMatchResults(res.allMatchResults);
          setGameState('revealing');
        } else {
          clearActiveMatchSession(currentAccount.phone);
          setGameState('menu');
        }
        refreshPlayerStats(currentAccount.nickname || playerName);
      } catch (err: any) {
        setErrorMsg(err.message || '理牌提交失败');
      }
      return;
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

  // Available patterns from original hand or unplaced pool
  const availablePatterns = findAvailablePatterns(originalHand);
  const occ8P = getCurrentCarriageOccupancy('vs_ai_8p');

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white overflow-x-hidden relative">
      {/* 1. Header Bar: Minimalist */}
      {gameState === 'menu' && (
        <header className="w-full shrink-0 z-30 px-4 sm:px-8 pt-4 pb-2 flex items-center justify-between">
          <button
            id="user-auth-entry-btn"
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/60 hover:bg-slate-800 backdrop-blur-sm border border-slate-700/50 transition active:scale-95 group"
          >
            <div className="text-xl">{currentAccount?.avatar || '👑'}</div>
            <span className="text-sm font-bold text-white group-hover:text-blue-300 transition max-w-[100px] truncate">
              {currentAccount?.nickname || '十三水玩家'}
            </span>
          </button>

          <button
            id="points-management-entry-btn"
            onClick={() => setShowPointsModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/60 hover:bg-slate-800 backdrop-blur-sm border border-amber-500/30 text-amber-400 transition active:scale-95"
          >
            <span className="text-sm">🪙</span>
            <span className="text-sm font-black">{(currentAccount?.points || 0).toLocaleString()}</span>
          </button>
        </header>
      )}

      {/* 2. Main Body Content: Minimalist & Clean Two Arena Blocks */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-2 sm:px-6 py-2 flex flex-col items-center justify-start overflow-y-auto no-scrollbar">
        {gameState === 'menu' && (
          <div className="w-full max-w-4xl flex flex-col items-center justify-center gap-6 py-4 sm:py-8 my-auto animate-fade-in-up">
              {/* Hero Banner Area */}
              <div className="flex flex-col items-center gap-1.5 text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 flex items-center justify-center text-3xl sm:text-4xl font-black shadow-xl shadow-red-600/30 ring-4 ring-slate-950 ring-offset-2 ring-offset-amber-500/20 transform hover:scale-105 transition-transform">
                  🀄
                </div>
                <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-orange-500 tracking-tight mt-2 drop-shadow">
                  十三水巅峰对决
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 font-medium tracking-wide">
                  两大特色赛场 · 专注理牌 or 自由社交
                </p>
              </div>

              {/* TWO GAME SECTION CARDS */}
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                
                {/* SECTION 1: 预约场 */}
                <div
                  id="arena-reservation-section"
                  onClick={() => {
                    if (currentAccount.points <= 0) {
                      setShowNoPointsModal(true);
                      return;
                    }
                    setShowReservationModal(true);
                  }}
                  className="relative bg-gradient-to-br from-blue-950/80 via-slate-900 to-indigo-950/90 border-2 border-blue-500/50 p-6 sm:p-7 rounded-3xl flex flex-col justify-between gap-5 cursor-pointer transition-all duration-300 group shadow-xl hover:border-blue-400 hover:-translate-y-1 hover:shadow-blue-950/80"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center text-2xl font-black shadow-inner group-hover:scale-110 transition">
                        📅
                      </div>
                      <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
                        <VolumeX className="w-3 h-3 text-blue-400" />
                        纯净无打扰 · 禁用聊天
                      </span>
                    </div>

                    <div>
                      <h2 className="text-2xl font-black text-white group-hover:text-blue-300 transition tracking-tight">
                        预约场
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                        预定开局时间与席位 · 专心致志比拼理牌牌力 · 绝无外界消息与语音打扰。
                      </p>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-400 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400 font-bold">✓</span>
                        <span>定时定场 & 赛事组房</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400 font-bold">✓</span>
                        <span>无语音文本干扰静音专区</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400 font-bold">✓</span>
                        <span>支持契约恢复与倒水校验</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between font-bold text-blue-300 group-hover:text-blue-200">
                    <span className="text-sm">进入预约场</span>
                    <div className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center gap-1.5 group-hover:translate-x-1 transition shadow-lg shadow-blue-600/30">
                      <span>进入预约</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: 实时对战场 */}
                <div
                  id="arena-realtime-section"
                  onClick={() => {
                    if (currentAccount.points <= 0) {
                      setShowNoPointsModal(true);
                      return;
                    }
                    if (occ8P.isFull) {
                      setErrorMsg('实时对战场当前车厢已满座 (0/8)，无法进入！');
                      return;
                    }
                    startNewMatch('realtime');
                  }}
                  className="relative bg-gradient-to-br from-red-950/80 via-slate-900 to-amber-950/90 border-2 border-amber-500/50 p-6 sm:p-7 rounded-3xl flex flex-col justify-between gap-5 cursor-pointer transition-all duration-300 group shadow-xl hover:border-amber-400 hover:-translate-y-1 hover:shadow-red-950/80"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-red-600 text-slate-950 flex items-center justify-center text-2xl font-black shadow-lg shadow-red-600/30 group-hover:scale-110 transition">
                        ⚡
                      </div>
                      <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 animate-pulse">
                        <MessageSquare className="w-3 h-3 text-emerald-400" />
                        集成实时语音对讲与自由文本
                      </span>
                    </div>

                    <div>
                      <h2 className="text-2xl font-black text-white group-hover:text-amber-300 transition tracking-tight">
                        实时对战场
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
                        8人同台极速匹配 · 集成实时语音对讲、自由文本输入与动态牌桌对讲。
                      </p>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-400 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-bold">✓</span>
                        <span>牌桌对讲 & 自由文本打字</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-bold">✓</span>
                        <span>AI 对手真实语音 & 拟真回复</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-bold">✓</span>
                        <span>7枪全垒打狂暴倍率竞技</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between font-bold text-amber-400 group-hover:text-amber-300">
                    <span className="text-sm">极速匹配进入对局</span>
                    <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-red-600 text-slate-950 text-xs font-black flex items-center gap-1.5 group-hover:translate-x-1 transition shadow-lg shadow-red-600/30">
                      <span>立即对战</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

              </div>

              {/* Lobby Quick Tool Shelf */}
              <div className="w-full flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-3 border-t border-slate-800/50">
                <button
                  onClick={() => setShowRuleModal(true)}
                  className="px-5 py-2.5 rounded-full bg-slate-900/60 hover:bg-slate-800 border border-slate-700/50 text-slate-300 hover:text-white text-sm font-bold flex items-center gap-2.5 transition-all shadow-sm cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  <span>玩法规则</span>
                </button>
                <button
                  onClick={() => setShowReplayModal(true)}
                  className="px-5 py-2.5 rounded-full bg-slate-900/60 hover:bg-slate-800 border border-slate-700/50 text-slate-300 hover:text-white text-sm font-bold flex items-center gap-2.5 transition-all shadow-sm cursor-pointer"
                >
                  <History className="w-4 h-4 text-amber-400" />
                  <span>我的战绩</span>
                </button>
              </div>
            </div>
        )}

        {/* 4. Active Game Table (Arranging / Revealing) */}
        {gameState === 'revealing' && matchResults && (
          <div className="w-full max-w-6xl flex flex-col items-center gap-6 overflow-y-auto pb-safe p-2 sm:p-4">
            <ShowdownStage
              results={matchResults}
              onPlayAgain={() => {
                if (mode === 'reservation') {
                  openReservationSeatSelection();
                } else {
                  startNewMatch(mode);
                }
              }}
              playAgainLabel={mode === 'reservation' ? '选择座位进入下一局' : '下一局 · 重新发牌'}
              quickPlayAgainLabel={mode === 'reservation' ? '选择座位继续' : '极速再来一局 (自动发牌)'}
              onBackToMenu={() => {
                setGameState('menu');
              }}
              onOpenChat={() => setShowChatDrawer(true)}
            />
          </div>
        )}
        {gameState === 'arranging' && (
          <div className="w-full max-w-5xl flex-1 flex flex-col items-center justify-between gap-2 py-1 px-0 min-h-0">
            {/* 🚆 Compact Carriage Header Bar with Live Seating & Chat */}
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
              onOpenChat={() => mode !== 'reservation' && setShowChatDrawer(true)}
              latestMessage={messages[messages.length - 1] || null}
              onExit={() => setGameState('menu')}
              players={playersInMatch}
            />


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

            {/* 💬 Tactical Table Chat Bar (仅在实时对战场提供语音与文本聊天功能) */}
            {mode !== 'reservation' ? (
              <div className="w-full max-w-2xl mx-auto shrink-0 px-1 sm:px-2">
                <TableTacticalChatBar
                  onSendMessage={handleSendMessage}
                  onOpenFullChat={() => setShowChatDrawer(true)}
                  ttsEnabled={ttsEnabled}
                  onToggleTts={() => setTtsEnabled(!ttsEnabled)}
                  unreadCount={0}
                />
              </div>
            ) : (
              <div className="w-full max-w-2xl mx-auto shrink-0 px-1 sm:px-2 my-0.5">
                <div className="w-full py-1.5 px-3 bg-slate-950/80 border border-slate-800/80 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-slate-400 shadow-inner">
                  <VolumeX className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>📅 当前为【预约场】：已开启纯净无打扰模式，不含语音与文本聊天</span>
                </div>
              </div>
            )}

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
        onOpenPoints={() => setShowPointsModal(true)}
        currentPoints={currentAccount.points}
      />

      <RuleModal isOpen={showRuleModal} onClose={() => setShowRuleModal(false)} />

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
        mode={mode}
        currentCarriageIndex={carriageIndex}
        onSelectCarriageIndex={idx => {
          setPlayerCarriageIndexProgress(idx, mode);
          startNewMatch(mode);
          setShowCarriageHubModal(false);
        }}
        onResetPool={() => {
          startNewMatch(mode);
        }}
      />

      <SubmitChoiceModal
        isOpen={showSubmitChoiceModal}
        onClose={() => setShowSubmitChoiceModal(false)}
        onConfirm={handleConfirmSubmit}
        onToggleSpecialHand={() => setUseSpecialHand(!useSpecialHand)}
        carriageIndex={carriageIndex}
        seatIndex={carriageSeatIndex}
        mode={mode}
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

      <ReservationModal
        isOpen={showReservationModal}
        onClose={() => setShowReservationModal(false)}
        onStartReservationMatch={(_roomTitle) => {
          setShowReservationModal(false);
          openReservationSeatSelection();
        }}
        userPoints={currentAccount.points}
      />

      <ReservationSeatModal
        isOpen={showSeatModal}
        onClose={() => setShowSeatModal(false)}
        carriageIndex={seatModalRound}
        carriage={seatModalCarriage}
        currentUserId={currentAccount.id || 'player_user'}
        onSelectSeat={(seatIndex) => handleSelectReservationSeat(seatIndex, seatModalRound)}
        previousRoundResult={previousRoundResult}
        onAdvanceToNextRound={() => openReservationSeatSelection(seatModalRound + 1)}
      />

      {/* 💬 Floating Chat Widget (仅在实时对战场显示) */}
      {mode !== 'reservation' && (
        <ChatFloatingWidget
          activeMessages={messages}
          unreadCount={0}
          onOpenChat={() => setShowChatDrawer(true)}
        />
      )}

      {/* 💬 Full Voice & Text Chat Drawer (仅在实时对战场显示) */}
      {mode !== 'reservation' && (
        <ChatDrawer
          isOpen={showChatDrawer}
          onClose={() => setShowChatDrawer(false)}
          messages={messages}
          onSendMessage={handleSendMessage}
          currentUserId={currentAccount.id || currentAccount.phone || 'player_user'}
          currentUserName={currentAccount.nickname || playerName || '我'}
          currentUserAvatar={currentAccount.avatar || '😎'}
          ttsEnabled={ttsEnabled}
          onToggleTts={() => setTtsEnabled(!ttsEnabled)}
        />
      )}
    </div>
  );
}
