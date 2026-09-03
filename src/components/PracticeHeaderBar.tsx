import React from 'react';
import { RotateCcw, Wand2, ArrowLeft, Coins, Sparkles, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { SpecialHandType } from '../types';
import { SPECIAL_HAND_CN } from '../gameLogic';

interface PracticeHeaderBarProps {
  currentSpecialType: SpecialHandType | null;
  currentIndex: number;
  totalSpecials: number;
  onPrevSpecial: () => void;
  onNextSpecial: () => void;
  onDealNewHand: () => void;
  onOpenSpecialLab: () => void;
  onExit: () => void;
  points: number;
}

export function PracticeHeaderBar({
  currentSpecialType,
  currentIndex = 0,
  totalSpecials = 13,
  onPrevSpecial,
  onNextSpecial,
  onDealNewHand,
  onOpenSpecialLab,
  onExit,
  points = 0
}: PracticeHeaderBarProps) {
  const currentInfo = currentSpecialType ? SPECIAL_HAND_CN[currentSpecialType] : null;

  return (
    <div className="w-full bg-slate-900/95 border border-slate-800 rounded-2xl px-3 sm:px-4 py-2 shadow-md flex flex-wrap items-center justify-between gap-2.5 animate-in fade-in duration-200">
      
      {/* Left: Mode Badge & Title (Matches real mode 4P/8P header) */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 font-black text-xs sm:text-sm bg-gradient-to-tr from-emerald-500 to-teal-600">
          🎮
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-black text-white whitespace-nowrap">
            试玩练习场 · <span className="text-emerald-400">固定特殊牌型特训</span>
          </span>
          
          <div className="hidden md:flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
            <span>零门槛 · 纯模拟比拼</span>
          </div>
        </div>
      </div>

      {/* Middle: Current Fixed Special Hand Stepper & Indicator */}
      {currentInfo && (
        <div className="flex items-center gap-1.5 bg-slate-950/80 border border-amber-500/40 rounded-xl px-2.5 py-1 text-xs shadow-inner">
          <button
            onClick={onPrevSpecial}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition active:scale-90"
            title="切换上一个特殊牌型"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-1.5 cursor-pointer" onClick={onOpenSpecialLab} title="点击打开特殊牌型库">
            <span className="text-amber-400 font-black flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-pulse" />
              <span>{currentInfo.name}</span>
            </span>
            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/30">
              +{currentInfo.points}水
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              ({currentIndex + 1}/{totalSpecials})
            </span>
          </div>

          <button
            onClick={onNextSpecial}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition active:scale-90"
            title="切换下一个特殊牌型"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Right: Quick Tools, Points & Exit */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* 下一牌型 */}
        <button
          onClick={onNextSpecial}
          className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-slate-950 font-black text-xs transition flex items-center gap-1 shrink-0 active:scale-95 shadow cursor-pointer"
          title="直接置入下一个固定特殊牌型"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">换牌型</span>
        </button>

        {/* 特殊牌型库 */}
        <button
          onClick={onOpenSpecialLab}
          className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1 shrink-0 active:scale-95 shadow cursor-pointer"
          title="选择体验至尊青龙、一条龙、三同花顺等13种特殊牌型"
        >
          <Wand2 className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden xs:inline">牌型库</span>
        </button>

        {/* 重新发牌 */}
        <button
          onClick={onDealNewHand}
          className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1 shrink-0 active:scale-95 shadow cursor-pointer"
          title="重新发本局牌"
        >
          <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden xs:inline">重发</span>
        </button>

        {/* 积分说明显示 (原位置对应真实积分，注明免扣) */}
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
          <span className="hidden xs:inline">大厅</span>
        </button>
      </div>

    </div>
  );
}
