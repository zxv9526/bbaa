import React from 'react';
import { RotateCcw, Wand2, ArrowLeft, Coins, Sparkles, HelpCircle } from 'lucide-react';

interface PracticeHeaderBarProps {
  onDealNewHand: () => void;
  onOpenSpecialLab: () => void;
  onExit: () => void;
  points: number;
}

export function PracticeHeaderBar({
  onDealNewHand,
  onOpenSpecialLab,
  onExit,
  points = 0
}: PracticeHeaderBarProps) {
  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl px-3 sm:px-4 py-2 shadow-md flex items-center justify-between gap-2 animate-in fade-in duration-200">
      
      {/* Left: Mode Badge & Title (Matches real mode 4P/8P header) */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 font-black text-xs sm:text-sm bg-gradient-to-tr from-emerald-500 to-teal-600">
          🎮
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-black text-white whitespace-nowrap">
            试玩练习场 · <span className="text-emerald-400">4人模拟对局</span>
          </span>
          
          <div className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
            <span>零门槛 · 纯模拟演练</span>
          </div>
        </div>
      </div>

      {/* Right: Quick Tools, Points & Exit */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* 重新发牌 */}
        <button
          onClick={onDealNewHand}
          className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1 shrink-0 active:scale-95 shadow cursor-pointer"
          title="重新发一副全新手牌"
        >
          <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden xs:inline">重新发牌</span>
        </button>

        {/* 特殊牌型测试 */}
        <button
          onClick={onOpenSpecialLab}
          className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1 shrink-0 active:scale-95 shadow cursor-pointer"
          title="体验至尊青龙、一条龙等特殊牌型"
        >
          <Wand2 className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden xs:inline">牌型测试</span>
        </button>

        {/* 积分说明显示 (原位置对应真实积分，但注明免扣) */}
        <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 shadow-sm" title="练习模式不消耗任何积分">
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-amber-400/80 font-bold hidden xs:inline">积分</span>
          <span className="text-xs sm:text-sm font-black font-mono tracking-tight text-amber-300">
            {points.toLocaleString()}
          </span>
          <span className="text-[10px] text-emerald-400 font-bold hidden sm:inline ml-0.5">(免扣)</span>
        </div>

        {/* 退出试玩，返回大厅 */}
        <button
          onClick={onExit}
          className="px-2.5 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition flex items-center gap-1 shrink-0 active:scale-95 shadow cursor-pointer"
          title="退出试玩，返回大厅"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden xs:inline">返回大厅</span>
        </button>
      </div>

    </div>
  );
}
