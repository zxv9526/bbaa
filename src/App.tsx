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
  autoFixDaoShui
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
  CarriagePoolStats,
  resetCarriagePool
} from './lib/carriageManager';
import { CarriageHeaderBar } from './components/CarriageHeaderBar';
import { CarriageHubModal } from './components/CarriageHubModal';

type GameMode = 'vs_ai_8p' | 'vs_ai_4p' | 'vs_ai_2p' | 'multiplayer';

export default function App() {
  const [currentAccount, setCurrentAccount] = useState<UserAccount>(() => getCurrentAccount());
  const [playerName, setPlayerName] = useState<string>(() => currentAccount.nickname);

  const [mode, setMode] = useState<GameMode>('vs_ai_4p');
  const [gameState, setGameState] = useState<'menu' | 'room_lobby' | 'arranging' | 'revealing'>('menu');
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinInputCode8P, setJoinInputCode8P] = useState<string>('');
  const [joinInputCode4P, setJoinInputCode4P] = useState<string>('');

  // Carriage Mode State (8-player Async Carriage Flow)
  const [carriageSeatIndex, setCarriageSeatIndex] = useState<number>(0);
  const [carriageIndex, setCarriageIndex] = useState<number>(() => getPlayerCarriageIndexProgress());
  const [carriageId, setCarriageId] = useState<string>('');
  const [carriageStats, setCarriageStats] = useState<CarriagePoolStats>(() => getCarriageStats());
  const [showCarriageHubModal, setShowCarriageHubModal] = useState<boolean>(false);
  const [carriageToast, setCarriageToast] = useState<{ show: boolean; msg: string; pts: number } | null>(null);

  // Audio mute state
  const [isMuted, setIsMuted] = useState(false);

  // Modals
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showRankModal, setShowRankModal] = useState(false);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [showSkinModal, setShowSkinModal] = useState(false);

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

  // AI Suggestions
  const [suggestions, setSuggestions] = useState<ArrangementOption[]>([]);
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

  // 1. On Mount: Auto-check and initialize D1 database & load player stats & card skins
  useEffect(() => {
    ApiClient.initializeDatabase();
    initCardSkins();
    refreshPlayerStats(playerName);
  }, []);

  // Sync account updates
  useEffect(() => {
    return subscribeAccount(acc => {
      setCurrentAccount(acc);
      setPlayerName(acc.nickname);
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

  // Start a new local match (8P, 4P, or 2P)
  const startNewMatch = (selectedMode: GameMode = mode, seatOverride?: number) => {
    sounds.playDeal();
    setMode(selectedMode);
    setErrorMsg('');
    setMatchResults(null);
    setUseSpecialHand(false);

    // 🚆 8人模式：使用预生牌存储异步车厢连战系统
    if (selectedMode === 'vs_ai_8p') {
      const activeSeat = typeof seatOverride === 'number' ? seatOverride : carriageSeatIndex;
      const { carriage, seatIndex, handCards, stats } = getOrCreateCurrentCarriage(activeSeat);
      
      setCarriageSeatIndex(seatIndex);
      setCarriageIndex(carriage.index);
      setCarriageId(carriage.id);
      setCarriageStats(stats);

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

      // Compute AI Suggestions for player
      const smartSuggestions = getSuggestedArrangements(sortedPlayerHand);
      setSuggestions(smartSuggestions);
      patternChangerRef.current = new PatternChanger(sortedPlayerHand);

      // Prepare players list for 8-player carriage room
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
        }
      ];

      const aiAvatars = ['🦁', '🐯', '🦊', '🐰', '🐼', '鹰', '🦄'];
      const aiNames = ['赌神阿发', '雀圣阿旺', '十三水老强', '爆牌九哥', '顺子妹子', '同花顺大佬', '铁支杀手'];

      for (let i = 1; i < 8; i++) {
        const s = (seatIndex + i) % 8;
        const seatCards = carriage.hands[s]?.cards || [];
        const aiArrange = aiArrangeCards(seatCards);
        playersList.push({
          id: `ai_${i}`,
          name: `${aiNames[i - 1]} (${s + 1}号位)`,
          isAi: true,
          avatar: aiAvatars[i - 1] || '🤖',
          cards: seatCards,
          arrangement: aiArrange
        });
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
    setFront(sortedPlayerHand.slice(0, 3));
    setMid(sortedPlayerHand.slice(3, 8));
    setBack(sortedPlayerHand.slice(8, 13));
    setSelectedCardIds([]);

    // Detect Special Hand
    const special = detectSpecialHand(sortedPlayerHand);
    setSpecialHand(special);

    // Compute AI Suggestions for player
    const smartSuggestions = getSuggestedArrangements(sortedPlayerHand);
    setSuggestions(smartSuggestions);
    patternChangerRef.current = new PatternChanger(sortedPlayerHand);

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

  // Multi-card selection toggle
  const handleToggleCardSelect = (cardId: string) => {
    sounds.playCardPick();
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

  // Reset hand cards to initial 3/5/5 distribution
  const handleResetHand = () => {
    sounds.playCardPick();
    const all = sortCards([
      ...front,
      ...mid,
      ...back,
      ...pool
    ]);
    setFront(all.slice(0, 3));
    setMid(all.slice(3, 8));
    setBack(all.slice(8, 13));
    setPool([]);
    setSelectedCardIds([]);
    setErrorMsg('');
  };

  // Swap Middle and Back Duns
  const handleSwapMidBack = () => {
    sounds.playSwap();
    const currentMid = [...mid];
    const currentBack = [...back];
    setMid(currentBack);
    setBack(currentMid);
    setErrorMsg('');
  };

  // Smart Pattern Changer
  const handleChangePattern = () => {
    sounds.playCardPick();
    if (patternChangerRef.current) {
      const res = patternChangerRef.current.getNextPatternWithMeta();
      if (res) {
        setFront(res.pattern.front);
        setMid(res.pattern.middle);
        setBack(res.pattern.back);
        setPool([]);
        setSelectedCardIds([]);
        setErrorMsg('');
      }
    }
  };

  // Auto Fix Dao Shui
  const handleAutoFix = () => {
    sounds.playAutoArrange();
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
    }
  };

  // Apply suggestion
  const applySuggestion = (option: ArrangementOption) => {
    sounds.playAutoArrange();
    setFront([...option.front]);
    setMid([...option.middle]);
    setBack([...option.back]);
    setPool([]);
    setSelectedCardIds([]);
    setErrorMsg('');
  };

  // Reset slots to original hand order
  const handleResetSlots = () => {
    sounds.playCardPick();
    const allCards = sortCards([
      ...front,
      ...mid,
      ...back,
      ...pool
    ]);
    setFront(allCards.slice(0, 3));
    setMid(allCards.slice(3, 8));
    setBack(allCards.slice(8, 13));
    setPool([]);
    setSelectedCardIds([]);
    setErrorMsg('');
  };

  // Submit Player Arrangement & Reveal
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
      settleMatch(userArrangement);
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

    settleMatch(userArrangement);
  };

  const settleMatch = async (userArrangement: PlayerArrangement) => {
    // 🚆 8人模式：车厢异步结算并自动秒入下一节车厢
    if (mode === 'vs_ai_8p') {
      try {
        const res = await submitCarriageHandAndAdvance({
          carriageId,
          seatIndex: carriageSeatIndex,
          playerAccount: currentAccount,
          arrangement: userArrangement,
          handCards: originalHand
        });

        if (res.playerResult.finalPoints > 0) {
          sounds.playVictory();
          confetti({ particleCount: 70, spread: 70, origin: { y: 0.5 } });
        } else {
          sounds.playDunWin();
        }

        const deltaStr = res.playerResult.finalPoints >= 0 ? `+${res.playerResult.finalPoints}` : `${res.playerResult.finalPoints}`;
        setCarriageToast({
          show: true,
          msg: `🎉 第 ${res.completedCarriage.index} 节车厢理牌完成！获得 ${deltaStr} 水！已自动进入第 ${res.nextCarriageData.carriage.index} 节车厢继续理牌...`,
          pts: res.playerResult.finalPoints
        });

        setTimeout(() => {
          setCarriageToast(null);
        }, 4500);

        // 自动无缝切换到下一节车厢
        setCarriageIndex(res.nextCarriageData.carriage.index);
        setCarriageId(res.nextCarriageData.carriage.id);
        setCarriageStats(res.updatedStats);

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

        refreshPlayerStats(currentAccount.nickname || playerName);
      } catch (err: any) {
        setErrorMsg(err.message || '车厢理牌提交失败');
      }
      return;
    }

    // 4人场与2人场标准结算
    const updatedPlayers = playersInMatch.map(p => {
      if (!p.isAi) {
        return { ...p, arrangement: userArrangement };
      }
      return p;
    });

    const results = calculateMatchScores(updatedPlayers);
    setMatchResults(results);
    setGameState('revealing');

    const userResult = results.find(r => r.playerId === 'player_user');
    if (userResult) {
      // Sync points to User Account
      const pointsDelta = userResult.finalPoints * 100;
      addPoints(
        pointsDelta,
        pointsDelta >= 0 ? 'MATCH_WIN' : 'MATCH_LOSS',
        `${mode === 'vs_ai_4p' ? '四人经典战' : '双人单挑'}结算 (${userResult.finalPoints >= 0 ? '+' : ''}${userResult.finalPoints}道)`
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
    }
  };

  // Join Multiplayer Room (8P or 4P)
  const handleJoinRoom = async (codeToJoin: string) => {
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
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white overflow-hidden">
      {/* 1. Header Bar */}
      {gameState === 'menu' ? (
        <header className="shrink-0 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-sm">
          {/* TOP LEFT: Registration / Login / Profile Entry */}
          <button
            id="user-auth-entry-btn"
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-3 px-3.5 py-2 rounded-2xl border border-slate-800 bg-slate-950/80 hover:bg-slate-900 hover:border-blue-500/50 transition active:scale-95 text-left group shadow-sm"
            title="手机号登录 / 注册 / 个人中心"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/40 flex items-center justify-center text-xl shadow-inner group-hover:scale-105 transition">
              {currentAccount.avatar}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white group-hover:text-blue-300 transition truncate max-w-[120px]">
                  {currentAccount.nickname}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {currentAccount.phone}
              </div>
            </div>
          </button>
          
          {/* Center Brand Title */}
          <div
            onClick={() => setGameState('menu')}
            className="cursor-pointer select-none text-center"
          >
            <h1 className="font-black text-xl tracking-wider text-white flex items-center justify-center gap-2">
              十三水
            </h1>
          </div>

          {/* TOP RIGHT: Points Management Entry */}
          <div className="flex items-center gap-3">
            <button
              id="points-management-entry-btn"
              onClick={() => setShowPointsModal(true)}
              className="flex items-center gap-2.5 px-3.5 sm:px-4 py-2 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/50 to-slate-950 hover:border-amber-400 text-amber-300 transition active:scale-95 shadow-md shadow-amber-500/10 group"
              title="点击打开积分管理：手机号互赠积分"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-base text-amber-400 group-hover:scale-110 transition">
                🪙
              </div>
              <div className="text-left">
                <div className="text-[10px] text-amber-400/80 font-bold">积分管理</div>
                <div className="text-sm font-black text-amber-400 leading-none">
                  {currentAccount.points.toLocaleString()}
                </div>
              </div>
            </button>
          </div>
        </header>
      ) : (
        <header className="shrink-0 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 px-4 py-2 flex items-center justify-center shadow-sm overflow-x-auto no-scrollbar">
          <div className="flex flex-nowrap items-center justify-center gap-3 w-full max-w-5xl whitespace-nowrap">
            <span className="text-xs font-bold text-slate-400 shrink-0">参赛玩家：</span>
            {playersInMatch.map(p => (
              <div key={p.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 rounded-xl border border-slate-700/50 shrink-0">
                <span className="text-sm">{p.avatar}</span>
                <span className="text-xs font-bold text-slate-200">{p.name} {p.isAi ? '' : '(我)'}</span>
              </div>
            ))}
          </div>
        </header>
      )}

      {/* 2. Main Body Content: Minimalist & Clean Two Arena Blocks */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-3 flex flex-col items-center justify-center overflow-hidden">
        {gameState === 'menu' && (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 my-auto">
            {/* BLOCK 1: 八人车厢场 (8-Player Carriage Async Arena) */}
            <div
              id="arena-8p-section"
              onClick={() => startNewMatch('vs_ai_8p')}
              className="relative bg-gradient-to-br from-red-950/70 via-slate-900 to-slate-950 border-2 border-red-900/60 hover:border-amber-500 p-6 sm:p-8 rounded-3xl flex flex-col justify-between gap-6 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-red-950/50 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-red-600 text-slate-950 flex items-center justify-center text-2xl font-black shadow-lg shadow-red-600/30 group-hover:scale-105 transition duration-300">
                    🚆
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30 flex items-center gap-1">
                      <Layers className="w-3 h-3 text-amber-400" /> 预存300局车厢
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight group-hover:text-amber-300 transition flex items-center gap-2">
                    八人车厢连战
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    预发牌300局存储 • 提交理牌自动瞬移下一车厢 • 缺50局自动满额
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-sm sm:text-base font-bold text-amber-400 group-hover:text-amber-300">
                <span className="flex items-center gap-1.5">
                  <Train className="w-4 h-4" /> 进入第 {carriageIndex} 节车厢
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center group-hover:translate-x-1.5 transition">
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
            </div>

            {/* BLOCK 2: 四人场 (4-Player Arena) */}
            <div
              id="arena-4p-section"
              onClick={() => startNewMatch('vs_ai_4p')}
              className="relative bg-gradient-to-br from-blue-950/70 via-slate-900 to-slate-950 border-2 border-blue-900/60 hover:border-blue-500 p-6 sm:p-8 rounded-3xl flex flex-col justify-between gap-6 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/50 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-slate-950 flex items-center justify-center text-2xl font-black shadow-lg shadow-blue-600/30 group-hover:scale-105 transition duration-300">
                    ⚔️
                  </div>
                  <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/30">
                    单副 52 牌
                  </span>
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
                <span>立即进入四人场</span>
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center group-hover:translate-x-1.5 transition">
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
            </div>
          </div>
        )}

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
          <div className="w-full max-w-6xl flex flex-col items-center gap-6">
            <ShowdownStage
              results={matchResults}
              onPlayAgain={() => startNewMatch(mode)}
              onBackToMenu={() => setGameState('menu')}
            />
          </div>
        )}
        {gameState === 'arranging' && (
          <div className="w-full max-w-5xl flex flex-col items-center gap-3 py-1">
            {/* 🚆 Carriage Header Bar for 8-Player Async Mode */}
            {mode === 'vs_ai_8p' && (
              <CarriageHeaderBar
                currentCarriageIndex={carriageIndex}
                seatIndex={carriageSeatIndex}
                onSeatChange={newSeat => {
                  setCarriageSeatIndex(newSeat);
                  startNewMatch('vs_ai_8p', newSeat);
                }}
                stats={carriageStats}
                onOpenHub={() => setShowCarriageHubModal(true)}
              />
            )}

            {/* 🚆 Carriage Transition Toast Notification */}
            {carriageToast && carriageToast.show && (
              <div className="w-full bg-gradient-to-r from-emerald-950/90 via-slate-900 to-indigo-950/90 border border-emerald-500/40 rounded-2xl px-4 py-3 shadow-xl flex items-center justify-between text-xs font-bold text-emerald-300 animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">🚆</span>
                  <span>{carriageToast.msg}</span>
                </div>
                <button
                  onClick={() => setCarriageToast(null)}
                  className="text-slate-400 hover:text-white px-2 py-1 transition"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Special Hand Alert Banner */}
            {specialHand && (
              <SpecialHandBanner
                specialHand={specialHand}
                isUsed={useSpecialHand}
                onUseSpecial={() => setUseSpecialHand(!useSpecialHand)}
              />
            )}

            {/* Error Message Banner */}
            {errorMsg && (
              <div className="w-full p-2.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            {/* Quick Actions Bar */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 border border-slate-800 rounded-2xl px-3.5 py-2 shadow-md">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleChangePattern}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                  title="智能轮巡合法组合"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 变换牌型
                </button>
                <button
                  onClick={handleSwapMidBack}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                  title="交换中墩与后墩"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" /> 中后互换
                </button>
                <button
                  onClick={handleResetHand}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                  title="恢复初始推荐分布 (3/5/5)"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-blue-400" /> 重置理牌
                </button>
                {isCurrentDaoShui && (
                  <button
                    onClick={handleAutoFix}
                    className="px-3 py-1.5 rounded-xl bg-rose-600/30 border border-rose-500/50 text-rose-200 hover:bg-rose-600/40 text-xs font-black flex items-center gap-1.5 transition animate-pulse"
                    title="自动调整倒水"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> 一键调水
                  </button>
                )}
              </div>

              {/* Selection Status & Clear selection */}
              <div className="flex items-center gap-2 text-xs">
                {selectedCardIds.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/30">
                      已选 {selectedCardIds.length} 张
                    </span>
                    <button
                      onClick={() => setSelectedCardIds([])}
                      className="text-slate-400 hover:text-slate-200 underline font-semibold text-[11px]"
                    >
                      取消选择
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-500 font-medium text-[11px]">
                    点牌选定，点击目标墩完成移动
                  </span>
                )}
              </div>
            </div>

            {/* Smart Strategy Selection Chips */}
            {suggestions.length > 0 && (
              <div className="w-full flex items-center gap-1.5 overflow-x-auto py-1 px-1 scrollbar-none text-xs">
                <span className="text-amber-400/90 font-bold text-[11px] shrink-0 flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-xl border border-amber-500/20">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 智能方案:
                </span>
                {suggestions.map((option, idx) => {
                  const isCurrentOption =
                    front.length === 3 &&
                    mid.length === 5 &&
                    back.length === 5 &&
                    option.front.every((c, i) => c.id === front[i]?.id) &&
                    option.middle.every((c, i) => c.id === mid[i]?.id) &&
                    option.back.every((c, i) => c.id === back[i]?.id);

                  return (
                    <button
                      key={idx}
                      onClick={() => applySuggestion(option)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1 border active:scale-95 ${
                        isCurrentOption
                          ? 'bg-amber-500/25 text-amber-200 border-amber-400 shadow-md shadow-amber-500/10 scale-[1.02]'
                          : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-amber-300 hover:border-slate-700'
                      }`}
                      title={option.title}
                    >
                      {option.tag}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Arrangement Card Containers */}
            <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-3.5 sm:p-4 shadow-xl flex flex-col gap-3">
              
              {/* 1. FRONT DUN (前墩) */}
              <div
                onClick={() => selectedCardIds.length > 0 && handleMoveSelectedTo('front')}
                className={`flex flex-col gap-1 p-2.5 rounded-2xl border transition-all ${
                  selectedCardIds.length > 0
                    ? 'border-blue-500/60 bg-blue-950/30 cursor-pointer hover:bg-blue-900/40 hover:border-blue-400 shadow-md'
                    : 'border-slate-800/80 bg-slate-950/50'
                }`}
              >
                <div className="flex items-center justify-between w-full text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-slate-300">前墩</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                      front.length === 3 ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {front.length}/3 张
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {fEval && (
                      <span className="text-blue-400 font-black text-xs">
                        [{HAND_TYPE_CN[fEval.type]}] {fEval.description}
                      </span>
                    )}
                    {selectedCardIds.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSelectedTo('front');
                        }}
                        className="px-2.5 py-0.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition active:scale-95"
                      >
                        移入前墩 ({selectedCardIds.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 min-h-[82px] p-1 rounded-xl bg-slate-900/50">
                  {front.length === 0 ? (
                    <div className="w-full py-3 text-center text-xs text-slate-500 font-medium">
                      {selectedCardIds.length > 0 ? '👉 点击此处放入前墩' : '前墩暂无扑克牌'}
                    </div>
                  ) : (
                    front.map(c => (
                      <CardView
                        key={c.id}
                        card={c}
                        size="md"
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
                className={`flex flex-col gap-1 p-2.5 rounded-2xl border transition-all ${
                  selectedCardIds.length > 0
                    ? 'border-indigo-500/60 bg-indigo-950/30 cursor-pointer hover:bg-indigo-900/40 hover:border-indigo-400 shadow-md'
                    : 'border-slate-800/80 bg-slate-950/50'
                }`}
              >
                <div className="flex items-center justify-between w-full text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <span className="text-slate-300">中墩</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                      mid.length === 5 ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {mid.length}/5 张
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {mEval && (
                      <span className="text-indigo-400 font-black text-xs">
                        [{HAND_TYPE_CN[mEval.type]}] {mEval.description}
                      </span>
                    )}
                    {selectedCardIds.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSelectedTo('mid');
                        }}
                        className="px-2.5 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow transition active:scale-95"
                      >
                        移入中墩 ({selectedCardIds.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 min-h-[82px] p-1 rounded-xl bg-slate-900/50">
                  {mid.length === 0 ? (
                    <div className="w-full py-3 text-center text-xs text-slate-500 font-medium">
                      {selectedCardIds.length > 0 ? '👉 点击此处放入中墩' : '中墩暂无扑克牌'}
                    </div>
                  ) : (
                    mid.map(c => (
                      <CardView
                        key={c.id}
                        card={c}
                        size="md"
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
                className={`flex flex-col gap-1 p-2.5 rounded-2xl border transition-all ${
                  selectedCardIds.length > 0
                    ? 'border-purple-500/60 bg-purple-950/30 cursor-pointer hover:bg-purple-900/40 hover:border-purple-400 shadow-md'
                    : 'border-slate-800/80 bg-slate-950/50'
                }`}
              >
                <div className="flex items-center justify-between w-full text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="text-slate-300">后墩</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                      back.length === 5 ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {back.length}/5 张
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {bEval && (
                      <span className="text-purple-400 font-black text-xs">
                        [{HAND_TYPE_CN[bEval.type]}] {bEval.description}
                      </span>
                    )}
                    {selectedCardIds.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSelectedTo('back');
                        }}
                        className="px-2.5 py-0.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow transition active:scale-95"
                      >
                        移入后墩 ({selectedCardIds.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 min-h-[82px] p-1 rounded-xl bg-slate-900/50">
                  {back.length === 0 ? (
                    <div className="w-full py-3 text-center text-xs text-slate-500 font-medium">
                      {selectedCardIds.length > 0 ? '👉 点击此处放入后墩' : '后墩暂无扑克牌'}
                    </div>
                  ) : (
                    back.map(c => (
                      <CardView
                        key={c.id}
                        card={c}
                        size="md"
                        selected={selectedCardIds.includes(c.id)}
                        onClick={() => handleToggleCardSelect(c.id)}
                      />
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Bottom Submit Action */}
            <div className="w-full flex items-center justify-center pt-1">
              <button
                onClick={handleSubmitArrangement}
                className="w-full max-w-md py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-base font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition active:scale-95 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                提交牌型 ({front.length + mid.length + back.length}/13张)
              </button>
            </div>
          </div>
        )}
      </main>
      {/* 5. Clean Footer */}
      <footer className="shrink-0 border-t border-slate-800/80 bg-slate-900/40 px-6 py-2.5 text-center text-xs text-slate-500">
        <div>十三水 (Chinese Poker) · 纯粹经典牌局</div>
      </footer>

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
        currentCarriageIndex={carriageIndex}
        onSelectCarriageIndex={idx => {
          setPlayerCarriageIndexProgress(idx);
          startNewMatch('vs_ai_8p');
          setShowCarriageHubModal(false);
        }}
        onResetPool={() => {
          startNewMatch('vs_ai_8p');
        }}
      />
    </div>
  );
}
