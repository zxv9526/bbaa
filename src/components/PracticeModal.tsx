import React, { useState, useMemo } from 'react';
import { Card, SpecialHandType, PlayerArrangement, PlayerScoreDetail } from '../types';
import { CardView } from './CardView';
import {
  createDeck,
  shuffle,
  sortCards,
  detectSpecialHand,
  getSuggestedArrangements,
  generateSpecialHand,
  SPECIAL_HAND_CN,
  HAND_TYPE_CN,
  evaluateHand,
  isValidArrangement,
  aiArrangeCards,
  calculate4PlayerMatchScores
} from '../gameLogic';
import { sounds } from '../sound';
import confetti from 'canvas-confetti';
import {
  X,
  Sparkles,
  Shuffle,
  Wand2,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  BookOpen,
  Swords,
  RotateCcw,
  Trophy,
  ShieldAlert,
  ShieldCheck,
  Info,
  Layers,
  Zap,
  HelpCircle,
  Play
} from 'lucide-react';

interface PracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// 试玩虚拟电脑陪练
interface SimBot {
  id: string;
  name: string;
  avatar: string;
  cards: Card[];
  arrangement: PlayerArrangement;
}

export function PracticeModal({ isOpen, onClose }: PracticeModalProps) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'sim_match' | 'rules_guide' | 'special_lab'>('sim_match');

  // 1. 发 4 家牌 (1 家玩家 + 3 家试玩陪练机器人)
  const initGameCards = () => {
    const deck = shuffle(createDeck());
    const pCards = sortCards(deck.slice(0, 13));
    const bot1Cards = sortCards(deck.slice(13, 26));
    const bot2Cards = sortCards(deck.slice(26, 39));
    const bot3Cards = sortCards(deck.slice(39, 52));

    const bot1Arr = aiArrangeCards(bot1Cards);
    const bot2Arr = aiArrangeCards(bot2Cards);
    const bot3Arr = aiArrangeCards(bot3Cards);

    const bots: SimBot[] = [
      { id: 'sim_bot_1', name: '新手陪练·小明', avatar: '👦', cards: bot1Cards, arrangement: bot1Arr },
      { id: 'sim_bot_2', name: '进阶陪练·阿珍', avatar: '👩', cards: bot2Cards, arrangement: bot2Arr },
      { id: 'sim_bot_3', name: '雀圣陪练·老李', avatar: '🧔', cards: bot3Cards, arrangement: bot3Arr }
    ];

    const smart = getSuggestedArrangements(pCards);
    const initialFront = smart.length > 0 ? smart[0].front : pCards.slice(0, 3);
    const initialMid = smart.length > 0 ? smart[0].middle : pCards.slice(3, 8);
    const initialBack = smart.length > 0 ? smart[0].back : pCards.slice(8, 13);

    return {
      playerHand: pCards,
      front: initialFront,
      mid: initialMid,
      back: initialBack,
      bots
    };
  };

  const [gameState, setGameState] = useState<ReturnType<typeof initGameCards>>(() => initGameCards());
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [patternIndex, setPatternIndex] = useState<number>(0);

  // 比牌结算结果 (null 表示还在理牌阶段)
  const [showdownResults, setShowdownResults] = useState<PlayerScoreDetail[] | null>(null);

  const specialDetected = detectSpecialHand(gameState.playerHand);
  const suggestions = useMemo(() => getSuggestedArrangements(gameState.playerHand), [gameState.playerHand]);

  // 重新发牌 (换一副全新 13 张牌与陪练)
  const handleDealNewGame = () => {
    sounds.playDeal();
    const nextState = initGameCards();
    setGameState(nextState);
    setSelectedCardId(null);
    setPatternIndex(0);
    setShowdownResults(null);
  };

  // 点选两张牌对调 (Instant Two-Card Swap)
  const handleCardClick = (targetRow: 'front' | 'mid' | 'back', targetIdx: number) => {
    const rowCards = targetRow === 'front' ? gameState.front : targetRow === 'mid' ? gameState.mid : gameState.back;
    const clickedCard = rowCards[targetIdx];
    if (!clickedCard) return;

    if (selectedCardId && selectedCardId !== clickedCard.id) {
      // 触发直接对调！
      sounds.playSwap();
      const firstId = selectedCardId;
      const secondId = clickedCard.id;

      const swapInList = (list: Card[]) => {
        const firstObj = [...gameState.front, ...gameState.mid, ...gameState.back].find(c => c.id === firstId);
        const secondObj = [...gameState.front, ...gameState.mid, ...gameState.back].find(c => c.id === secondId);
        if (!firstObj || !secondObj) return list;

        return list.map(c => {
          if (c.id === firstId) return secondObj;
          if (c.id === secondId) return firstObj;
          return c;
        });
      };

      setGameState(prev => ({
        ...prev,
        front: swapInList(prev.front),
        mid: swapInList(prev.mid),
        back: swapInList(prev.back)
      }));

      setSelectedCardId(null);
      return;
    }

    if (selectedCardId === clickedCard.id) {
      setSelectedCardId(null);
    } else {
      sounds.playCardPick();
      setSelectedCardId(clickedCard.id);
    }
  };

  // 变换牌型
  const handleChangePattern = () => {
    if (suggestions.length <= 1) return;
    sounds.playAutoArrange();
    const nextIdx = (patternIndex + 1) % suggestions.length;
    setPatternIndex(nextIdx);
    const chosen = suggestions[nextIdx];
    setGameState(prev => ({
      ...prev,
      front: [...chosen.front],
      mid: [...chosen.middle],
      back: [...chosen.back]
    }));
    setSelectedCardId(null);
  };

  // 智能理牌 (重置为第1套推荐)
  const handleAutoSuggest = () => {
    sounds.playAutoArrange();
    if (suggestions.length > 0) {
      setPatternIndex(0);
      setGameState(prev => ({
        ...prev,
        front: [...suggestions[0].front],
        mid: [...suggestions[0].middle],
        back: [...suggestions[0].back]
      }));
    }
    setSelectedCardId(null);
  };

  // 一键纠错倒水
  const handleAutoFix = () => {
    sounds.playAutoArrange();
    if (suggestions.length > 0) {
      setGameState(prev => ({
        ...prev,
        front: [...suggestions[0].front],
        mid: [...suggestions[0].middle],
        back: [...suggestions[0].back]
      }));
    }
    setSelectedCardId(null);
  };

  // 墩位互换
  const handleSwapFrontMid = () => {
    sounds.playSwap();
    setGameState(prev => {
      const newFront = prev.mid.slice(0, 3);
      const newMid = [...prev.front, ...prev.mid.slice(3, 5)];
      return { ...prev, front: newFront, mid: newMid };
    });
  };

  const handleSwapMidBack = () => {
    sounds.playSwap();
    setGameState(prev => ({
      ...prev,
      mid: [...prev.back],
      back: [...prev.mid]
    }));
  };

  // 加载特殊牌型 (实验室)
  const handleLoadSpecial = (type: SpecialHandType) => {
    sounds.playAutoArrange();
    const newHand = sortCards(generateSpecialHand(type));
    const smart = getSuggestedArrangements(newHand);
    setGameState(prev => ({
      ...prev,
      playerHand: newHand,
      front: smart.length > 0 ? smart[0].front : newHand.slice(0, 3),
      mid: smart.length > 0 ? smart[0].middle : newHand.slice(3, 8),
      back: smart.length > 0 ? smart[0].back : newHand.slice(8, 13)
    }));
    setSelectedCardId(null);
    setShowdownResults(null);
  };

  // 牌力评估
  const fEval = evaluateHand(gameState.front, 'front');
  const mEval = evaluateHand(gameState.mid, 'middle');
  const bEval = evaluateHand(gameState.back, 'back');
  const isDaoShui = !isValidArrangement(gameState.front, gameState.mid, gameState.back) && !specialDetected;

  // 模拟开牌比牌与计分结算！
  const handleSimulateShowdown = () => {
    if (isDaoShui) {
      sounds.playError();
      return;
    }

    sounds.playCardFlip();
    const playerArrangement: PlayerArrangement = {
      front: gameState.front,
      middle: gameState.mid,
      back: gameState.back,
      specialHand: specialDetected,
      isValid: !isDaoShui,
      isDaoShui: isDaoShui
    };

    const playersData = [
      {
        id: 'player_user',
        name: '您 (试玩选手)',
        isAi: false,
        avatar: '👑',
        cards: gameState.playerHand,
        arrangement: playerArrangement
      },
      ...gameState.bots.map(b => ({
        id: b.id,
        name: b.name,
        isAi: true,
        avatar: b.avatar,
        cards: b.cards,
        arrangement: b.arrangement
      }))
    ];

    const results = calculate4PlayerMatchScores(playersData);
    setShowdownResults(results);

    const userRes = results.find(r => r.playerId === 'player_user');
    if (userRes && userRes.finalPoints > 0) {
      sounds.playVictory();
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.5 } });
    }
  };

  const userSimResult = showdownResults?.find(r => r.playerId === 'player_user');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
        
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-xl font-bold shadow-md">
              🎮
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-white">十三水自由试玩与规则教学中心</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  零积分门槛 · 纯模拟演练
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400">
                支持自由理牌、两牌互换、智能纠错、模拟 4 人比牌结算与逐墩计分公式拆解
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 px-4 sm:px-6 pt-3 pb-1 border-b border-slate-800/80 bg-slate-950/40 overflow-x-auto text-xs sm:text-sm font-bold">
          <button
            onClick={() => setActiveTab('sim_match')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'sim_match'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Swords className="w-4 h-4" />
            <span>模拟对战与比牌计分</span>
          </button>

          <button
            onClick={() => setActiveTab('rules_guide')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'rules_guide'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>操作说明与规则教学</span>
          </button>

          <button
            onClick={() => setActiveTab('special_lab')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'special_lab'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            <span>特殊牌型实验室</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* ========================================================
              TAB 1: 模拟对战与比牌计分
             ======================================================== */}
          {activeTab === 'sim_match' && (
            <div className="space-y-4 sm:space-y-5">
              
              {/* Top Quick Tip Bar */}
              <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-blue-500/20 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-blue-300 font-medium">
                  <Info className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>
                    <b>试玩说明</b>：本场为您匹配了 3 位虚拟电脑陪练。理好牌后点击下方<b>【模拟比牌 & 计分拆解】</b>，系统将全真模拟开牌比拼并逐一拆解水数算式！
                  </span>
                </div>
                <button
                  onClick={handleDealNewGame}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
                >
                  <Shuffle className="w-3.5 h-3.5 text-blue-400" />
                  <span>换一副牌</span>
                </button>
              </div>

              {/* Special hand banner if detected */}
              {specialDetected && (
                <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-between">
                  <span>
                    🌟 您的手牌构成特殊牌型：<b>{SPECIAL_HAND_CN[specialDetected].name}</b> (+{SPECIAL_HAND_CN[specialDetected].points}分) - {SPECIAL_HAND_CN[specialDetected].desc}
                  </span>
                </div>
              )}

              {/* Arrangement Table / Stage */}
              {!showdownResults ? (
                <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl">
                  {/* Status Banner */}
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-emerald-400" />
                        您的手牌摆布
                      </span>
                      {selectedCardId ? (
                        <span className="text-amber-300 font-bold animate-pulse text-[11px] bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded-full">
                          已选中 1 张牌，点击任意另一张直接对调
                        </span>
                      ) : isDaoShui ? (
                        <span className="text-rose-400 font-bold text-[11px] bg-rose-950/60 border border-rose-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          当前摆法倒水 (尾墩必须 &ge; 中墩 &ge; 头墩)
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-bold text-[11px] bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          牌型合规合法 (后 &ge; 中 &ge; 前)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={handleSwapFrontMid}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 transition active:scale-95"
                        title="交换前墩与中墩"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5 text-blue-400" /> 前中互换
                      </button>
                      <button
                        onClick={handleSwapMidBack}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 transition active:scale-95"
                        title="交换中墩与后墩"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" /> 中后互换
                      </button>
                      <button
                        onClick={handleChangePattern}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold flex items-center gap-1 transition active:scale-95"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> 变换方案 ({patternIndex + 1}/{suggestions.length || 1})
                      </button>
                      <button
                        onClick={handleAutoSuggest}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 text-xs font-bold flex items-center gap-1 transition active:scale-95"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> 智能理牌
                      </button>
                    </div>
                  </div>

                  {/* 3 Duns View */}
                  <div className="flex flex-col items-center gap-3.5 w-full">
                    {/* Front Dun (3 cards) */}
                    <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-2xl p-2.5 flex flex-col items-center gap-1.5">
                      <div className="w-full flex items-center justify-between px-2 text-xs">
                        <span className="font-bold text-slate-400">前墩 (头道 · 3张)</span>
                        <span className="font-black text-blue-400">
                          [{HAND_TYPE_CN[fEval.type]}] {fEval.description}
                          {fEval.bonusPoints ? ` (+${fEval.bonusPoints}水)` : ''}
                        </span>
                      </div>
                      <div className="flex gap-2 justify-center p-1">
                        {gameState.front.map((c, i) => (
                          <div
                            key={c.id}
                            className={`cursor-pointer transition-transform ${selectedCardId === c.id ? '-translate-y-2 ring-2 ring-amber-400 rounded-lg scale-105' : 'hover:-translate-y-1'}`}
                            onClick={() => handleCardClick('front', i)}
                          >
                            <CardView card={c} size="md" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mid Dun (5 cards) */}
                    <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-2xl p-2.5 flex flex-col items-center gap-1.5">
                      <div className="w-full flex items-center justify-between px-2 text-xs">
                        <span className="font-bold text-slate-400">中墩 (中道 · 5张)</span>
                        <span className="font-black text-indigo-400">
                          [{HAND_TYPE_CN[mEval.type]}] {mEval.description}
                          {mEval.bonusPoints ? ` (+${mEval.bonusPoints}水)` : ''}
                        </span>
                      </div>
                      <div className="flex gap-1.5 sm:gap-2 justify-center p-1 flex-wrap">
                        {gameState.mid.map((c, i) => (
                          <div
                            key={c.id}
                            className={`cursor-pointer transition-transform ${selectedCardId === c.id ? '-translate-y-2 ring-2 ring-amber-400 rounded-lg scale-105' : 'hover:-translate-y-1'}`}
                            onClick={() => handleCardClick('mid', i)}
                          >
                            <CardView card={c} size="md" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Back Dun (5 cards) */}
                    <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-2xl p-2.5 flex flex-col items-center gap-1.5">
                      <div className="w-full flex items-center justify-between px-2 text-xs">
                        <span className="font-bold text-slate-400">尾墩 (尾道 · 5张)</span>
                        <span className="font-black text-purple-400">
                          [{HAND_TYPE_CN[bEval.type]}] {bEval.description}
                          {bEval.bonusPoints ? ` (+${bEval.bonusPoints}水)` : ''}
                        </span>
                      </div>
                      <div className="flex gap-1.5 sm:gap-2 justify-center p-1 flex-wrap">
                        {gameState.back.map((c, i) => (
                          <div
                            key={c.id}
                            className={`cursor-pointer transition-transform ${selectedCardId === c.id ? '-translate-y-2 ring-2 ring-amber-400 rounded-lg scale-105' : 'hover:-translate-y-1'}`}
                            onClick={() => handleCardClick('back', i)}
                          >
                            <CardView card={c} size="md" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Primary Trigger Button */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                    {isDaoShui ? (
                      <button
                        onClick={handleAutoFix}
                        className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-900/90 via-amber-900/80 to-rose-900/90 border-2 border-rose-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer animate-pulse"
                      >
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                        <span>当前倒水，点击一键纠正</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleSimulateShowdown}
                        className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/60 transition active:scale-95 cursor-pointer"
                      >
                        <Play className="w-5 h-5 fill-current" />
                        <span>模拟比牌 & 计分拆解教学</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* ========================================================
                   SHOWDOWN & DETAILED SCORING EXPLANATION VIEW
                   ======================================================== */
                <div className="space-y-5 animate-in fade-in">
                  {/* Results Top Banner */}
                  <div className={`rounded-3xl p-4 sm:p-5 border flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl ${
                    (userSimResult?.finalPoints || 0) >= 0
                      ? 'bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/80 border-emerald-500/40 text-emerald-200'
                      : 'bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950/80 border-rose-500/40 text-rose-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-900/80 border border-slate-700 flex items-center justify-center text-2xl">
                        {(userSimResult?.finalPoints || 0) >= 0 ? '🏆' : '💔'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-400">试玩模拟结算结果</div>
                        <div className="text-xl sm:text-2xl font-black">
                          您本局最终净胜: {(userSimResult?.finalPoints || 0) >= 0 ? `+${userSimResult?.finalPoints}` : userSimResult?.finalPoints} 水
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setShowdownResults(null)}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4 text-amber-400" />
                        <span>调整摆法重比</span>
                      </button>
                      <button
                        onClick={handleDealNewGame}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md"
                      >
                        <Shuffle className="w-4 h-4" />
                        <span>下一副新手牌</span>
                      </button>
                    </div>
                  </div>

                  {/* 4 Players Showdown Board */}
                  <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        4 家完整牌型比拼总览
                      </span>
                      <span className="text-slate-400 text-[11px]">前墩 (3张) / 中墩 (5张) / 尾墩 (5张)</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {showdownResults.map(p => {
                        const isUser = p.playerId === 'player_user';
                        return (
                          <div
                            key={p.playerId}
                            className={`rounded-2xl p-3.5 border flex flex-col gap-2 ${
                              isUser
                                ? 'bg-amber-950/20 border-amber-500/50'
                                : 'bg-slate-900/60 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{p.avatar}</span>
                                <span className={`text-xs font-black ${isUser ? 'text-amber-300' : 'text-slate-200'}`}>
                                  {p.name}
                                </span>
                              </div>
                              <span className={`font-mono text-xs font-black px-2 py-0.5 rounded-full border ${
                                p.finalPoints >= 0
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              }`}>
                                {p.finalPoints >= 0 ? `+${p.finalPoints}` : p.finalPoints} 水
                              </span>
                            </div>

                            <div className="space-y-1.5 text-[11px]">
                              <div className="flex items-center justify-between bg-slate-950/50 px-2 py-1 rounded-lg">
                                <span className="text-slate-400">前: [{HAND_TYPE_CN[p.frontScore.type]}] {p.frontScore.description}</span>
                                {p.frontScore.bonusPoints ? <span className="text-amber-400 font-bold">+{p.frontScore.bonusPoints}喜分</span> : null}
                              </div>
                              <div className="flex items-center justify-between bg-slate-950/50 px-2 py-1 rounded-lg">
                                <span className="text-slate-400">中: [{HAND_TYPE_CN[p.midScore.type]}] {p.midScore.description}</span>
                                {p.midScore.bonusPoints ? <span className="text-amber-400 font-bold">+{p.midScore.bonusPoints}喜分</span> : null}
                              </div>
                              <div className="flex items-center justify-between bg-slate-950/50 px-2 py-1 rounded-lg">
                                <span className="text-slate-400">尾: [{HAND_TYPE_CN[p.backScore.type]}] {p.backScore.description}</span>
                                {p.backScore.bonusPoints ? <span className="text-amber-400 font-bold">+{p.backScore.bonusPoints}喜分</span> : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Core Educational Breakdown: 逐家对决与计分拆解推导 */}
                  {userSimResult && (
                    <div className="bg-slate-950/90 border border-indigo-500/30 rounded-3xl p-4 sm:p-5 space-y-4 shadow-xl">
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-sm sm:text-base text-indigo-300 flex items-center gap-2">
                          <Zap className="w-4 h-4 text-indigo-400" />
                          计分推导教学：您与各家对手的水数详细算式
                        </h4>
                        <span className="text-[11px] text-slate-400">
                          十三水核心公式: 基础水数 (+打枪翻倍) + 喜分奖励
                        </span>
                      </div>

                      <div className="space-y-3">
                        {showdownResults
                          .filter(r => r.playerId !== 'player_user')
                          .map(bot => {
                            const vsInfo = userSimResult.dunScores[bot.playerId];
                            if (!vsInfo) return null;

                            const fWinText = vsInfo.front > 0 ? '胜 (+1水)' : vsInfo.front < 0 ? '负 (-1水)' : '平 (0水)';
                            const mWinText = vsInfo.mid > 0 ? '胜 (+1水)' : vsInfo.mid < 0 ? '负 (-1水)' : '平 (0水)';
                            const bWinText = vsInfo.back > 0 ? '胜 (+1水)' : vsInfo.back < 0 ? '负 (-1水)' : '平 (0水)';
                            const baseDunSum = vsInfo.front + vsInfo.mid + vsInfo.back;

                            return (
                              <div
                                key={bot.playerId}
                                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-2.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                                    <span>{bot.avatar}</span>
                                    <span>对战 【{bot.name}】</span>
                                    {vsInfo.isGun && (
                                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                        💥 触发打枪 (翻倍)
                                      </span>
                                    )}
                                  </span>

                                  <span className={`text-xs font-mono font-black px-2 py-0.5 rounded-full border ${
                                    vsInfo.total >= 0
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                  }`}>
                                    小计: {vsInfo.total >= 0 ? `+${vsInfo.total}` : vsInfo.total} 水
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                  <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                                    <span className="text-slate-400 block text-[10px]">前墩对决:</span>
                                    <span className={vsInfo.front >= 0 ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>
                                      {fWinText}
                                    </span>
                                    {vsInfo.frontBonus !== 0 && (
                                      <span className="text-[10px] text-amber-400 block">喜分: {vsInfo.frontBonus > 0 ? `+${vsInfo.frontBonus}` : vsInfo.frontBonus}</span>
                                    )}
                                  </div>

                                  <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                                    <span className="text-slate-400 block text-[10px]">中墩对决:</span>
                                    <span className={vsInfo.mid >= 0 ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>
                                      {mWinText}
                                    </span>
                                    {vsInfo.midBonus !== 0 && (
                                      <span className="text-[10px] text-amber-400 block">喜分: {vsInfo.midBonus > 0 ? `+${vsInfo.midBonus}` : vsInfo.midBonus}</span>
                                    )}
                                  </div>

                                  <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                                    <span className="text-slate-400 block text-[10px]">尾墩对决:</span>
                                    <span className={vsInfo.back >= 0 ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>
                                      {bWinText}
                                    </span>
                                    {vsInfo.backBonus !== 0 && (
                                      <span className="text-[10px] text-amber-400 block">喜分: {vsInfo.backBonus > 0 ? `+${vsInfo.backBonus}` : vsInfo.backBonus}</span>
                                    )}
                                  </div>
                                </div>

                                {/* Step-by-step formula */}
                                <div className="text-[11px] text-slate-300 bg-slate-950/40 px-3 py-1.5 rounded-xl font-mono">
                                  <span>算式拆解: </span>
                                  <span>
                                    三墩基础 ({baseDunSum >= 0 ? `+${baseDunSum}` : baseDunSum})
                                    {vsInfo.isGun ? ` × 2(打枪翻倍)` : ''}
                                    {vsInfo.frontBonus + vsInfo.midBonus + vsInfo.backBonus !== 0
                                      ? ` + 喜分(${vsInfo.frontBonus + vsInfo.midBonus + vsInfo.backBonus})`
                                      : ''}
                                    {' '}={' '}
                                    <b className={vsInfo.total >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                      {vsInfo.total >= 0 ? `+${vsInfo.total}` : vsInfo.total} 水
                                    </b>
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl text-xs text-indigo-200">
                        💡 <b>总结</b>：您的本局总水数 (
                        <span className="font-mono font-bold text-amber-300">
                          {(userSimResult.finalPoints >= 0 ? `+${userSimResult.finalPoints}` : userSimResult.finalPoints)} 水
                        </span>
                        ) 等于对 3 家对手的小计之和。掌握了头、中、尾三墩合理分配与喜分打法，就能在实战牌局中大获全胜！
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              TAB 2: 操作说明与规则教学
             ======================================================== */}
          {activeTab === 'rules_guide' && (
            <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
              {/* Card 1: 核心操作说明 */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h4 className="font-black text-amber-400 text-sm sm:text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  十三水操作指南与快捷手势
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <span className="font-bold text-white block mb-1">👆 点选两张牌直接对调</span>
                    <span className="text-slate-400 text-xs">
                      在头墩、中墩、尾墩中，点击第一张选中的牌（牌面上浮），再点击任意第二张牌，两张牌即可瞬间互换位置。
                    </span>
                  </div>

                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <span className="font-bold text-white block mb-1">✨ 智能理牌与变换牌型</span>
                    <span className="text-slate-400 text-xs">
                      点击“智能理牌”系统会自动根据您的手牌计算最大收益的不倒水组合；点击“变换方案”可在多种策略之间来回切换。
                    </span>
                  </div>

                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <span className="font-bold text-white block mb-1">🛡️ 一键纠正倒水防线</span>
                    <span className="text-slate-400 text-xs">
                      如果您手动调牌导致头墩大过中墩或中墩大过尾墩，系统会自动亮起红色的“一键纠正倒水”按钮，点击即可秒级恢复合规方案。
                    </span>
                  </div>

                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <span className="font-bold text-white block mb-1">↕️ 前中互换 / 中后互换</span>
                    <span className="text-slate-400 text-xs">
                      快捷将前墩 3 张牌与中墩前 3 张对调，或将中墩 5 张与尾墩 5 张整体对调，方便探索不同打法。
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: 牌型大小排序 */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h4 className="font-black text-emerald-400 text-sm sm:text-base flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-emerald-400" />
                  牌型大小天梯 (从大到小)
                </h4>
                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="font-bold text-amber-300">
                    五条 (88888) &gt; 同花顺 (♠AKQJ10) &gt; 铁支/四条 (7777x) &gt; 葫芦/三带二 (KKK88) &gt; 同花 (五张同花色) &gt; 顺子 (87654) &gt; 三条 (999) &gt; 两对 (AAKK) &gt; 对子 (QQ) &gt; 乌龙/高牌
                  </div>
                  <div className="text-slate-400 leading-relaxed text-[11px]">
                    * 注：前墩只有 3 张牌，最大的普通牌型为<b>三条（冲三）</b>，不能组成顺子或同花（3张同花仍按乌龙或对子计算牌力）。
                  </div>
                </div>
              </div>

              {/* Card 3: 墩位喜分对照表 */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h4 className="font-black text-blue-400 text-sm sm:text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  墩位喜分奖励对照表 (额外加水)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2 px-3">墩位</th>
                        <th className="py-2 px-3">奖励牌型</th>
                        <th className="py-2 px-3">奖励水数</th>
                        <th className="py-2 px-3">说明</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      <tr>
                        <td className="py-2 px-3 text-blue-300 font-bold">头墩 (3张)</td>
                        <td className="py-2 px-3">冲三 (三条)</td>
                        <td className="py-2 px-3 text-amber-400 font-bold">+3 水</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">头墩拿到三条时获得额外 3 水奖励</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-indigo-300 font-bold" rowSpan={4}>中墩 (5张)</td>
                        <td className="py-2 px-3">中墩葫芦</td>
                        <td className="py-2 px-3 text-amber-400 font-bold">+2 水</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">中墩放葫芦奖励 2 水</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3">中墩铁支 (四条)</td>
                        <td className="py-2 px-3 text-amber-400 font-bold">+8 水</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">中墩放四条奖励 8 水</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3">中墩同花顺</td>
                        <td className="py-2 px-3 text-amber-400 font-bold">+10 水</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">中墩放同花顺奖励 10 水</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3">中墩五条</td>
                        <td className="py-2 px-3 text-amber-400 font-bold">+16 水</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">中墩放五条奖励 16 水</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-purple-300 font-bold" rowSpan={3}>尾墩 (5张)</td>
                        <td className="py-2 px-3">尾墩铁支 (四条)</td>
                        <td className="py-2 px-3 text-amber-400 font-bold">+4 水</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">尾墩放四条奖励 4 水</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3">尾墩同花顺</td>
                        <td className="py-2 px-3 text-amber-400 font-bold">+5 水</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">尾墩放同花顺奖励 5 水</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3">尾墩五条</td>
                        <td className="py-2 px-3 text-amber-400 font-bold">+8 水</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">尾墩放五条奖励 8 水</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Card 4: 打枪与全垒打 */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h4 className="font-black text-rose-400 text-sm sm:text-base flex items-center gap-2">
                  <Swords className="w-4 h-4 text-rose-400" />
                  打枪与全垒打翻倍机制
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-1">
                    <span className="font-bold text-amber-300 block">💥 打枪 (单家全胜)</span>
                    <p className="text-slate-400 leading-relaxed">
                      若您的前墩、中墩、尾墩<b>全部胜过某一对手</b>（3墩皆胜），即可对该对手实施“打枪”，基础输赢水数翻倍（×2）。
                    </p>
                  </div>

                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-1">
                    <span className="font-bold text-amber-300 block">👑 全垒打 (全场通吃)</span>
                    <p className="text-slate-400 leading-relaxed">
                      若某玩家在场上对<b>所有其他对手全部打枪</b>，则触发至尊“全垒打”，所有战果在打枪翻倍的基础上再次翻倍（×4）！
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 3: 特殊牌型实验室
             ======================================================== */}
          {activeTab === 'special_lab' && (
            <div className="space-y-4">
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-400 flex items-center gap-1.5">
                    <Wand2 className="w-4 h-4" /> 点击快速生成特殊牌型手牌体验:
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      'Eight of a Kind',
                      'Seven of a Kind',
                      'Six of a Kind',
                      'Supreme Dragon',
                      'Dragon',
                      'Twelve Royals',
                      'Three Quads',
                      'Same Color',
                      'Six Pairs',
                      'Three Flushes'
                    ] as SpecialHandType[]
                  ).map(type => (
                    <button
                      key={type}
                      onClick={() => {
                        handleLoadSpecial(type);
                        setActiveTab('sim_match');
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-bold transition cursor-pointer"
                    >
                      ✨ {SPECIAL_HAND_CN[type].name} (+{SPECIAL_HAND_CN[type].points}水)
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 space-y-2">
                <span className="font-bold text-slate-300 block">💡 什么是特殊牌型？</span>
                <p>
                  特殊牌型（如至尊青龙、一条龙、十二皇族、三同花等）是在发完 13 张手牌后由牌型形态直接触发的至高荣誉。拥有特殊牌型的玩家无需进行常规的前中尾三墩比牌，直接向场上其他玩家收取丰厚的水数奖励！
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            试玩模式全流程免费开放，不会变动任何账户真实积分。
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition cursor-pointer"
          >
            退出试玩
          </button>
        </div>
      </div>
    </div>
  );
}

