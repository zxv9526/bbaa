import React from 'react';
import { Sparkles, ChevronRight, Lock, UserCheck } from 'lucide-react';
import { CarriagePoolStats, CarriageSubmission } from '../lib/carriageManager';

interface CarriageHeaderBarProps {
  mode?: 'vs_ai_4p' | 'vs_ai_8p';
  currentCarriageIndex: number;
  seatIndex: number;
  submissions?: { [seatIndex: number]: CarriageSubmission };
  onSeatChange: (seat: number) => void;
  stats: CarriagePoolStats;
  onOpenHub: () => void;
  points?: number;
}

export function CarriageHeaderBar({
  mode = 'vs_ai_8p',
  currentCarriageIndex,
  seatIndex,
  submissions = {},
  onSeatChange,
  stats,
  onOpenHub,
  points = 0
}: CarriageHeaderBarProps) {
  const is8P = mode === 'vs_ai_8p';
  const totalSeats = is8P ? 8 : 4;
  const seatsList = Array.from({ length: totalSeats }, (_, i) => i);
  
  // 🪑 计算实际在席人数（当前玩家已就座 + 其他已占座位的玩家）
  const otherOccupiedCount = Object.keys(submissions).filter(s => Number(s) !== seatIndex).length;
  const seatedCount = Math.min(totalSeats, 1 + otherOccupiedCount);
  const remainingSeats = Math.max(0, totalSeats - seatedCount);
  const isFull = remainingSeats === 0;

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl px-2.5 sm:px-3 py-1.5 shadow-md flex items-center justify-between gap-2 animate-in fade-in duration-200">
      
      {/* Left: Mode & Round & Seat Info */}
      <div className="flex items-center gap-2 shrink-0">
        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-white shadow-sm shrink-0 font-black text-xs sm:text-sm ${
          is8P 
            ? 'bg-gradient-to-tr from-amber-500 to-red-600' 
            : 'bg-gradient-to-tr from-blue-500 to-indigo-600'
        }`}>
          {totalSeats}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-xs sm:text-sm font-black text-white whitespace-nowrap">
            {is8P ? '八人场' : '四人场'} · 第<span className="text-amber-400 font-mono px-0.5">{currentCarriageIndex}</span>局
          </span>
          
          {/* 🪑 席位小徽章 */}
          <span className={`text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded-md border whitespace-nowrap hidden xs:inline-flex ${
            isFull
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          }`}>
            🪑{totalSeats}/{seatedCount}
          </span>

          {/* 👤 当前玩家座位 */}
          <span className="text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-300 whitespace-nowrap">
            👤{seatIndex + 1}号位
          </span>

          {/* 🪙 积分 */}
          <span className="text-[10px] sm:text-[11px] font-black px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 whitespace-nowrap hidden sm:inline-flex">
            🪙 {points.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Center/Right: Seat Picker & Hub Button */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1">
          {seatsList.map(seat => {
            const isSelected = seat === seatIndex;
            const isOccupied = !!submissions[seat] && !isSelected;
            const occupantName = submissions[seat]?.playerName;

            return (
              <button
                key={seat}
                disabled={isOccupied}
                onClick={() => onSeatChange(seat)}
                title={isOccupied ? `玩家 [${occupantName}] 已占` : isSelected ? '当前选择的位置' : '切换此位置'}
                className={`px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold transition shrink-0 flex items-center gap-0.5 ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm scale-105'
                    : isOccupied
                    ? 'bg-slate-800/40 text-slate-500 cursor-not-allowed border border-slate-750 opacity-60'
                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                {isOccupied ? (
                  <Lock className="w-2.5 h-2.5 text-slate-500" />
                ) : isSelected ? (
                  <UserCheck className="w-2.5 h-2.5 text-slate-950" />
                ) : null}
                <span>{seat + 1}号</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={onOpenHub}
          className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] sm:text-xs font-bold transition flex items-center gap-0.5 shrink-0 active:scale-95 shadow"
        >
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span className="hidden xs:inline">记录</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
        </button>
      </div>

    </div>
  );
}
