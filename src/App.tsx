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
  Gift
} from 'lucide-react';

type GameMode = 'vs_ai_8p' | 'vs_ai_4p' | 'vs_ai_2p' | 'multiplayer';

export default function App() {
  const [currentAccount, setCurrentAccount] = useState<UserAccount>(() => getCurrentAccount());
  const [playerName, setPlayerName] = useState<string>(() => currentAccount.nickname);

  const [mode, setMode] = useState<GameMode>('vs_ai_4p');
  const [gameState, setGameState] = useState<'menu' | 'room_lobby' | 'arranging' | 'revealing'>('menu');
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinInputCode8P, setJoinInputCode8P] = useState<string>('');
  const [joinInputCode4P, setJoinInputCode4P] = useState<string>('');

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
  const [front, setFront] = useState<(Card | null)[]>([null, null, null]);
  const [mid, setMid] = useState<(Card | null)[]>([null, null, null, null, null]);
  const [back, setBack] = useState<(Card | null)[]>([null, null, null, null, null]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
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
  const startNewMatch = (selectedMode: GameMode = mode) => {
    sounds.playDeal();
    setMode(selectedMode);
    const is8P = selectedMode === 'vs_ai_8p';
    const deck = shuffle(is8P ? createDoubleDeck() : createDeck());

    const numPlayers = selectedMode === 'vs_ai_2p' ? 2 : selectedMode === 'vs_ai_8p' ? 8 : 4;
    const playerDealt = deck.slice(0, 13);
    const sortedPlayerHand = sortCards(playerDealt);

    setOriginalHand(sortedPlayerHand);
    setPool([]);
    setFront(sortedPlayerHand.slice(0, 3));
    setMid(sortedPlayerHand.slice(3, 8));
    setBack(sortedPlayerHand.slice(8, 13));
    setSelectedCardId(null);
    setErrorMsg('');
    setMatchResults(null);
    setUseSpecialHand(false);

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

  // Card click in Pool
  const handlePoolCardClick = (card: Card) => {
    sounds.playCardPick();
    if (selectedCardId === card.id) {
      setSelectedCardId(null);
    } else {
      setSelectedCardId(card.id);
    }
  };

  // Slot click to place or swap
  const handleSlotClick = (row: 'front' | 'mid' | 'back', index: number) => {
    if (gameState !== 'arranging') return;

    const targetArray = row === 'front' ? front : row === 'mid' ? mid : back;
    const clickedCard = targetArray[index];

    if (selectedCardId) {
      if (clickedCard && selectedCardId === clickedCard.id) {
        // Deselect
        setSelectedCardId(null);
        return;
      }

      sounds.playCardPick();
      
      let sourceRow: 'pool' | 'front' | 'mid' | 'back' = 'pool';
      let sourceIndex = -1;
      let selectedObj: Card | undefined;
      
      if ((sourceIndex = pool.findIndex(c => c.id === selectedCardId)) !== -1) {
        sourceRow = 'pool';
        selectedObj = pool[sourceIndex];
      } else if ((sourceIndex = front.findIndex(c => c?.id === selectedCardId)) !== -1) {
        sourceRow = 'front';
        selectedObj = front[sourceIndex]!;
      } else if ((sourceIndex = mid.findIndex(c => c?.id === selectedCardId)) !== -1) {
        sourceRow = 'mid';
        selectedObj = mid[sourceIndex]!;
      } else if ((sourceIndex = back.findIndex(c => c?.id === selectedCardId)) !== -1) {
        sourceRow = 'back';
        selectedObj = back[sourceIndex]!;
      }

      if (!selectedObj) return;

      if (sourceRow === 'pool') {
         setPool(prev => prev.filter(c => c.id !== selectedCardId));
         const newArr = [...targetArray];
         if (clickedCard) {
            setPool(prev => sortCards([...prev, clickedCard]));
         }
         newArr[index] = selectedObj;
         if (row === 'front') setFront(newArr);
         else if (row === 'mid') setMid(newArr);
         else setBack(newArr);
      } else {
         const sourceArray = sourceRow === 'front' ? front : sourceRow === 'mid' ? mid : back;
         
         if (sourceRow === row) {
            const newArr = [...targetArray];
            newArr[sourceIndex] = clickedCard || null;
            newArr[index] = selectedObj;
            if (row === 'front') setFront(newArr);
            else if (row === 'mid') setMid(newArr);
            else setBack(newArr);
         } else {
            const newSourceArr = [...sourceArray];
            const newTargetArr = [...targetArray];
            newSourceArr[sourceIndex] = clickedCard || null;
            newTargetArr[index] = selectedObj;
            
            if (sourceRow === 'front') setFront(newSourceArr);
            else if (sourceRow === 'mid') setMid(newSourceArr);
            else setBack(newSourceArr);
            
            if (row === 'front') setFront(newTargetArr);
            else if (row === 'mid') setMid(newTargetArr);
            else setBack(newTargetArr);
         }
      }
      setSelectedCardId(null);
      setErrorMsg('');
    } else {
      if (clickedCard) {
        sounds.playCardPick();
        setSelectedCardId(clickedCard.id);
      }
    }
  };

  // Quick fill pattern into a dun
  const handleApplyPatternToDun = (patternCards: Card[], targetDun: 'front' | 'mid' | 'back') => {
    sounds.playCardPick();
    
    const allCards = [
      ...front.filter(Boolean),
      ...mid.filter(Boolean),
      ...back.filter(Boolean),
      ...pool
    ] as Card[];

    const patternIds = new Set(patternCards.map(c => c.id));
    const remainingCards = allCards.filter(c => !patternIds.has(c.id));

    let fNew: Card[] = [];
    let mNew: Card[] = [];
    let bNew: Card[] = [];

    if (targetDun === 'front') {
      fNew = patternCards.slice(0, 3);
      const poolForOthers = [...patternCards.slice(3), ...remainingCards];
      mNew = poolForOthers.slice(0, 5);
      bNew = poolForOthers.slice(5, 10);
    } else if (targetDun === 'mid') {
      mNew = patternCards.slice(0, 5);
      const poolForOthers = [...patternCards.slice(5), ...remainingCards];
      fNew = poolForOthers.slice(0, 3);
      bNew = poolForOthers.slice(3, 8);
    } else if (targetDun === 'back') {
      bNew = patternCards.slice(0, 5);
      const poolForOthers = [...patternCards.slice(5), ...remainingCards];
      fNew = poolForOthers.slice(0, 3);
      mNew = poolForOthers.slice(3, 8);
    }

    setFront(fNew);
    setMid(mNew);
    setBack(bNew);
    setPool([]);

    setSelectedCardId(null);
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

  // Auto Fix Dao Shui (一键修正倒水)
  
  const handleChangePattern = () => {
    sounds.playCardPick();
    if (patternChangerRef.current) {
      const nextPattern = patternChangerRef.current.getNextPattern();
      if (nextPattern) {
        setFront(nextPattern.front);
        setMid(nextPattern.middle);
        setBack(nextPattern.back);
        setPool([]);
        setSelectedCardId(null);
        setErrorMsg('');
      }
    }
  };

  const handleAutoFix = () => {
    sounds.playAutoArrange();
    const allPlacedOrPool = [
      ...front.filter(Boolean),
      ...mid.filter(Boolean),
      ...back.filter(Boolean),
      ...pool
    ] as Card[];

    const fixed = autoFixDaoShui(allPlacedOrPool);
    if (fixed) {
      setFront(fixed.front);
      setMid(fixed.middle);
      setBack(fixed.back);
      setPool([]);
      setSelectedCardId(null);
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
    setSelectedCardId(null);
    setErrorMsg('');
      };

  // Reset slots to original hand order
  const handleResetSlots = () => {
    sounds.playCardPick();
    const allCards = sortCards([
      ...front.filter(Boolean),
      ...mid.filter(Boolean),
      ...back.filter(Boolean),
      ...pool
    ] as Card[]);
    setFront(allCards.slice(0, 3));
    setMid(allCards.slice(3, 8));
    setBack(allCards.slice(8, 13));
    setPool([]);
    setSelectedCardId(null);
    setErrorMsg('');
  };

  // Submit Player Arrangement & Reveal
  const handleSubmitArrangement = async () => {
    if (useSpecialHand && specialHand) {
      // Special Hand submission
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
      setErrorMsg('请将 13 张手牌全部放置完毕后再提交。');
      return;
    }

    const fCards = front as Card[];
    const mCards = mid as Card[];
    const bCards = back as Card[];

    const isValid = isValidArrangement(fCards, mCards, bCards);
    if (!isValid) {
      sounds.playError();
      setErrorMsg('⚠️ 违规倒水：后墩必须大于等于中墩，中墩必须大于等于前墩！可点击“一键调水”或“中后互换”。');
      return;
    }

    const userArrangement: PlayerArrangement = {
      front: fCards,
      middle: mCards,
      back: bCards,
      isValid: true,
      isDaoShui: false
    };

    settleMatch(userArrangement);
  };

  const settleMatch = async (userArrangement: PlayerArrangement) => {
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
        `${mode === 'vs_ai_8p' ? '八人巅峰战' : mode === 'vs_ai_4p' ? '四人经典战' : '双人单挑'}结算 (${userResult.finalPoints >= 0 ? '+' : ''}${userResult.finalPoints}道)`
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
  const frontFilled = front.every(Boolean);
  const midFilled = mid.every(Boolean);
  const backFilled = back.every(Boolean);
  const allFilled = frontFilled && midFilled && backFilled;

  const fEval = frontFilled ? evaluateHand(front as Card[], 'front') : null;
  const mEval = midFilled ? evaluateHand(mid as Card[], 'middle') : null;
  const bEval = backFilled ? evaluateHand(back as Card[], 'back') : null;

  const isCurrentDaoShui = allFilled && !isValidArrangement(front as Card[], mid as Card[], back as Card[]);

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
            {/* BLOCK 1: 八人场 (8-Player Arena) */}
            <div
              id="arena-8p-section"
              onClick={() => startNewMatch('vs_ai_8p')}
              className="relative bg-gradient-to-br from-red-950/70 via-slate-900 to-slate-950 border-2 border-red-900/60 hover:border-amber-500 p-6 sm:p-8 rounded-3xl flex flex-col justify-between gap-6 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-red-950/50 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-red-600 text-slate-950 flex items-center justify-center text-2xl font-black shadow-lg shadow-red-600/30 group-hover:scale-105 transition duration-300">
                    👑
                  </div>
                  <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
                    双副 104 牌
                  </span>
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
                <span>立即进入八人场</span>
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
          <div className="w-full max-w-5xl flex flex-col items-center gap-6">


            {/* Special Hand Alert Banner */}
            {specialHand && (
              <SpecialHandBanner
                specialHand={specialHand}
                isUsed={useSpecialHand}
                onUseSpecial={() => setUseSpecialHand(!useSpecialHand)}
              />
            )}

            {/* Player's Card Arrangement Table */}
            <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl flex flex-col items-center gap-6">
              {/* Header & Quick Action Buttons */}
              <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center text-xl font-bold">
                    <Layers className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-black text-base sm:text-lg text-white">
                      {playerName} 的理牌台
                    </h3>
                    <p className="text-xs text-slate-400">
                      点击手牌再点击槽位进行互换，或点击下方变换牌型
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                  {/* Swap Mid and Back */}
                  <button
                    onClick={handleSwapMidBack}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 transition active:scale-95"
                    title="交换中墩与后墩"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" /> 中后互换
                  </button>
                  {/* Auto-fix Dao Shui if invalid */}
                  {isCurrentDaoShui && (
                    <button
                      onClick={handleAutoFix}
                      className="px-3 py-2 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600/30 text-xs font-black flex items-center gap-1 transition animate-pulse"
                      title="一键调正倒水"
                    >
                      <Wand2 className="w-3.5 h-3.5" /> 一键调水
                    </button>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="w-full p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {errorMsg}
                </div>
              )}

              {/* 3 Slots: Front (3), Middle (5), Back (5) */}
              <div className="flex flex-col items-center gap-5 w-full">
                {/* 1. FRONT (前墩 3张) */}
                <div className="flex flex-col items-center gap-1.5 w-full">
                  <div className="flex items-center justify-between w-full max-w-sm px-2 text-xs font-bold text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      前墩 (3 张牌)
                    </span>
                    {fEval && (
                      <span className="text-blue-400 font-black">
                        [{HAND_TYPE_CN[fEval.type]}] {fEval.description}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {front.map((c, i) => (
                      <CardView
                        key={`front_${i}`}
                        card={c || undefined}
                        size="lg"
                        onClick={() => handleSlotClick('front', i)}
                      />
                    ))}
                  </div>
                </div>

                {/* 2. MIDDLE (中墩 5张) */}
                <div className="flex flex-col items-center gap-1.5 w-full">
                  <div className="flex items-center justify-between w-full max-w-md px-2 text-xs font-bold text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                      中墩 (5 张牌)
                    </span>
                    {mEval && (
                      <span className="text-indigo-400 font-black">
                        [{HAND_TYPE_CN[mEval.type]}] {mEval.description}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {mid.map((c, i) => (
                      <CardView
                        key={`mid_${i}`}
                        card={c || undefined}
                        size="lg"
                        onClick={() => handleSlotClick('mid', i)}
                      />
                    ))}
                  </div>
                </div>

                {/* 3. BACK (后墩 5张) */}
                <div className="flex flex-col items-center gap-1.5 w-full">
                  <div className="flex items-center justify-between w-full max-w-md px-2 text-xs font-bold text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                      后墩 (5 张牌)
                    </span>
                    {bEval && (
                      <span className="text-purple-400 font-black">
                        [{HAND_TYPE_CN[bEval.type]}] {bEval.description}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {back.map((c, i) => (
                      <CardView
                        key={`back_${i}`}
                        card={c || undefined}
                        size="lg"
                        onClick={() => handleSlotClick('back', i)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Actions: Change Pattern and Submit */}
              <div className="w-full flex items-center justify-center gap-4 pt-4 border-t border-slate-800/80">
                <button
                  onClick={handleChangePattern}
                  className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-bold flex items-center gap-2 shadow transition active:scale-95"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  变换牌型
                </button>
                <button
                  onClick={handleSubmitArrangement}
                  disabled={pool.length > 0 && !useSpecialHand}
                  className="px-8 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-sm font-black flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  提交牌型
                </button>
              </div>

              {/* Status Validation Alert */}
              {isCurrentDaoShui && (
                <div className="w-full p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold text-center flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  ⚠️ 发生违规倒水（后墩 &lt; 中墩 或 中墩 &lt; 前墩）！请调整牌位或点击上方“一键调水”。
                </div>
              )}
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
    </div>
  );
}
