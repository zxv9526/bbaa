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
  Volume2,
  Copy,
  Check,
  RefreshCw,
  DoorOpen
} from 'lucide-react';

import { TableTacticalChatBar } from './TableTacticalChatBar';
import { ChatMessage } from '../types';
import { CardView } from './CardView';
import { fetchActiveRooms, ActiveRoomInfo, claimDealerRole } from '../lib/realtimeTableManager';

export interface RealtimeSeatPlayer {
  id: string;
  name: string;
  avatar: string;
  isAi?: boolean;
  score: number;
}

interface RealtimeDealerStageProps {
  round: number;
  dealerIndex: number;
  players: RealtimeSeatPlayer[];
  currentUserId: string;
  roomId?: string;
  onSwitchRoom?: (newRoomId: string) => void;
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
  roomId = '888888',
  onSwitchRoom,
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

  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [activeRooms, setActiveRooms] = useState<ActiveRoomInfo[]>([]);
  const [customRoomInput, setCustomRoomInput] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

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
  }, [seatedCount]);

  // Sync external dealer actions
  useEffect(() => {
    if (typeof syncedShuffleCount === 'number' && syncedShuffleCount !== shuffleCount) {
      setShuffleCount(syncedShuffleCount);
      setIsShuffling(true);
      sounds.playShuffle();
      triggerHaptic('light');
      setTimeout(() => setIsShuffling(false), 600);
    }
  }, [syncedShuffleCount]);

  useEffect(() => {
    if (typeof syncedCutPos === 'number') {
      setCutSliderPos(syncedCutPos);
    }
    if (syncedCutCard) {
      setCutCard(syncedCutCard);
      setIsCutting(true);
      sounds.playCut();
      triggerHaptic('medium');
      setTimeout(() => setIsCutting(false), 700);
    }
  }, [syncedCutPos, syncedCutCard]);

  useEffect(() => {
    if (syncedIsDealing) {
      setIsDealing(true);
      sounds.playDeal();
    }
  }, [syncedIsDealing]);

  // Copy invitation link helper
  const handleCopyInviteLink = () => {
    try {
      const url = `${window.location.origin}${window.location.pathname}?mode=realtime&roomId=${encodeURIComponent(roomId)}`;
      navigator.clipboard.writeText(url);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
      showToast(`已复制房间 [${roomId}] 邀请链接！好友打开即可同桌对决`);
      triggerHaptic('light');
    } catch {
      showToast(`请复制房间号: ${roomId}`);
    }
  };

  // 1. Shuffle Routine
  const handleManualShuffle = () => {
    if (!isHumanDealer || isShuffling || isDealing) return;
    setIsShuffling(true);
    triggerHaptic('medium');
    sounds.playShuffle();

    let count = 0;
    const interval = setInterval(() => {
      setDeck(prev => shuffle([...prev]));
      sounds.playShuffle();
      count++;
      if (count >= 5) {
        clearInterval(interval);
        setIsShuffling(false);
        const newCount = shuffleCount + 1;
        setShuffleCount(newCount);
        setDealerStep('cutting');
        triggerHaptic('success');
        if (onDealerShuffle) {
          onDealerShuffle(newCount);
        }
      }
    }, 110);
  };

  // 2. Cut Routine
  const handleManualCut = () => {
    if (!isHumanDealer || isCutting || isDealing) return;
    setIsCutting(true);
    triggerHaptic('medium');
    sounds.playCut();

    const cutIndex = Math.floor((cutSliderPos / 100) * deck.length);
    const { cutCard: chosenCard, deck: newDeck } = cutDeck(deck, cutIndex);

    setDeck(newDeck);
    setCutCard(chosenCard);

    setTimeout(() => {
      setIsCutting(false);
      setDealerStep('dealing');
      triggerHaptic('success');
      if (onDealerCut) {
        onDealerCut(cutSliderPos, chosenCard);
      }
    }, 600);
  };

  // 3. Deal Routine (strictly real humans only, min 2)
  const handleManualDeal = () => {
    if (!isHumanDealer || isDealing || seatedCount < 2) return;
    setIsDealing(true);
    setDealerStep('dealing');
    triggerHaptic('heavy');
    sounds.playDeal();

    let workingDeck = [...deck];
    if (shuffleCount === 0) {
      workingDeck = shuffle(workingDeck);
    }

    const cardsPerPlayer = 13;
    const hands: { [playerId: string]: Card[] } = {};

    players.forEach((p, idx) => {
      hands[p.id] = workingDeck.slice(idx * cardsPerPlayer, (idx + 1) * cardsPerPlayer);
    });

    if (onDealerDeal) {
      onDealerDeal(hands, dealerIndex);
    }

    setTimeout(() => {
      setIsDealing(false);
      onStartDeal(hands, dealerIndex);
    }, 1200);
  };

  // Non-dealer actions
  const handleUrgeDealer = () => {
    triggerHaptic('light');
    sounds.playCardPick();
    if (onSendMessage) {
      onSendMessage('quick', '庄家搞快点，等得花儿都谢了！🌸');
    }
  };

  const handleClaimDealerRole = () => {
    triggerHaptic('medium');
    sounds.playCardPick();
    claimDealerRole(currentUserId);
    if (onRotateDealer && mySeatIndex !== -1) {
      onRotateDealer(mySeatIndex);
    }
    if (onSendMessage) {
      onSendMessage('text', `我来坐庄发牌！让各位见识下真正的手气 👑`);
    }
  };

  // Render 3D deck
  const renderDeckAnimation = () => {
    const stackHeight = 12;
    return (
      <div className="relative w-44 sm:w-52 h-48 sm:h-56 flex items-center justify-center select-none perspective-800">
        {Array.from({ length: stackHeight }).map((_, i) => {
          const isTop = i === stackHeight - 1;
          const yOffset = (stackHeight - 1 - i) * 2;
          const xOffset = Math.sin(i * 0.4) * 1.5;

          return (
            <motion.div
              key={i}
              className="absolute w-24 sm:w-28 h-36 sm:h-40 rounded-xl border border-amber-600/30 shadow-md bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-1.5"
              style={{
                top: `calc(50% - 72px + ${yOffset}px)`,
                left: `calc(50% - 48px + ${xOffset}px)`,
                zIndex: i,
              }}
              animate={
                isShuffling
                  ? {
                      x: i % 2 === 0 ? [0, -35, 15, 0] : [0, 35, -15, 0],
                      y: [0, -10, 0],
                      rotateZ: i % 2 === 0 ? [-8, 6, 0] : [8, -6, 0],
                      transition: { duration: 0.28, repeat: Infinity, ease: 'easeInOut' }
                    }
                  : isCutting && isTop
                  ? {
                      y: [-25, -20, 0],
                      x: [25, 20, 0],
                      rotateZ: [12, 10, 0],
                      transition: { duration: 0.5, ease: 'easeOut' }
                    }
                  : {}
              }
            >
              <div className="w-full h-full rounded-lg border border-amber-500/20 bg-slate-900/90 flex flex-col items-center justify-between p-1.5">
                <div className="w-full flex justify-between text-[9px] text-amber-500/50 font-mono">
                  <span>13</span>
                  <span>♠</span>
                </div>
                <div className="w-9 h-9 rounded-full border border-amber-500/30 flex items-center justify-center bg-amber-500/5">
                  <span className="text-sm">🎴</span>
                </div>
                <div className="w-full flex justify-between text-[9px] text-amber-500/50 font-mono rotate-180">
                  <span>13</span>
                  <span>♠</span>
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Revealed Cut Card */}
        {cutCard && (
          <motion.div
            initial={{ scale: 0, y: -40, rotateY: 90 }}
            animate={{ scale: 1, y: -10, rotateY: 0 }}
            className="absolute z-30"
          >
            <div className="relative ring-4 ring-amber-400 rounded-xl shadow-2xl">
              <CardView card={cutCard} size="md" />
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] whitespace-nowrap shadow-md">
                切出的吉牌
              </div>
            </div>
          </motion.div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full max-h-[100dvh] flex flex-col justify-between overflow-hidden p-2 sm:p-3 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 select-none">
      
      {/* 1. Header Bar */}
      <div className="w-full flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={onBackToMenu}
            className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
          >
            <span>←</span>
            <span>大厅</span>
          </button>
          
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="text-xs sm:text-sm font-black text-white">⚡ 真人实时场</span>
            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
              第 {round} 局
            </span>
          </div>

          {/* Room Switcher / Manager Badge */}
          <button
            onClick={() => {
              setShowRoomModal(true);
              fetchActiveRooms().then(setActiveRooms);
            }}
            className="px-2.5 py-1 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-200 text-[11px] sm:text-xs font-bold flex items-center gap-1 transition cursor-pointer active:scale-95 shadow-sm"
            title="点击切换或管理房间"
          >
            <DoorOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span>房号: <strong className="text-amber-300 font-mono">{roomId}</strong></span>
            <span className="text-[9px] text-indigo-400">▾</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          {/* Copy Invite Link */}
          <button
            onClick={handleCopyInviteLink}
            className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-[11px] font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-sm"
            title="复制房间链接邀请好友同桌"
          >
            {copiedInvite ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{copiedInvite ? '已复制链接' : '邀请牌友'}</span>
          </button>

          <div className="hidden sm:flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-900 border border-amber-500/40 text-slate-200 text-[11px]">
            <Crown className="w-3 h-3 text-amber-400" />
            <span>庄家: <strong className="text-amber-300">{dealerIndex + 1}号位</strong></span>
          </div>

          <div className={`px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-bold border ${
            seatedCount >= 2
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
          }`}>
            👥 真人 {seatedCount}/8
          </div>
        </div>
      </div>

      {/* 2. Compact 8-Seat Live Strip (Real Players Only) */}
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
                  if (!isOccupied) {
                    handleCopyInviteLink();
                  }
                }}
                className={`relative flex-1 min-w-[36px] max-w-[85px] flex flex-col items-center justify-center py-0.5 px-0.5 rounded-lg transition-all border ${
                  !isOccupied 
                    ? 'bg-slate-900/20 border-dashed border-slate-800 text-slate-600 cursor-pointer hover:border-slate-700'
                    : isSpeaking
                    ? 'bg-emerald-950/90 border-2 border-emerald-400 text-emerald-200 shadow-md shadow-emerald-500/30 ring-2 ring-emerald-400/80 animate-pulse'
                    : isMe
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                    : 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                }`}
                title={!isOccupied ? '空位 · 点击复制邀请链接' : `${p.name}`}
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
                  {isOccupied ? (isMe ? '我' : p.name.replace(/\(.*\)/, '')) : '空位'}
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

        {/* Waiting For Players Notification when only 1 player */}
        {seatedCount < 2 && (
          <div className="w-full max-w-md bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs text-amber-200 shrink-0 z-10">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>当前房间仅 1 人，需 ≥2 位真人入座方可发牌</span>
            </span>
            <button
              onClick={handleCopyInviteLink}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[11px] font-bold transition cursor-pointer"
            >
              复制邀请链接
            </button>
          </div>
        )}

        {/* 3D Animated Deck in the Center */}
        <div className="flex-1 flex items-center justify-center min-h-0 py-1">
          {renderDeckAnimation()}
        </div>

        {/* Core Function Buttons Deck */}
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
                  onClick={handleManualDeal}
                  disabled={isShuffling || isCutting || isDealing || seatedCount < 2}
                  className={`h-11 sm:h-12 px-6 sm:px-8 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm shadow-xl flex items-center gap-2 transition active:scale-95 cursor-pointer ${
                    seatedCount >= 2
                      ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-950/70 ring-2 ring-amber-300/50'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 opacity-80 cursor-not-allowed'
                  }`}
                  title={seatedCount >= 2 ? '分发手牌并进入理牌对局' : '至少需要 2 位真人玩家入座方可发牌'}
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    {isDealing 
                      ? '发牌中...' 
                      : seatedCount < 2 
                      ? `等待真人入座 (当前${seatedCount}/2~8人)` 
                      : `立即发牌 (${seatedCount}人对局)`}
                  </span>
                </button>
              </div>

              {/* Auxiliary Controls */}
              <div className="flex items-center gap-2 text-xs flex-wrap justify-center">
                {seatedCount < 2 && (
                  <button
                    onClick={handleCopyInviteLink}
                    className="px-3 py-1 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-sm"
                  >
                    <Copy className="w-3.5 h-3.5 text-emerald-400" />
                    <span>邀请好友入座 (当前 1/8)</span>
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

              {seatedCount < 2 && (
                <button
                  onClick={handleCopyInviteLink}
                  className="h-10 sm:h-11 px-4 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm font-black flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-md"
                >
                  <Copy className="w-3.5 h-3.5 text-emerald-400" />
                  <span>邀请好友入座</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. Bottom Tactical Chat Bar */}
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

      {/* 5. Room Management / Switcher Modal */}
      <AnimatePresence>
        {showRoomModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <DoorOpen className="w-5 h-5 text-indigo-400" />
                  <span className="font-black text-white text-base">对战房间管理</span>
                </div>
                <button
                  onClick={() => setShowRoomModal(false)}
                  className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Current Room Info */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-indigo-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">当前所在房间:</span>
                  <span className="font-mono font-black text-amber-300 text-sm">{roomId}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">在座真人玩家:</span>
                  <span className="text-emerald-300 font-bold">{seatedCount} / 8 人</span>
                </div>
                <button
                  onClick={handleCopyInviteLink}
                  className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>复制当前房间邀请链接</span>
                </button>
              </div>

              {/* Join by Room Code */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">输入房间号加入：</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="输入6位房间号 (如 888888)"
                    value={customRoomInput}
                    onChange={(e) => setCustomRoomInput(e.target.value.trim())}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                    maxLength={10}
                  />
                  <button
                    onClick={() => {
                      if (!customRoomInput) return;
                      setShowRoomModal(false);
                      if (onSwitchRoom) {
                        onSwitchRoom(customRoomInput);
                      }
                    }}
                    disabled={!customRoomInput}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs transition active:scale-95 cursor-pointer"
                  >
                    加入
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setShowRoomModal(false);
                    if (onSwitchRoom) onSwitchRoom('888888');
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <span>🏠 返回竞技大厅 (888888)</span>
                </button>

                <button
                  onClick={() => {
                    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
                    setShowRoomModal(false);
                    if (onSwitchRoom) onSwitchRoom(newCode);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md"
                >
                  <span>✨ 创建新私密房间</span>
                </button>
              </div>

              {/* Active Room List */}
              {activeRooms.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-slate-400">服务器活跃房间：</div>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {activeRooms.map(r => (
                      <div
                        key={r.roomId}
                        onClick={() => {
                          setShowRoomModal(false);
                          if (onSwitchRoom) onSwitchRoom(r.roomId);
                        }}
                        className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition ${
                          r.roomId === roomId
                            ? 'bg-indigo-950/80 border-indigo-500/50 text-indigo-200'
                            : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">{r.roomId}</span>
                          <span className="text-[10px] text-slate-500">({r.roomName})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                            {r.playerCount}/8 人
                          </span>
                          {r.roomId === roomId && (
                            <span className="text-[10px] text-amber-400 font-bold">当前</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Feedback */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-12 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900/95 border border-emerald-500/50 text-emerald-300 text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 pointer-events-none"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
