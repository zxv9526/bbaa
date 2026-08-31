import React from 'react';
import { Sparkles, ChevronRight, Users, Coins, ArrowLeft } from 'lucide-react';
import { CarriagePoolStats, CarriageSubmission } from '../lib/carriageManager';

interface CarriageHeaderBarProps {
  mode?: 'vs_ai_4p' | 'vs_ai_8p';
  currentCarriageIndex: number;
  seatIndex?: number;
  submissions?: { [seatIndex: number]: CarriageSubmission };
  onSeatChange?: (seat: number) => void;
  stats?: CarriagePoolStats;
  onOpenHub: () => void;
  points?: number;
}

export function CarriageHeaderBar({
  mode = 'vs_ai_8p',
  currentCarriageIndex,
  seatIndex = 0,
  submissions = {},
  onSeatChange,
  stats,
  onOpenHub,
  points = 0
}: CarriageHeaderBarProps) {
  const is8P = mode === 'vs_ai_8p';
  const totalSeats = is8P ? 8 : 4;
  
  // 👥 计算实际在席人数与比例 (例如 1/8, 4/8, 1/4)
  const otherOccupiedCount = Object.keys(submissions).filter(s => Number(s) !== seatIndex).length;
  const seatedCount = Math.min(totalSeats, 1 + otherOccupiedCount);
  const isFull = seatedCount >= totalSeats;

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl px-3 sm:px-4 py-2 shadow-md flex items-center justify-between gap-2 animate-in fade-in duration-200">
      
      {/* Left: Mode & Round & In-Seat Ratio (1/8 或 1/4) */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 font-black text-xs sm:text-sm ${
          is8P 
            ? 'bg-gradient-to-tr from-amber-500 to-red-600' 
            : 'bg-gradient-to-tr from-blue-500 to-indigo-600'
        }`}>
          {totalSeats}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-black text-white whitespace-nowrap">
            {is8P ? '八人场' : '四人场'} · 第<span className="text-amber-400 font-mono px-0.5">{currentCarriageIndex}</span>局
          </span>
          
          {/* 👥 人数比例徽章 (1/8 或 更多) */}
          <div className={`flex items-center gap-1 text-xs font-black px-2.5 py-0.5 rounded-full border whitespace-nowrap ${
            isFull
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          }`}>
            <Users className="w-3 h-3 text-emerald-400" />
            <span className="font-mono">{seatedCount}/{totalSeats}</span>
          </div>
        </div>
      </div>

      {/* Right: Prominent Points Display (积分) & Hub Button */}
      <div className="flex items-center gap-2 shrink-0">
        {/* 🪙 积分显示 (原座位号位置改为显著积分) */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 shadow-sm">
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-amber-400/80 font-bold hidden xs:inline">积分</span>
          <span className="text-xs sm:text-sm font-black font-mono tracking-tight text-amber-300">
            {points.toLocaleString()}
          </span>
        </div>

        {/* 战绩记录入口 */}
        <button
          onClick={onOpenHub}
          className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1 shrink-0 active:scale-95 shadow cursor-pointer"
          title="查看本局与历史战绩"
        >
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span className="hidden xs:inline">记录</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
        </button>
      </div>

    </div>
  );
}

