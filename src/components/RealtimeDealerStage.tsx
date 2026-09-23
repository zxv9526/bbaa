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
    <div className="w-full h-full flex-1 max-w-4xl mx-auto flex flex-col items-center justify-between gap-2 py-1 px-1 sm:px-3 animate-in fade-in duration-300 min-h-0">
      
      {/* 1. Ultra-clean Header Bar */}
      <div className="w-full flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onBackToMenu}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-sm"
          >
            <span>←</span>
            <span>大厅</span>
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-sm sm:text-base font-black text-white">⚡ 实时场</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
              第 {round} 局
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-amber-500/40 text-slate-200">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>庄家: <strong className="text-amber-300">{dealerIndex + 1}号位</strong> {currentDealer?.name ? `(${currentDealer.name})` : ''}</span>
          </div>
          <div className={`px-2.5 py-1 rounded-full font-bold border ${
            seatedCount >= 2
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
          }`}>
            👥 {seatedCount}/8人
          </div>
        </div>
      </div>

      {/* 2. Compact 8-Seat Live Strip */}
      <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-2 shrink-0 shadow-md">
        <div className="w-full flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar">
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
                className={`relative flex-1 min-w-[40px] max-w-[90px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all border ${
                  !isOccupied 
                    ? 'bg-slate-900/20 border-dashed border-slate-800 text-slate-600'
                    : isSpeaking
                    ? 'bg-emerald-950/90 border-2 border-emerald-400 text-emerald-200 shadow-md shadow-emerald-500/30 ring-2 ring-emerald-400/80 animate-pulse'
                    : isMe
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                    : 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                }`}
              >
                {/* Floating seat chat/voice bubble */}
                {bubble && (
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-30 pointer-events-none whitespace-nowrap">
                    {bubble.type === 'emoji' ? (
                      <span className="text-2xl drop-shadow-md animate-bounce">{bubble.content}</span>
                    ) : bubble.type === 'voice' ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold shadow-lg flex items-center gap-1 border border-emerald-300">
                        <span>🎙️ {bubble.duration || 2}"</span>
                        <span className="text-[9px] font-mono">)))</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg bg-slate-900 text-amber-200 border border-slate-700 text-[10px] font-bold shadow-md max-w-[90px] truncate">
                        {bubble.content}
                      </span>
                    )}
                  </div>
                )}

                {/* Dealer Crown Badge */}
                {isThisDealer && (
                  <span className="absolute -top-2 -right-1 text-xs" title="发牌庄家">
                    👑
                  </span>
                )}

                {/* Seat number */}
                <span className={`text-[9px] font-black px-1 rounded ${
                  isOccupied ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-600'
                }`}>
                  {idx + 1}号
                </span>

                {/* Avatar */}
                <div className={`text-lg sm:text-xl my-0.5 ${!isOccupied ? 'grayscale opacity-30' : ''}`}>
                  {isOccupied ? p.avatar : '🪑'}
                </div>

                {/* Name */}
                <span className="text-[10px] truncate w-full text-center font-medium">
                  {isOccupied ? (isMe ? '我' : p.name.replace(/\(.*\)/, '')) : '空位'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Central Stage (Clean, Focused, Intuitive) */}
      <div className="w-full flex-1 min-h-[220px] sm:min-h-[260px] bg-slate-900/60 border border-slate-800 rounded-3xl p-4 sm:p-6 flex flex-col items-center justify-center relative shadow-inner overflow-hidden">
        
        {/* State A: Less than 2 players */}
        {seatedCount < 2 ? (
          <div className="flex flex-col items-center text-center gap-3 z-10 max-w-sm">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-2xl animate-pulse">
              👥
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">等待其他玩家加入</h3>
              <p className="text-xs text-slate-400">
                当前已入座 <span className="text-emerald-400 font-bold">{seatedCount}/8</span> 人 · 满 2 人即可发牌
              </p>
            </div>
            <button
              onClick={() => {
                try {
                  window.open(window.location.origin + window.location.pathname + '?mode=realtime', '_blank');
                } catch (e) {
                  console.log(e);
                }
              }}
              className="mt-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow active:scale-95 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>新标签页联机体验</span>
            </button>
          </div>
        ) : isHumanDealer ? (
          /* State B: User is Dealer -> Clean controls */
          <div className="w-full flex flex-col items-center justify-center gap-3 z-10">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-amber-300 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>您是当前发牌庄家</span>
              </span>
              <span className="text-xs text-slate-400">
                已洗牌: <strong className="text-white">{shuffleCount}</strong> 次
              </span>
            </div>

            {renderDeckAnimation()}

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center mt-3">
              <button
                onClick={handleManualShuffle}
                disabled={isShuffling || isDealing}
                className="h-12 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 border-2 border-indigo-500/40 text-indigo-200 hover:text-white text-sm font-black flex items-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg shadow-indigo-950/40"
              >
                <RotateCcw className={`w-4 h-4 ${isShuffling ? 'animate-spin text-amber-400' : 'text-indigo-400'}`} />
                <span>{shuffleCount > 0 ? `再次洗牌 (${shuffleCount})` : '洗牌'}</span>
              </button>

              <button
                onClick={handleManualCut}
                disabled={isShuffling || isCutting || isDealing}
                className="h-12 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 border-2 border-cyan-500/40 text-cyan-200 hover:text-white text-sm font-black flex items-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg shadow-cyan-950/40"
              >
                <Scissors className="w-4 h-4 text-cyan-400" />
                <span>{cutCard ? '重新切牌' : '切牌'}</span>
              </button>

              <button
                onClick={handleManualDeal}
                disabled={isShuffling || isCutting || isDealing}
                className="h-12 px-7 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-amber-950/60 ring-2 ring-amber-300/50 flex items-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-slate-950" />
                <span>{isDealing ? '发牌中...' : '立即发牌'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* State C: Non-Dealer -> Waiting for Dealer */
          <div className="flex flex-col items-center text-center gap-3 z-10 max-w-sm">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/90 border border-slate-700 text-slate-300 text-xs sm:text-sm font-bold shadow-md">
              <span className="text-base">⏳</span>
              <span>等待庄家【<strong className="text-amber-300">{currentDealer?.name}</strong>】发牌中...</span>
            </div>

            {renderDeckAnimation()}

            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleUrgeDealer}
                className="h-11 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 border-2 border-amber-500/40 text-amber-300 hover:text-amber-200 text-sm font-black flex items-center gap-2 transition active:scale-95 cursor-pointer shadow-lg shadow-amber-950/40"
              >
                <span className="text-base">⌛</span>
                <span>催促发牌</span>
              </button>

              <button
                onClick={handleClaimDealerRole}
                className="h-11 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 border-2 border-indigo-500/40 text-indigo-300 hover:text-white text-sm font-black flex items-center gap-2 transition active:scale-95 cursor-pointer shadow-lg shadow-indigo-950/40"
              >
                <Crown className="w-4 h-4 text-amber-400" />
                <span>换我做庄</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Bottom Tactical Chat Bar (Clean & Focused) */}
      {onSendMessage && onOpenFullChat && (
        <div className="w-full max-w-3xl mx-auto shrink-0 px-1 mt-1">
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
