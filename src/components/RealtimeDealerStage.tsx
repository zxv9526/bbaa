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
  Radio,
  ExternalLink,
  Volume2
} from 'lucide-react';

import { TableTacticalChatBar } from './TableTacticalChatBar';
import { ChatMessage } from '../types';
import { CardView } from './CardView';

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
  onAddPlayer?: () => void;
  onRemovePlayer?: () => void;
  onStartDeal: (dealtHands: { [playerId: string]: Card[] }, dealerIndex: number) => void;
  onBackToMenu: () => void;
  onSendMessage?: (type: 'text' | 'voice' | 'quick' | 'emoji', content: string, audioUrl?: string, audioDuration?: number) => void;
  onOpenFullChat?: () => void;
  ttsEnabled?: boolean;
  onToggleTts?: () => void;
  latestMessage?: ChatMessage | null;
  onUserSpeakingChange?: (speaking: boolean) => void;
  syncedShuffleCount?: number;
  syncedCutPos?: number;
  syncedCutCard?: Card | null;
  syncedIsDealing?: boolean;
  onDealerShuffle?: (count: number) => void;
  onDealerCut?: (pos: number, card: Card) => void;
  onDealerDeal?: (dealtHands: { [playerId: string]: Card[] }, dealerIndex: number) => void;
  onRotateDealer?: (newDealerIndex: number) => void;
  unreadCount?: number;
}

export function RealtimeDealerStage({
  round,
  dealerIndex,
  players,
  currentUserId,
  onAddPlayer,
  onRemovePlayer,
  onStartDeal,
  onBackToMenu,
  onSendMessage,
  onOpenFullChat,
  ttsEnabled = true,
  onToggleTts,
  latestMessage = null,
  onUserSpeakingChange,
  syncedShuffleCount,
  syncedCutPos,
  syncedCutCard,
  syncedIsDealing,
  onDealerShuffle,
  onDealerCut,
  onDealerDeal,
  onRotateDealer,
  unreadCount = 0
}: RealtimeDealerStageProps) {
  const seatedCount = players.length;
  const currentDealer = players[dealerIndex] || players[0];
  const isHumanDealer = Boolean(currentDealer && currentUserId && currentDealer.id === currentUserId);
  const mySeatIndex = players.findIndex(p => p.id === currentUserId);

  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);

  useEffect(() => {
    if (latestMessage && Date.now() - latestMessage.timestamp < 5000) {
      setActiveSpeakerId(latestMessage.senderId);
      const timer = setTimeout(() => setActiveSpeakerId(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [latestMessage]);

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

  // Sync external dealer actions if another real human player is the dealer
  useEffect(() => {
    if (!isHumanDealer && syncedShuffleCount !== undefined && syncedShuffleCount > 0) {
      setShuffleCount(syncedShuffleCount);
      setDealerStep('shuffling');
      setIsShuffling(true);
      sounds.playShuffle();
      triggerHaptic('medium');
      const timer = setTimeout(() => {
        setIsShuffling(false);
        setDealerStep('idle');
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [syncedShuffleCount, isHumanDealer]);

  useEffect(() => {
    if (!isHumanDealer && syncedCutCard) {
      setCutCard(syncedCutCard);
      if (syncedCutPos !== undefined) {
        setCutSliderPos(syncedCutPos);
      }
      setDealerStep('cutting');
      setIsCutting(true);
      sounds.playCut();
      triggerHaptic('heavy');
      const timer = setTimeout(() => {
        setIsCutting(false);
        setDealerStep('idle');
      }, 650);
      return () => clearTimeout(timer);
    }
  }, [syncedCutCard, syncedCutPos, isHumanDealer]);

  useEffect(() => {
    if (!isHumanDealer && syncedIsDealing) {
      setDealerStep('dealing');
      setIsDealing(true);
      sounds.playDealSequence(seatedCount);
      triggerHaptic('heavy');
    }
  }, [syncedIsDealing, isHumanDealer, seatedCount]);

  // Manual Shuffle Trigger (Dealer only)
  const handleManualShuffle = () => {
    if (!isHumanDealer || isShuffling || isDealing) return;
    setIsShuffling(true);
    setDealerStep('shuffling');
    sounds.playShuffle();
    triggerHaptic('medium');

    setTimeout(() => {
      const newShuffled = shuffle(deck);
      setDeck(newShuffled);
      const nextCount = shuffleCount + 1;
      setShuffleCount(nextCount);
      setIsShuffling(false);
      setDealerStep('idle');
      onDealerShuffle?.(nextCount);
    }, 700);
  };

  // Manual Cut Trigger (Dealer only)
  const handleManualCut = () => {
    if (!isHumanDealer || isCutting || isDealing) return;
    setIsCutting(true);
    setDealerStep('cutting');
    sounds.playCut();
    triggerHaptic('heavy');

    const cutIndex = Math.floor((deck.length * cutSliderPos) / 100);
    const { deck: cutResult, cutCard: revealedCutCard } = cutDeck(deck, cutIndex);

    setTimeout(() => {
      setDeck(cutResult);
      setCutCard(revealedCutCard);
      setIsCutting(false);
      setDealerStep('idle');
      onDealerCut?.(cutSliderPos, revealedCutCard);
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

    onDealerDeal?.(hands, dealerIndex);
    onStartDeal(hands, dealerIndex);
  };

  const handleManualDeal = () => {
    if (!isHumanDealer || seatedCount < 2 || isDealing) return;
    setIsDealing(true);
    setDealerStep('dealing');
    sounds.playDealSequence(seatedCount);
    triggerHaptic('heavy');

    setTimeout(() => {
      executeFinalDeal(deck);
    }, 850);
  };

  // Tactical Urge Dealer (Non-dealer feature)
  const handleUrgeDealer = () => {
    triggerHaptic('medium');
    sounds.playCardPick();
    if (onSendMessage) {
      onSendMessage('quick', `⌛ 庄家【${currentDealer?.name}】请尽快洗牌发牌，大家都在等着呢！`);
    }
  };

  // Takeover / Host dealer rotation
  const handleClaimDealerRole = () => {
    if (mySeatIndex !== -1 && onRotateDealer) {
      triggerHaptic('heavy');
      onRotateDealer(mySeatIndex);
      if (onSendMessage) {
        onSendMessage('text', `👑 玩家已切换至第 ${mySeatIndex + 1} 席担任本局庄家`);
      }
    }
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
                className="absolute z-40 w-16 h-24 sm:w-20 sm:h-28 shadow-2xl rounded-lg"
                initial={{ scale: 0, y: -60, rotateY: -180, opacity: 0 }}
                animate={{ scale: 1, y: 0, rotateY: 0, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.15 }}
              >
                <div className="w-full h-full transform scale-[0.6] sm:scale-75 origin-top-left absolute inset-0">
                   <CardView card={cutCard} className="w-[106px] h-[160px] sm:w-[106px] sm:h-[160px] shadow-2xl shadow-amber-900/50" />
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
    <div className="w-full h-full flex-1 max-w-5xl mx-auto flex flex-col items-center justify-between gap-2 py-1 px-0 sm:px-2 animate-in fade-in duration-300 min-h-0">
      
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

        {/* Current Dealer Tag & My Role Tag */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-950/90 to-slate-900 border border-amber-400/70 flex items-center gap-2 text-xs font-black text-amber-300 shadow-lg shadow-amber-950/40">
            <Crown className="w-4 h-4 text-amber-400 animate-bounce" />
            <span>
              轮流发牌: 当前由 <strong className="text-white underline decoration-amber-400 decoration-2 font-black">{dealerIndex + 1}号位</strong> ({currentDealer?.name}) 发牌
            </span>
          </div>

          <div className={`px-2.5 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 ${
            isHumanDealer
              ? 'bg-amber-500/20 border-amber-400/60 text-amber-300 animate-pulse'
              : 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
          }`}>
            {isHumanDealer ? (
              <>
                <span>👑</span>
                <span>我的身份: {dealerIndex + 1}号位庄家 (当前发牌)</span>
              </>
            ) : (
              <>
                <span>🛡️</span>
                <span>我的身份: {mySeatIndex !== -1 ? mySeatIndex + 1 : 1}号位闲家 (等待{dealerIndex + 1}号发牌)</span>
              </>
            )}
          </div>

          <button
            onClick={onBackToMenu}
            className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            返回大厅
          </button>
        </div>
      </div>

      {/* 2. Seated Players Live Roster (Fixed 8 Seats, auto-assigned, green when occupied) */}
      <div className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl p-2 sm:p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="text-white font-black">牌桌席位 (共8个固定位置 · 依序自动入座不可自选)</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-black border ${
              seatedCount >= 2 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            }`}>
              {seatedCount >= 2 ? `🟢 满足开局条件 (已入座 ${seatedCount}/8 人)` : `⚠️ 至少需 2 人发牌 (当前仅 ${seatedCount}/8 人)`}
            </span>
          </div>

          {/* Live Pure Human Status */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>纯真人联机局</span>
              <span className="text-slate-500 font-normal">· 无人机补位</span>
            </div>
          </div>
        </div>

        {/* 8 Fixed Seats Strip: First is Seat 1, green when occupied, waiting for others */}
        <div className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl px-1 sm:px-2 py-2 flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar shadow-inner">
          {Array.from({ length: 8 }).map((_, idx) => {
            const p = players[idx];
            const isOccupied = !!p;
            const isThisDealer = isOccupied && idx === dealerIndex;
            const isMe = isOccupied && p.id === currentUserId;
            const isSpeaking = isOccupied && activeSpeakerId && p.id === activeSpeakerId;

            return (
              <div
                key={isOccupied ? p.id : `seat-${idx}`}
                className={`relative flex-1 min-w-[42px] max-w-[95px] flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all border select-none ${
                  !isOccupied 
                    ? 'bg-slate-900/30 border-dashed border-slate-800 text-slate-500 opacity-60'
                    : isSpeaking
                    ? 'bg-emerald-950/90 border-2 border-red-500 text-emerald-200 shadow-lg shadow-red-500/40 ring-2 ring-red-400 animate-pulse'
                    : 'bg-emerald-950/80 border-2 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500/30'
                }`}
                title={isOccupied ? `${idx + 1}号位: ${p.name}` : `${idx + 1}号位: 待加入`}
              >
                {/* Dealer Crown Badge on the Dealer Seat */}
                {isThisDealer && (
                  <span className="absolute -top-2.5 -right-1 bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded-full shadow-md border border-amber-300 flex items-center gap-0.5 z-10 animate-bounce" title="当前发牌庄家">
                    <span>👑</span>
                    <span className="hidden sm:inline">发牌</span>
                  </span>
                )}

                {/* Seat Number Tag */}
                <div className="mb-0.5">
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                    isOccupied 
                      ? 'bg-emerald-500 text-slate-950 shadow-sm' 
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {idx + 1}号位
                  </span>
                </div>

                {/* Avatar */}
                <div className={`text-xl sm:text-2xl my-0.5 ${!isOccupied && 'grayscale opacity-40'} ${isSpeaking && 'animate-bounce'}`}>
                  {isOccupied ? p.avatar : '🪑'}
                </div>

                {/* Name / Status */}
                <div className={`text-[10px] font-bold w-full truncate text-center leading-tight ${
                  !isOccupied ? 'text-slate-500' : 'text-emerald-200'
                }`}>
                  {isOccupied ? `${p.name.replace(/\(.*\)/, '')}${isMe ? ' (我)' : ''}` : '待加入'}
                </div>

                {/* Status Dot */}
                <div className="mt-0.5">
                  <span className={`text-[8px] font-bold ${isOccupied ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {isOccupied ? '🟢 已入座' : '⚪ 空位'}
                  </span>
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

        {/* CASE A: Insufficient Players (<2) -> Deal and Chat strictly locked */}
        {seatedCount < 2 ? (
          <div className="flex flex-col items-center text-center gap-3 z-10 animate-fade-in max-w-md px-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse">
                👥
              </div>
              <span className="absolute -bottom-1 -right-1 text-sm bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded-full font-black">
                {seatedCount}/8
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base sm:text-lg font-black text-white flex items-center justify-center gap-2">
                <span>等待其他玩家加入</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold">
                  未满2人
                </span>
              </h3>
              <p className="text-xs text-amber-300 font-bold">
                ⚠️ 规则要求：至少需要 2 位玩家就座才能触发发牌与聊天功能
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                你已成功入座 <strong className="text-emerald-400">{mySeatIndex !== -1 ? `${mySeatIndex + 1}号位` : '1号位'} (绿色 🟢)</strong>。当前轮流发牌由 <strong className="text-amber-400">{dealerIndex + 1}号位 ({players[dealerIndex]?.name || '庄家'})</strong> 发牌。<br />
                其他玩家进入后将按顺序自动排入 2~8 号位并同样亮起绿灯。
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 mt-2 w-full justify-center">
              <button
                onClick={() => {
                  try {
                    window.open(window.location.origin + window.location.pathname + '?mode=realtime', '_blank');
                  } catch (e) {
                    console.log(e);
                  }
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                title="在另一个浏览器标签页打开游戏，自动作为新玩家入座 2号位 体验真实多人对战"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>新标签页联机对战 (自动排入下个席位)</span>
              </button>
            </div>
          </div>
        ) : isHumanDealer ? (
          /* CASE B: Human Player is Dealer -> Full Interactive Controls */
          <div className="w-full flex flex-col items-center justify-center gap-3 z-10 animate-fade-in">
            
            {/* Dealer Prompt */}
            <div className="flex flex-col items-center text-center">
              <span className="text-xs sm:text-sm font-black px-4 py-1.5 rounded-full bg-amber-500/25 border border-amber-400/60 text-amber-300 flex items-center gap-2 shadow-md">
                <Crown className="w-4 h-4 text-amber-400 animate-bounce" />
                <span>当前由 {dealerIndex + 1}号位 (你) 发牌 · 已满足开局条件 ({seatedCount}/8人)</span>
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
                <span>{shuffleCount > 0 ? `再次洗牌 (${shuffleCount}次)` : '洗牌'}</span>
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
          /* CASE C: Another Seated Player is Dealer -> Strictly Waiting for Dealer Actions */
          <div className="flex flex-col items-center text-center gap-3 sm:gap-4 z-10 animate-fade-in w-full max-w-lg">
            
            {/* Non-Dealer Badge & Warning */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-black px-3.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5 shadow-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>你当前是【闲家】(第 {mySeatIndex !== -1 ? mySeatIndex + 1 : 1} 席) · 请等待庄家洗牌发牌</span>
              </span>
              <p className="text-[11px] text-slate-400 max-w-md">
                🔒 规则约束：本局由庄家【{currentDealer?.name}】独占洗牌与发牌权，闲家无法操作牌叠。
              </p>
            </div>

            {/* Dealer Profile & Live Telemetry */}
            <div className="w-full bg-slate-900/85 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400 text-2xl flex items-center justify-center shadow-md animate-pulse">
                  {currentDealer?.avatar}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-black text-white">{currentDealer?.name}</span>
                    <span className="text-[10px] text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded font-bold">
                      {dealerIndex + 1}号位庄家
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5 flex items-center gap-2">
                    <span>
                      {dealerStep === 'shuffling' && '🎴 庄家正在洗牌打乱...'}
                      {dealerStep === 'cutting' && '✂️ 庄家正在切牌验牌...'}
                      {dealerStep === 'dealing' && '🚀 庄家正在分发13张手牌...'}
                      {dealerStep === 'idle' && (shuffleCount > 0 ? `已洗牌 ${shuffleCount} 次，等待发牌` : '正在准备洗牌...')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Pills */}
              <div className="flex flex-col items-end gap-1">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  shuffleCount > 0 
                    ? 'bg-blue-500/20 border-blue-400 text-blue-300' 
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}>
                  {shuffleCount > 0 ? `已洗牌 ${shuffleCount} 次` : '未洗牌'}
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  cutCard 
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300' 
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}>
                  {cutCard ? `已切牌 (${cutSliderPos}%)` : '未切牌'}
                </span>
              </div>
            </div>

            {renderDeckAnimation()}

            {/* Non-Dealer Action Row */}
            <div className="flex items-center gap-2.5 flex-wrap justify-center mt-1">
              <button
                onClick={handleUrgeDealer}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-500/40 text-amber-300 hover:text-white text-xs font-black flex items-center gap-1.5 transition active:scale-95 shadow cursor-pointer"
                title="向庄家发送战术催促短语"
              >
                <span>⌛</span>
                <span>战术催促发牌</span>
              </button>

              <button
                onClick={handleClaimDealerRole}
                className="px-4 py-2 rounded-xl bg-indigo-900/40 hover:bg-indigo-800/60 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow"
                title="庄家若暂未操作，可申请由我发牌"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>申请换我发牌</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table Chat Bar Integration for Realtime Dealer Phase */}
      {onSendMessage && onOpenFullChat && (
        <div className="w-full max-w-2xl mx-auto shrink-0 px-1 sm:px-2 mt-2">
          <div className="animate-fade-in flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] font-bold px-2">
              <span className={`flex items-center gap-1.5 ${seatedCount >= 2 ? 'text-emerald-400' : 'text-amber-400'}`}>
                <span className={`w-2 h-2 rounded-full ${seatedCount >= 2 ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
                <span>
                  {seatedCount >= 2 
                    ? '战术电台已启动 · 支持实时语音对讲与常用语音播报' 
                    : '三重语音引擎已就绪 · 等待其他真人玩家入座 (支持麦克风测试与电台试听)'}
                </span>
              </span>
              <span className="text-slate-400 font-mono text-[10px]">
                全桌 {seatedCount}/8 位玩家
              </span>
            </div>
            <TableTacticalChatBar
              onSendMessage={onSendMessage}
              onOpenFullChat={onOpenFullChat}
              ttsEnabled={ttsEnabled}
              onToggleTts={onToggleTts || (() => {})}
              unreadCount={unreadCount}
              latestMessage={latestMessage}
              onUserSpeakingChange={onUserSpeakingChange}
            />
          </div>
        </div>
      )}

    </div>
  );
}
