import React, { useState, useEffect } from 'react';
import { Sparkles, ChevronRight, Users, Coins, ArrowLeft, MessageSquare, Mic, VolumeX, Radio } from 'lucide-react';
import { CarriagePoolStats, CarriageSubmission } from '../lib/carriageManager';
import { ChatMessage } from '../types';

interface CarriageHeaderBarProps {
  mode?: 'vs_ai_8p' | 'realtime' | 'reservation';
  currentCarriageIndex: number;
  seatIndex?: number;
  submissions?: { [seatIndex: number]: CarriageSubmission };
  onSeatChange?: (seat: number) => void;
  stats?: CarriagePoolStats;
  onOpenHub: () => void;
  points?: number;
  onOpenChat: () => void;
  unreadChatCount?: number;
  latestMessage?: ChatMessage | null;
  onExit?: () => void;
  players?: { id: string; name: string; avatar: string; isAi: boolean }[];
}

export function CarriageHeaderBar({
  mode = 'realtime',
  currentCarriageIndex,
  seatIndex = 0,
  submissions = {},
  onSeatChange,
  stats,
  onOpenHub,
  points = 0,
  onOpenChat,
  unreadChatCount = 0,
  latestMessage,
  onExit,
  players = []
}: CarriageHeaderBarProps) {
  const totalSeats = 8;
  const isReservation = mode === 'reservation';
  
  // 👥 计算实际在席人数与比例
  const otherOccupiedCount = Object.keys(submissions).filter(s => Number(s) !== seatIndex).length;
  const seatedCount = Math.min(totalSeats, 1 + otherOccupiedCount);
  const isFull = seatedCount >= totalSeats;

  // Track recent speech bubble to anchor to player avatar (only if not reservation mode)
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [speakerSnippet, setSpeakerSnippet] = useState<string | null>(null);

  useEffect(() => {
    if (!isReservation && latestMessage && Date.now() - latestMessage.timestamp < 5000) {
      setActiveSpeakerId(latestMessage.senderId);
      setSpeakerSnippet(
        latestMessage.type === 'voice'
          ? `🎙️ 语音 (${latestMessage.audioDuration || 2}")`
          : latestMessage.type === 'emoji'
          ? latestMessage.content
          : latestMessage.content
      );
      const timer = setTimeout(() => {
        setActiveSpeakerId(null);
        setSpeakerSnippet(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [latestMessage, isReservation]);

  return (
    <div className="w-full flex flex-col gap-1.5 shrink-0 animate-in fade-in duration-200">
      {/* 1. Main Header Control Bar */}
      <div className="w-full bg-slate-900/95 border border-slate-800 rounded-2xl px-2.5 sm:px-4 py-2 shadow-md flex items-center justify-between gap-2">
        
        {/* Left: Exit & Mode info */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {onExit && (
            <button
              onClick={onExit}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              title="返回大厅"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">大厅</span>
            </button>
          )}

          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 font-black text-xs sm:text-sm bg-gradient-to-tr ${
            isReservation ? 'from-blue-600 to-indigo-700' : 'from-amber-500 to-red-600'
          }`}>
            {isReservation ? '📅' : '⚡'}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-xs sm:text-sm font-black text-white whitespace-nowrap">
              {isReservation ? '预约场' : '实时对战场'} · 第<span className="text-amber-400 font-mono px-0.5">{currentCarriageIndex}</span>局
            </span>
            
            {/* Mode badge */}
            {isReservation ? (
              <span className="hidden xs:flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                <VolumeX className="w-3 h-3 text-blue-400" />
                <span>纯净无打扰</span>
              </span>
            ) : (
              <span className="hidden xs:flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                <Radio className="w-3 h-3 text-emerald-400" />
                <span>语音对讲中</span>
              </span>
            )}

            {/* 👥 人数比例徽章 */}
            <div className={`hidden sm:flex items-center gap-1 text-[11px] sm:text-xs font-black px-2 py-0.5 rounded-full border whitespace-nowrap ${
              isFull
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            }`}>
              <Users className="w-3 h-3 text-emerald-400" />
              <span className="font-mono">{seatedCount}/{totalSeats}</span>
            </div>
          </div>
        </div>

        {/* Right: Points & Chat buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* 🪙 积分显示 */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 shadow-sm">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs sm:text-sm font-black font-mono tracking-tight text-amber-300">
              {points.toLocaleString()}
            </span>
          </div>

          {!isReservation && (
            <button
              onClick={onOpenChat}
              className="px-2.5 py-1 rounded-xl bg-indigo-600/90 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-200" />
              <span className="hidden min-[480px]:inline">聊天/对讲</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. 8-Seat Live Table Strip */}
      <div className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl px-2 py-1 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar shadow-inner">
        {Array.from({ length: 8 }).map((_, s) => {
          const isUser = s === seatIndex;
          const sub = submissions[s];
          const playerObj = players[s];
          const avatar = isUser ? '😎' : sub ? sub.avatar : playerObj ? playerObj.avatar : ['🦁', '🐯', '🐲', '🦊', '🐰', '🐼', '🦅', '🐟'][s];
          const name = isUser ? '我' : sub ? sub.playerName : playerObj ? playerObj.name : `玩家${s + 1}`;
          const isSpeaking = !isReservation && activeSpeakerId && (
            (isUser && activeSpeakerId.includes('player_user')) ||
            (!isUser && playerObj && playerObj.id === activeSpeakerId) ||
            (!isUser && sub && sub.playerId === activeSpeakerId)
          );

          return (
            <div
              key={s}
              onClick={() => !isReservation && onOpenChat()}
              className={`relative flex-1 min-w-[38px] max-w-[90px] flex flex-col items-center justify-center py-0.5 px-1 rounded-lg transition-all ${!isReservation ? 'cursor-pointer group' : ''} ${
                isUser
                  ? 'bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold'
                  : sub
                  ? 'bg-slate-900/90 border border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-900/60 border border-slate-800 text-slate-400'
              }`}
              title={`${s + 1}号位: ${name} ${!isReservation ? '(点击对讲)' : '(预约场无对讲)'}`}
            >
              {/* Floating speech bubble over active speaker */}
              {isSpeaking && speakerSnippet && (
                <div className="absolute -top-7 z-20 bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap animate-bounce flex items-center gap-1 border border-emerald-300">
                  <span>{speakerSnippet}</span>
                </div>
              )}

              <div className="text-sm sm:text-base leading-none mb-0.5">{avatar}</div>
              <div className="text-[10px] truncate max-w-full font-medium">
                {isUser ? '我' : name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
