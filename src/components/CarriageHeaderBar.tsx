import React from 'react';
import { Train, Layers, Sparkles, ChevronRight, Zap, RefreshCw } from 'lucide-react';
import { CarriagePoolStats } from '../lib/carriageManager';

interface CarriageHeaderBarProps {
  currentCarriageIndex: number;
  seatIndex: number;
  onSeatChange: (seat: number) => void;
  stats: CarriagePoolStats;
  onOpenHub: () => void;
}

export function CarriageHeaderBar({
  currentCarriageIndex,
  seatIndex,
  onSeatChange,
  stats,
  onOpenHub
}: CarriageHeaderBarProps) {
  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-3 animate-in fade-in duration-300">
      
      {/* Left: Carriage Train Info */}
      <div className="flex items-center gap-3 w-full md:w-auto">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
          <Train className="w-5 h-5 animate-pulse" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-white tracking-wide flex items-center gap-1.5">
              第 <span className="text-amber-400 font-mono text-lg">{currentCarriageIndex}</span> 节车厢
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-bold">
              8人预发牌异步模式
            </span>
          </div>

          <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
            <span>提交即自动无缝进入第 <strong className="text-slate-200">{currentCarriageIndex + 1}</strong> 节车厢</span>
          </div>
        </div>
      </div>

      {/* Center: Seat Position Picker */}
      <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 md:pb-0">
        <span className="text-xs font-bold text-slate-400 shrink-0 mr-1 flex items-center gap-1">
          手牌位置:
        </span>
        {[0, 1, 2, 3, 4, 5, 6, 7].map(seat => {
          const isSelected = seat === seatIndex;
          return (
            <button
              key={seat}
              onClick={() => onSeatChange(seat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 flex items-center gap-1 ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 scale-105'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-750'
              }`}
            >
              <span>{seat + 1}号</span>
            </button>
          );
        })}
      </div>

      {/* Right: Pre-generated Stock Counter & Station Hub Button */}
      <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end shrink-0">
        <div className="bg-slate-800/60 border border-slate-750 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs">
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-slate-400">预存:</span>
          <span className="font-bold text-white font-mono">{stats.unclaimedCount}/300</span>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
            自动补满
          </span>
        </div>

        <button
          onClick={onOpenHub}
          className="px-3.5 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shadow"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          车厢中心 <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
}
