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
}

export function CarriageHeaderBar({
  mode = 'vs_ai_8p',
  currentCarriageIndex,
  seatIndex,
  submissions = {},
  onSeatChange,
  stats,
  onOpenHub
}: CarriageHeaderBarProps) {
  const is8P = mode === 'vs_ai_8p';
  const totalSeats = is8P ? 8 : 4;
  const seatsList = Array.from({ length: totalSeats }, (_, i) => i);
  const occupiedCount = Object.keys(submissions).length;
  const remainingSeats = Math.max(0, totalSeats - occupiedCount);
  const isFull = remainingSeats === 0;

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-3 animate-in fade-in duration-300">
      
      {/* Left: Round & Mode Info */}
      <div className="flex items-center gap-3 w-full lg:w-auto">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md shrink-0 font-black text-xl ${
          is8P 
            ? 'bg-gradient-to-tr from-amber-500 to-red-600 shadow-red-500/20' 
            : 'bg-gradient-to-tr from-blue-500 to-indigo-600 shadow-blue-500/20'
        }`}>
          {totalSeats}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-white tracking-wide flex items-center gap-1.5">
              {is8P ? '八人场' : '四人场'} • 第 <span className="text-amber-400 font-mono text-lg">{currentCarriageIndex}</span> 局
            </h2>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
              isFull
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            }`}>
              {isFull ? `🔴 满座 (0/${totalSeats})` : `🟢 剩余位置: ${remainingSeats}/${totalSeats}`}
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            提交理牌后自动进入下一局
          </div>
        </div>
      </div>

      {/* Center: Seat Position Picker */}
      <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 lg:pb-0">
        <span className="text-xs font-bold text-slate-400 shrink-0 mr-1 flex items-center gap-1">
          手牌位置:
        </span>
        {seatsList.map(seat => {
          const isSelected = seat === seatIndex;
          const isOccupied = !!submissions[seat] && !isSelected;
          const occupantName = submissions[seat]?.playerName;

          return (
            <button
              key={seat}
              disabled={isOccupied}
              onClick={() => onSeatChange(seat)}
              title={isOccupied ? `该位置已被玩家 [${occupantName}] 占领` : isSelected ? '当前选择的位置' : '点击切换此位置'}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 flex items-center gap-1 ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 scale-105'
                  : isOccupied
                  ? 'bg-slate-800/40 text-slate-500 cursor-not-allowed border border-slate-750 opacity-60'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              {isOccupied ? (
                <Lock className="w-3 h-3 text-slate-500" />
              ) : isSelected ? (
                <UserCheck className="w-3 h-3 text-slate-950" />
              ) : null}
              <span>{seat + 1}号{isOccupied ? ' (已占)' : isSelected ? ' (我)' : ' (空位)'}</span>
            </button>
          );
        })}
      </div>

      {/* Right: History Hub Button */}
      <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end shrink-0">
        <button
          onClick={onOpenHub}
          className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shadow"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          战绩记录 <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
}
