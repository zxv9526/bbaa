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
  Volume2,
  Bot,
  UserPlus,
  UserMinus,
  RefreshCw
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
  onFillAiPlayers?: (count?: number) => void;
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
  onFillAiPlayers,
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
  const [seatBubbles, setSeatBubbles] = useState<Record<string, {
    content: string;
    type: 'text' | 'voice' | 'quick' | 'emoji';
    duration?: number;
    audioUrl?: string;
    id: string;
  }>>({});

  useEffect(() => {
    if (latestMessage && Date.now() - latestMessage.timestamp < 6000) {
      setActiveSpeakerId(latestMessage.senderId);
      setSeatBubbles(prev => ({
        ...prev,
        [latestMessage.senderId]: {
          content: latestMessage.content,
          type: latestMessage.type,
          duration: latestMessage.audioDuration,
          audioUrl: latestMessage.audioUrl,
          id: latestMessage.id
        }
      }));
      const timer = setTimeout(() => {
        setActiveSpeakerId(null);
        setSeatBubbles(prev => {
          const copy = { ...prev };
          delete copy[latestMessage.senderId];
          return copy;
        });
      }, 5000);
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
    <div className="w-full h-full flex-1 max-w-4xl mx-auto flex flex-col items-center justify-between gap-1 sm:gap-1.5 py-0.5 px-1 sm:px-2 animate-in fade-in duration-300 min-h-0 overflow-hidden select-none">
      
      {/* 1. Ultra-clean Header Bar */}
      <div className="w-full flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onBackToMenu}
            className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
          >
            <span>←</span>
            <span>大厅</span>
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-xs sm:text-sm font-black text-white">⚡ 实时场</span>
            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
              第 {round} 局
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          {/* Quick AI Seat Fill Controls */}
          {onFillAiPlayers && seatedCount < 8 && (
            <button
              onClick={() => onFillAiPlayers(8)}
              className="px-2 py-1 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/50 text-indigo-300 hover:text-white text-[11px] font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-sm"
              title="一键补齐AI玩家至满桌8人"
            >
              <Bot className="w-3.5 h-3.5 text-indigo-400" />
              <span>补满AI</span>
            </button>
          )}

          {onAddPlayer && seatedCount < 8 && (
            <button
              onClick={onAddPlayer}
              className="px-2 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-sm"
              title="添加一名AI玩家"
            >
              <UserPlus className="w-3 h-3 text-emerald-400" />
              <span>+AI</span>
            </button>
          )}

          {onRemovePlayer && seatedCount > 1 && (
            <button
              onClick={onRemovePlayer}
              className="px-1.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-rose-300 text-[11px] font-bold flex items-center transition active:scale-95 cursor-pointer shadow-sm"
              title="移除一名AI玩家"
            >
              <UserMinus className="w-3 h-3 text-rose-400" />
            </button>
          )}

          <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-900 border border-amber-500/40 text-slate-200 text-[11px] sm:text-xs">
            <Crown className="w-3 h-3 text-amber-400" />
            <span>庄家: <strong className="text-amber-300">{dealerIndex + 1}号位</strong></span>
          </div>
          <div className={`px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-bold border ${
            seatedCount >= 2
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
          }`}>
            👥 {seatedCount}/8人
          </div>
        </div>
      </div>

      {/* 2. Compact 8-Seat Live Strip */}
      <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-1 shrink-0 shadow-md">
        <div className="w-full flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
          {Array.from({ length: 8 }).map((_, idx) => {
            const p = players[idx];
            const isOccupied = !!p;
            const isThisDealer = isOccupied && idx === dealerIndex;
            const isMe = isOccupied && p.id === currentUserId;
            const isSpeaking = isOccupied && activeSpeakerId && p.id === activeSpeakerId;
            const bubble = isOccupied ? seatBubbles[p.id] : null;

            return (
              <div
                key={`realtime-seat-${idx}`}
                onClick={() => {
                  if (!isOccupied && onAddPlayer) {
                    onAddPlayer();
                  }
                }}
                className={`relative flex-1 min-w-[36px] max-w-[85px] flex flex-col items-center justify-center py-0.5 px-0.5 rounded-lg transition-all border cursor-pointer ${
                  !isOccupied 
                    ? 'bg-slate-900/20 border-dashed border-slate-800 text-slate-600 hover:border-slate-600 hover:bg-slate-900/40'
                    : isSpeaking
                    ? 'bg-emerald-950/90 border-2 border-emerald-400 text-emerald-200 shadow-md shadow-emerald-500/30 ring-2 ring-emerald-400/80 animate-pulse'
                    : isMe
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                    : 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                }`}
                title={!isOccupied ? '点击添加AI玩家入座' : `${p.name}`}
              >
                {/* Floating seat chat/voice bubble */}
                {bubble && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none whitespace-nowrap">
                    {bubble.type === 'emoji' ? (
                      <span className="text-xl drop-shadow-md animate-bounce">{bubble.content}</span>
                    ) : bubble.type === 'voice' ? (
                      <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[9px] font-bold shadow-lg flex items-center gap-0.5 border border-emerald-300">
                        <span>🎙️ {bubble.duration || 2}"</span>
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded-md bg-slate-900 text-amber-200 border border-slate-700 text-[9px] font-bold shadow-md max-w-[80px] truncate">
                        {bubble.content}
                      </span>
                    )}
                  </div>
                )}

                {/* Dealer Crown Badge */}
                {isThisDealer && (
                  <span className="absolute -top-1.5 -right-0.5 text-[10px]" title="发牌庄家">
                    👑
                  </span>
                )}

                {/* Seat number */}
                <span className={`text-[8px] font-black px-0.5 rounded ${
                  isOccupied ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-600'
                }`}>
                  {idx + 1}号
                </span>

                {/* Avatar */}
                <div className={`text-base sm:text-lg my-0 ${!isOccupied ? 'grayscale opacity-30' : ''}`}>
                  {isOccupied ? p.avatar : '🪑'}
                </div>

                {/* Name */}
                <span className="text-[9px] truncate w-full text-center font-medium">
                  {isOccupied ? (isMe ? '我' : p.name.replace(/\(.*\)/, '')) : '+AI'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Central Stage (Adaptive Flex, No Scroll, Always Actionable) */}
      <div className="w-full flex-1 min-h-0 bg-slate-900/60 border border-slate-800 rounded-2xl p-2 sm:p-3 flex flex-col items-center justify-between relative shadow-inner overflow-hidden">
        
        {/* Top Status Pill */}
        <div className="flex items-center gap-2 z-10 shrink-0">
          {isHumanDealer ? (
            <span className="text-xs font-black text-amber-300 px-3 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center gap-1.5 shadow-sm">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>您是发牌庄家 · 请洗牌、切牌后发牌</span>
            </span>
          ) : (
            <span className="text-xs font-black text-slate-300 px-3 py-0.5 rounded-full bg-slate-800/90 border border-slate-700 flex items-center gap-1.5 shadow-sm">
              <span className="text-sm">⏳</span>
              <span>等待庄家【<strong className="text-amber-300">{currentDealer?.name}</strong>】发牌...</span>
            </span>
          )}

          <span className="text-[11px] text-slate-400 bg-slate-950/60 px-2.5 py-0.5 rounded-full border border-slate-800">
            已洗牌: <strong className="text-white">{shuffleCount}</strong> 次
          </span>
        </div>

        {/* 3D Animated Deck in the Center */}
        <div className="flex-1 flex items-center justify-center min-h-0 py-1">
          {renderDeckAnimation()}
        </div>

        {/* Core Function Buttons Deck (Always Prominent, Clear & Tactile) */}
        <div className="w-full flex flex-col items-center gap-1.5 z-10 shrink-0">
          {isHumanDealer ? (
            /* DEALER ACTION SUITE */
            <div className="w-full flex flex-col items-center gap-2">
              <div className="w-full flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                {/* 1. Shuffle Button */}
                <button
                  id="btn-realtime-shuffle"
                  onClick={handleManualShuffle}
                  disabled={isShuffling || isDealing}
                  className="h-11 sm:h-12 px-4 sm:px-5 rounded-xl sm:rounded-2xl bg-slate-800 hover:bg-slate-700 border-2 border-indigo-500/50 text-indigo-200 hover:text-white text-xs sm:text-sm font-black flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg shadow-indigo-950/50"
                  title="点击洗牌（支持多次连续洗牌）"
                >
                  <RotateCcw className={`w-4 h-4 ${isShuffling ? 'animate-spin text-amber-400' : 'text-indigo-400'}`} />
                  <span>{shuffleCount > 0 ? `再洗一次 (${shuffleCount})` : '洗牌 (Shuffle)'}</span>
                </button>

                {/* 2. Cut Deck Button */}
                <button
                  id="btn-realtime-cut"
                  onClick={handleManualCut}
                  disabled={isShuffling || isCutting || isDealing}
                  className="h-11 sm:h-12 px-4 sm:px-5 rounded-xl sm:rounded-2xl bg-slate-800 hover:bg-slate-700 border-2 border-cyan-500/50 text-cyan-200 hover:text-white text-xs sm:text-sm font-black flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg shadow-cyan-950/50"
                  title="点击切牌"
                >
                  <Scissors className="w-4 h-4 text-cyan-400" />
                  <span>{cutCard ? '重新切牌' : '切牌 (Cut)'}</span>
                </button>

                {/* 3. Primary Deal Button */}
                <button
                  id="btn-realtime-deal"
                  onClick={() => {
                    if (seatedCount < 2 && onFillAiPlayers) {
                      onFillAiPlayers(4);
                      setTimeout(() => {
                        handleManualDeal();
                      }, 200);
                    } else {
                      handleManualDeal();
                    }
                  }}
                  disabled={isShuffling || isCutting || isDealing}
                  className="h-11 sm:h-12 px-6 sm:px-8 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-950/70 ring-2 ring-amber-300/50 flex items-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="分发手牌并进入理牌对局"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>
                    {isDealing 
                      ? '发牌中...' 
                      : seatedCount < 2 
                      ? '一键补齐AI发牌' 
                      : `立即发牌 (${seatedCount}人)`}
                  </span>
                </button>
              </div>

              {/* Auxiliary Quick AI Bar */}
              <div className="flex items-center gap-2 text-xs">
                {onFillAiPlayers && seatedCount < 8 && (
                  <button
                    onClick={() => onFillAiPlayers(8)}
                    className="px-3 py-1 rounded-xl bg-indigo-950/90 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-200 text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-sm"
                  >
                    <Bot className="w-3.5 h-3.5 text-indigo-400" />
                    <span>一键满桌AI (8人开桌)</span>
                  </button>
                )}
                {onRotateDealer && (
                  <button
                    onClick={() => onRotateDealer((dealerIndex + 1) % Math.max(1, seatedCount))}
                    className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-sm"
                  >
                    <RefreshCw className="w-3 h-3 text-amber-400" />
                    <span>顺延下一位庄家</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* NON-DEALER ACTION SUITE */
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
              <button
                onClick={handleUrgeDealer}
                className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs sm:text-sm font-black flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md"
              >
                <span className="text-sm">⌛</span>
                <span>催促庄家发牌</span>
              </button>

              <button
                onClick={handleClaimDealerRole}
                className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs sm:text-sm font-black flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>换我做庄发牌</span>
              </button>

              {onFillAiPlayers && seatedCount < 8 && (
                <button
                  onClick={() => onFillAiPlayers(8)}
                  className="h-10 sm:h-11 px-4 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/50 text-indigo-200 text-xs sm:text-sm font-black flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-md"
                >
                  <Bot className="w-3.5 h-3.5 text-indigo-400" />
                  <span>满桌AI</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. Bottom Tactical Chat Bar (Clean, Focused, Zero Overflow) */}
      {onSendMessage && onOpenFullChat && (
        <div className="w-full max-w-3xl mx-auto shrink-0 px-0 mt-0.5">
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
      )}

    </div>
  );
}
