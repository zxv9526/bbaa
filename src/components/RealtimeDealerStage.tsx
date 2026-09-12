import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, Suit, Rank } from '../types';
import { createDeck, createDoubleDeck, shuffle, cutDeck } from '../gameLogic';
import { sounds } from '../sound';
import { triggerHaptic } from '../lib/haptics';
import {
  Sparkles,
  Scissors,
  Play,
  RotateCcw,
  Users,
  Crown,
  ChevronRight,
  ShieldCheck,
  UserPlus,
  UserMinus,
  FastForward,
  Volume2
} from 'lucide-react';

export interface RealtimeSeatPlayer {
  id: string;
  name: string;
  avatar: string;
  isAi: boolean;
  score: number;
}

interface RealtimeDealerStageProps {
  round: number;
  dealerIndex: number;
  players: RealtimeSeatPlayer[];
  currentUserId: string;
  onAddPlayer: () => void;
  onRemovePlayer: () => void;
  onStartDeal: (dealtHands: { [playerId: string]: Card[] }, dealerIndex: number) => void;
  onBackToMenu: () => void;
}

export function RealtimeDealerStage({
  round,
  dealerIndex,
  players,
  currentUserId,
  onAddPlayer,
  onRemovePlayer,
  onStartDeal,
  onBackToMenu
}: RealtimeDealerStageProps) {
  const seatedCount = players.length;
  const currentDealer = players[dealerIndex] || players[0];
  const isHumanDealer = currentDealer?.id === currentUserId;

  // Shuffle & Cut interactive states
  const [deck, setDeck] = useState<Card[]>(() => {
    return seatedCount <= 4 ? createDeck() : createDoubleDeck();
  });
  const [shuffleCount, setShuffleCount] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isCutting, setIsCutting] = useState(false);
  const [cutSliderPos, setCutSliderPos] = useState(50); // percentage 15..85
  const [cutCard, setCutCard] = useState<Card | null>(null);
  const [isDealing, setIsDealing] = useState(false);
  const [dealerStep, setDealerStep] = useState<'idle' | 'shuffling' | 'cutting' | 'dealing'>('idle');

  const animationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep deck size matching seated player count (<=4 -> 52 cards, >4 -> 104 cards)
  useEffect(() => {
    const raw = seatedCount <= 4 ? createDeck() : createDoubleDeck();
    setDeck(raw);
    setShuffleCount(0);
    setCutCard(null);
  }, [seatedCount]);

  // Seated Player Dealer routine when other player is dealer
  useEffect(() => {
    if (!isHumanDealer && seatedCount >= 2) {
      setDealerStep('shuffling');
      setIsShuffling(true);
      sounds.playShuffle();
      triggerHaptic('medium');

      const timer1 = setTimeout(() => {
        setIsShuffling(false);
        setShuffleCount(1);
        setDealerStep('cutting');
        setIsCutting(true);
        sounds.playCut();
        triggerHaptic('heavy');

        const cutIdx = Math.floor(deck.length * (0.35 + Math.random() * 0.3));
        const { deck: cutResult, cutCard: cCard } = cutDeck(shuffle(deck), cutIdx);
        setDeck(cutResult);
        setCutCard(cCard);

        const timer2 = setTimeout(() => {
          setIsCutting(false);
          setDealerStep('dealing');
          setIsDealing(true);
          sounds.playDealSequence(seatedCount);

          const timer3 = setTimeout(() => {
            executeFinalDeal(cutResult);
          }, 900);
          animationTimerRef.current = timer3;
        }, 800);
        animationTimerRef.current = timer2;
      }, 1300);
      animationTimerRef.current = timer1;
    }

    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
    };
  }, [dealerIndex, isHumanDealer, seatedCount]);

  // Manual Shuffle Trigger
  const handleManualShuffle = () => {
    if (isShuffling || isDealing) return;
    setIsShuffling(true);
    sounds.playShuffle();
    triggerHaptic('medium');

    setTimeout(() => {
      const newShuffled = shuffle(deck);
      setDeck(newShuffled);
      setShuffleCount((prev) => prev + 1);
      setIsShuffling(false);
    }, 700);
  };

  // Manual Cut Trigger
  const handleManualCut = () => {
    if (isCutting || isDealing) return;
    setIsCutting(true);
    sounds.playCut();
    triggerHaptic('heavy');

    const cutIndex = Math.floor((deck.length * cutSliderPos) / 100);
    const { deck: cutResult, cutCard: revealedCutCard } = cutDeck(deck, cutIndex);

    setTimeout(() => {
      setDeck(cutResult);
      setCutCard(revealedCutCard);
      setIsCutting(false);
    }, 550);
  };

  // Deal Distribution to Seated Players
  const executeFinalDeal = (currentDeckToUse: Card[]) => {
    const hands: { [playerId: string]: Card[] } = {};
    let deckCopy = [...currentDeckToUse];

    // If deck was never shuffled, shuffle it now for game safety
    if (shuffleCount === 0) {
      deckCopy = shuffle(deckCopy);
    }

    // Give exactly 13 cards to each seated player
    players.forEach((p, idx) => {
      const startIdx = idx * 13;
      hands[p.id] = deckCopy.slice(startIdx, startIdx + 13);
    });

    onStartDeal(hands, dealerIndex);
  };

  const handleManualDeal = () => {
    if (seatedCount < 2 || isDealing) return;
    setIsDealing(true);
    sounds.playDealSequence(seatedCount);
    triggerHaptic('heavy');

    setTimeout(() => {
      executeFinalDeal(deck);
    }, 850);
  };

  const handleSkipAiAnimation = () => {
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
    }
    const finalShuffled = shuffle(deck);
    executeFinalDeal(finalShuffled);
  };

  const getSuitSymbol = (suit: Suit) => {
    switch (suit) {
      case 'S': return '♠';
      case 'H': return '♥';
      case 'C': return '♣';
      case 'D': return '♦';
    }
  };

  const getSuitColor = (suit: Suit) => {
    return suit === 'H' || suit === 'D' ? 'text-red-500' : 'text-slate-900';
  };

  const getRankDisplay = (rank: Rank) => {
    switch (rank) {
      case 14: return 'A';
      case 13: return 'K';
      case 12: return 'Q';
      case 11: return 'J';
      default: return rank.toString();
    }
  };

  const renderDeckAnimation = () => (
    <div className="relative w-48 h-32 sm:w-64 sm:h-40 flex items-center justify-center my-2 sm:my-4" style={{ perspective: 1000 }}>
      <AnimatePresence>
        {!isDealing && (
          <>
            {/* Left Packet (During Shuffle / Base Deck) */}
            <motion.div
              className="absolute w-20 h-28 sm:w-24 sm:h-32 rounded-xl bg-gradient-to-br from-blue-900 to-slate-900 border border-amber-500/50 shadow-[0_0_15px_rgba(0,0,0,0.5)] flex items-center justify-center text-2xl z-10"
              initial={false}
              animate={
                isShuffling
                  ? { x: -45, rotateZ: -12, rotateY: 15, z: 10 }
                  : isCutting
                  ? { x: -30, y: 15, rotateZ: -3 }
                  : { x: 0, y: 0, rotateZ: 0, rotateY: 0, z: 0 }
              }
              transition={{ type: "spring", stiffness: 220, damping: 20 }}
            >
              <div className="w-full h-full rounded-lg border border-white/10 flex items-center justify-center text-white/30 text-xl font-bold bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')]">
                🀄
              </div>
            </motion.div>

            {/* Right Packet (During Shuffle / Cut Top Packet) */}
            <motion.div
              className="absolute w-20 h-28 sm:w-24 sm:h-32 rounded-xl bg-gradient-to-br from-red-900 to-slate-900 border border-amber-500/50 shadow-[0_0_20px_rgba(0,0,0,0.6)] flex items-center justify-center text-2xl z-20"
              initial={false}
              animate={
                isShuffling
                  ? { x: 45, rotateZ: 12, rotateY: -15, z: 10 }
                  : isCutting
                  ? { x: 40, y: -25, rotateZ: 4, z: 25 }
                  : { x: 0, y: -3, rotateZ: 1, rotateY: 0, z: 2 }
              }
              transition={{ type: "spring", stiffness: 220, damping: 20 }}
            >
              <div className="w-full h-full rounded-lg border border-white/10 flex items-center justify-center text-white/30 text-xl font-bold bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')]">
                🀄
              </div>
            </motion.div>
            
            {/* Cascade Riffle Effect Overlay (Only visible during shuffling) */}
            {isShuffling && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-16 h-24 sm:w-20 sm:h-28 bg-slate-200 border border-slate-400 rounded-lg shadow-sm"
                    initial={{ y: -50, x: i % 2 === 0 ? -25 : 25, rotateZ: i % 2 === 0 ? -15 : 15, opacity: 0 }}
                    animate={{ y: 0, x: 0, rotateZ: (Math.random() - 0.5) * 8, opacity: 1 }}
                    transition={{ delay: i * 0.04, duration: 0.15 }}
                  />
                ))}
              </motion.div>
            )}

            {/* Revealed Cut Card (If Cut) */}
            {cutCard && !isShuffling && (
              <motion.div
                className="absolute z-40 w-16 h-22 sm:w-20 sm:h-28 bg-white rounded-lg border-2 border-amber-400 shadow-2xl p-1.5 flex flex-col justify-between"
                initial={{ scale: 0, y: -60, rotateY: -180, opacity: 0 }}
                animate={{ scale: 1, y: 0, rotateY: 0, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.15 }}
              >
                <div className={`text-xs font-black ${getSuitColor(cutCard.suit)}`}>
                  {getRankDisplay(cutCard.rank)}
                  {getSuitSymbol(cutCard.suit)}
                </div>
                <div className={`text-2xl text-center font-bold ${getSuitColor(cutCard.suit)}`}>
                  {getSuitSymbol(cutCard.suit)}
                </div>
                <div className={`text-xs font-black text-right rotate-180 ${getSuitColor(cutCard.suit)}`}>
                  {getRankDisplay(cutCard.rank)}
                  {getSuitSymbol(cutCard.suit)}
                </div>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      {/* Flying Cards Animation During Dealing */}
      <AnimatePresence>
        {isDealing && (
          <motion.div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
            {[...Array(13)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-12 h-16 bg-gradient-to-br from-blue-700 to-indigo-900 border border-amber-300 rounded shadow-xl"
                initial={{ scale: 1, x: 0, y: 0, opacity: 1 }}
                animate={{ 
                  scale: 0.6, 
                  x: (Math.random() - 0.5) * 350, 
                  y: (Math.random() - 0.5) * 350, 
                  opacity: 0,
                  rotateZ: (Math.random() - 0.5) * 720
                }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: "easeOut" }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center justify-center gap-2 py-1 px-2 sm:px-4 animate-in fade-in duration-300">
      
      {/* 1. Header Bar: Match Mode & Dealer Rotation Info */}
      <div className="w-full bg-slate-900/90 border border-amber-500/30 rounded-2xl p-2 sm:p-3 backdrop-blur-md shadow-xl flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-red-600 flex items-center justify-center text-xl font-black shadow-md text-slate-950">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                实时对战场 · 轮流发牌模式
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black">
                第 {round} 局
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              本场不使用预存牌局 · 真实洗牌切牌 · 庄家轮流做东
            </p>
          </div>
        </div>

        {/* Current Dealer Tag */}
        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-950/80 to-slate-900 border border-amber-400/50 flex items-center gap-2 text-xs font-bold text-amber-300 shadow-inner">
            <Crown className="w-4 h-4 text-amber-400 animate-bounce" />
            <span>
              本局庄家: <strong className="text-white">{currentDealer?.name}</strong> ({dealerIndex + 1}号位)
            </span>
          </div>

          <button
            onClick={onBackToMenu}
            className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            返回大厅
          </button>
        </div>
      </div>

      {/* 2. Seated Players Live Roster (2 - 8 Seats) */}
      <div className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-400" />
            <span>当前牌桌席位 ({seatedCount}/8)</span>
            <span className={seatedCount >= 2 ? 'text-emerald-400' : 'text-rose-400 font-bold'}>
              {seatedCount >= 2 ? '• 满足开局条件 (≥2人)' : '• ⚠️ 至少需2人才能发牌'}
            </span>
          </div>

          {/* Add / Remove Player Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={onRemovePlayer}
              disabled={seatedCount <= 2}
              className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition cursor-pointer"
              title="减少一名席位玩家 (最少保留2人)"
            >
              <UserMinus className="w-3.5 h-3.5" />
              <span>减席</span>
            </button>
            <button
              onClick={onAddPlayer}
              disabled={seatedCount >= 8}
              className="px-2.5 py-1 rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition cursor-pointer"
              title="邀请/匹配真实玩家入座 (最多8人)"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>邀请/匹配牌友</span>
            </button>
          </div>
        </div>

        {/* Seated Avatars Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {players.map((p, idx) => {
            const isThisDealer = idx === dealerIndex;
            const isMe = p.id === currentUserId;

            return (
              <div
                key={p.id}
                className={`relative flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                  isThisDealer
                    ? 'bg-amber-950/40 border-amber-500 shadow-md shadow-amber-500/10'
                    : isMe
                    ? 'bg-blue-950/40 border-blue-500/60'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                {/* Dealer Crown Badge */}
                {isThisDealer && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full shadow flex items-center gap-0.5 z-10 whitespace-nowrap">
                    👑 庄家
                  </span>
                )}

                <div className="text-2xl mt-0.5">{p.avatar}</div>
                <div className="text-[11px] font-bold text-white mt-1 max-w-[70px] truncate text-center">
                  {p.name}
                </div>
                <div className="text-[10px] text-slate-400">
                  {idx + 1}号位
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Interactive Felt Table Center Stage */}
      <div className="w-full relative min-h-[260px] sm:min-h-[300px] flex-1 bg-gradient-to-b from-emerald-950 via-slate-900 to-emerald-950 border-2 border-emerald-700/50 rounded-3xl p-3 sm:p-5 flex flex-col items-center justify-center shadow-2xl overflow-hidden shrink-0">
        {/* Table Felt Decorative Oval */}
        <div className="absolute inset-4 rounded-2xl border border-emerald-600/20 pointer-events-none" />
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-32 bg-emerald-500/5 blur-3xl pointer-events-none" />

        {/* CASE A: Insufficient Players (<2) */}
        {seatedCount < 2 ? (
          <div className="flex flex-col items-center text-center gap-2 z-10 animate-fade-in">
            <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-2xl">
              👥
            </div>
            <h3 className="text-base font-black text-rose-300">
              至少需要 2 位玩家就座才能发牌
            </h3>
            <p className="text-xs text-slate-400 max-w-sm">
              当前牌桌仅有 1 位玩家。请点击下方“匹配牌友”入座后由庄家开始洗牌切牌。
            </p>
            <button
              onClick={onAddPlayer}
              className="mt-1 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-blue-600/30 flex items-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>匹配真实牌友 (立即入座)</span>
            </button>
          </div>
        ) : isHumanDealer ? (
          /* CASE B: Human Player is Dealer -> Full Interactive Controls */
          <div className="w-full flex flex-col items-center justify-center gap-3 z-10 animate-fade-in">
            
            {/* Dealer Prompt */}
            <div className="flex flex-col items-center text-center">
              <span className="text-xs font-black px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                你是本局庄家，享有洗牌与切牌特权！
              </span>
              <p className="text-xs text-slate-300 mt-1">
                点击洗牌打乱牌序，滑动切牌确定切分点，完成后点击“立即发牌”。
              </p>
            </div>

            {renderDeckAnimation()}

            {/* Cut Slider Control */}
            <div className="w-full max-w-sm bg-slate-900/80 border border-slate-700/60 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1 text-amber-300">
                  <Scissors className="w-3.5 h-3.5" />
                  <span>切牌深度: {cutSliderPos}%</span>
                </span>
                <span className="text-slate-400 text-[11px]">
                  (第 {Math.floor((deck.length * cutSliderPos) / 100)} 张处分牌)
                </span>
              </div>
              <input
                type="range"
                min="15"
                max="85"
                value={cutSliderPos}
                onChange={(e) => setCutSliderPos(parseInt(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
                disabled={isShuffling || isCutting || isDealing}
              />
            </div>

            {/* Interactive Action Buttons */}
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center">
              <button
                id="btn-shuffle-deck"
                onClick={handleManualShuffle}
                disabled={isShuffling || isDealing}
                className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-amber-500/40 text-amber-300 hover:text-white font-bold text-sm flex items-center gap-2 shadow-lg transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className={`w-4 h-4 ${isShuffling ? 'animate-spin text-amber-400' : ''}`} />
                <span>{shuffleCount > 0 ? `再次洗牌 (${shuffleCount}次)` : '拟真洗牌'}</span>
              </button>

              <button
                id="btn-cut-deck"
                onClick={handleManualCut}
                disabled={isShuffling || isCutting || isDealing}
                className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-blue-500/40 text-blue-300 hover:text-white font-bold text-sm flex items-center gap-2 shadow-lg transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Scissors className="w-4 h-4 text-blue-400" />
                <span>{cutCard ? '重新切牌' : '立即切牌'}</span>
              </button>

              <button
                id="btn-deal-cards"
                onClick={handleManualDeal}
                disabled={isShuffling || isCutting || isDealing}
                className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-base shadow-xl shadow-orange-600/30 flex items-center gap-2.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-slate-950" />
                <span>{isDealing ? '正在发牌...' : '立即发牌'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* CASE C: Another Seated Player is Dealer -> Visual Broadcast Routine */
          <div className="flex flex-col items-center text-center gap-4 z-10 animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border-2 border-amber-400 text-3xl flex items-center justify-center shadow-lg animate-pulse">
              {currentDealer?.avatar}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2 text-amber-300 text-sm font-black">
                <Crown className="w-4 h-4" />
                <span>庄家【{currentDealer?.name}】正在洗牌发牌</span>
              </div>
              <p className="text-xs text-slate-300">
                {dealerStep === 'shuffling' && '🎴 庄家正在进行交错对洗...'}
                {dealerStep === 'cutting' && '✂️ 庄家正在切牌分叠并验牌...'}
                {dealerStep === 'dealing' && '🚀 正在将13张手牌分发给在座全员...'}
                {dealerStep === 'idle' && '准备就绪，即将开局...'}
              </p>
            </div>

            {renderDeckAnimation()}

            {/* Skip Animation Button */}
            <button
              onClick={handleSkipAiAnimation}
              className="px-5 py-2.5 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow"
            >
              <FastForward className="w-3.5 h-3.5 text-amber-400" />
              <span>跳过动画 · 直接理牌</span>
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
