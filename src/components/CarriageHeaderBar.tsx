import React, { useState, useEffect } from 'react';
import { Sparkles, ChevronRight, Users, Coins, ArrowLeft, MessageSquare, Mic, Volume2 } from 'lucide-react';
import { CarriagePoolStats, CarriageSubmission } from '../lib/carriageManager';
import { ChatMessage } from '../types';

interface CarriageHeaderBarProps {
  mode?: 'vs_ai_4p' | 'vs_ai_8p';
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
  mode = 'vs_ai_8p',
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
  const is8P = true;
  const totalSeats = 8;
  
  // 👥 计算实际在席人数与比例
  const otherOccupiedCount = Object.keys(submissions).filter(s => Number(s) !== seatIndex).length;
  const seatedCount = Math.min(totalSeats, 1 + otherOccupiedCount);
  const isFull = seatedCount >= totalSeats;

  // Track recent speech bubble to anchor to player avatar
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [speakerSnippet, setSpeakerSnippet] = useState<string | null>(null);

  useEffect(() => {
    if (latestMessage && Date.now() - latestMessage.timestamp < 5000) {
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
  }, [latestMessage]);

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

          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 font-black text-xs sm:text-sm bg-gradient-to-tr from-amber-500 to-red-600">
            8
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-xs sm:text-sm font-black text-white whitespace-nowrap">
              八人巅峰场 · 第<span className="text-amber-400 font-mono px-0.5">{currentCarriageIndex}</span>局
            </span>
            
            {/* 👥 人数比例徽章 */}
            <div className={`hidden xs:flex items-center gap-1 text-[11px] sm:text-xs font-black px-2 py-0.5 rounded-full border whitespace-nowrap ${
              isFull
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            }`}>
              <Users className="w-3 h-3 text-emerald-400" />
              <span className="font-mono">{seatedCount}/{totalSeats}</span>
            </div>
          </div>
        </div>

        {/* Right: Points, Chat & Hub Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* 🪙 积分显示 */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 shadow-sm">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs sm:text-sm font-black font-mono tracking-tight text-amber-300">
              {points.toLocaleString()}
            </span>
          </div>

          {/* 💬 牌桌对讲 (Integrated Chat Trigger) */}
          <button
            id="btn-carriage-chat"
            onClick={onOpenChat}
            className="relative px-2.5 sm:px-3 py-1 rounded-xl bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-300 hover:text-white border border-indigo-500/40 text-xs font-bold transition flex items-center gap-1.5 shrink-0 active:scale-95 shadow cursor-pointer group"
            title="打开牌桌语音与文字对讲"
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition" />
            <span className="hidden xs:inline font-black">对讲</span>
            {unreadChatCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute -top-0.5 -right-0.5" />
            )}
          </button>

          {/* 战绩记录入口 */}
          <button
            onClick={onOpenHub}
            className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1 shrink-0 active:scale-95 shadow cursor-pointer"
            title="查看本局与历史战绩"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">记录</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
          </button>
        </div>
      </div>

      {/* 2. 8-Seat Live Table Strip (八人同台席位与动态语音气泡) */}
      <div className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl px-2 py-1 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar shadow-inner">
        {Array.from({ length: 8 }).map((_, s) => {
          const isUser = s === seatIndex;
          const sub = submissions[s];
          const playerObj = players[s];
          const avatar = isUser ? '😎' : sub ? sub.avatar : playerObj ? playerObj.avatar : ['🦁', '🐯', '🐲', '🦊', '🐰', '🐼', '🦅', '🐟'][s];
          const name = isUser ? '我' : sub ? sub.playerName : playerObj ? playerObj.name : `玩家${s + 1}`;
          const isSpeaking = activeSpeakerId && (
            (isUser && activeSpeakerId.includes('player_user')) ||
            (!isUser && playerObj && playerObj.id === activeSpeakerId) ||
            (!isUser && sub && sub.playerId === activeSpeakerId)
          );

          return (
            <div
              key={s}
              onClick={onOpenChat}
              className={`relative flex-1 min-w-[38px] max-w-[90px] flex flex-col items-center justify-center py-0.5 px-1 rounded-lg transition-all cursor-pointer group ${
                isUser
                  ? 'bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold'
                  : sub
                  ? 'bg-slate-900/90 border border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:border-indigo-500/30'
              }`}
              title={`${s + 1}号位: ${name} (点击对讲)`}
            >
              {/* Floating speech bubble over active speaker */}
              {isSpeaking && speakerSnippet && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-30 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg border border-indigo-400 whitespace-nowrap animate-bounce">
                  {speakerSnippet.length > 8 ? speakerSnippet.slice(0, 8) + '…' : speakerSnippet}
                </div>
              )}

              <div className="flex items-center gap-1">
                <span className="text-xs group-hover:scale-110 transition">{avatar}</span>
                <span className="text-[10px] font-mono opacity-60">#{s + 1}</span>
              </div>
              <span className="text-[9px] sm:text-[10px] truncate max-w-full leading-tight font-medium">
                {name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

