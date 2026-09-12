import React from 'react';
import { Home, Sparkles, X, Save, ArrowLeft, ShieldAlert } from 'lucide-react';
import { triggerHaptic } from '../lib/haptics';

interface ExitMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  roundIndex: number;
  seatNumber?: number;
  mode?: string;
  onAutoSubmitAndExit: () => void;
  onSaveAndExit: () => void;
}

export function ExitMatchModal({
  isOpen,
  onClose,
  roundIndex,
  seatNumber = 1,
  mode = 'realtime',
  onAutoSubmitAndExit,
  onSaveAndExit
}: ExitMatchModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Home className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">离开对战牌桌</h3>
              <p className="text-xs text-slate-400">
                <span>{mode === 'reservation' ? '📅 预约场' : mode === 'realtime' ? '⚡ 实时对战场' : '八人巅峰场'}</span>
                <span> · 第 <span className="text-amber-400 font-bold">{roundIndex}</span> 局</span>
                <span> · {seatNumber}号座位</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3.5">
          {/* 契约精神提示 */}
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-amber-300/90 text-xs leading-relaxed">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-300">严守契约精神：</span>
              已发牌的对局不可直接作废或弃牌。您可以选择自动交牌结算，或暂存进度随时返回继续。
            </div>
          </div>

          {/* Option 1: Auto-submit and Exit */}
          <button
            id="btn-exit-auto-submit"
            onClick={() => {
              triggerHaptic('success');
              onAutoSubmitAndExit();
            }}
            className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black flex items-center justify-between shadow-lg shadow-emerald-600/20 transition active:scale-[0.98] cursor-pointer group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-950/20 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-black text-white">自动最佳理牌并交牌结算 (推荐)</div>
                <div className="text-[11px] text-emerald-100/90 font-medium mt-0.5">
                  智能选用最优合法牌型交牌比分，记录水数战绩并返回大厅
                </div>
              </div>
            </div>
          </button>

          {/* Option 2: Save Progress & Exit */}
          <button
            id="btn-exit-save-progress"
            onClick={() => {
              triggerHaptic('medium');
              onSaveAndExit();
            }}
            className="w-full p-3 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold flex items-center justify-between transition active:scale-[0.98] cursor-pointer group text-left hover:border-slate-600"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <Save className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-white">暂存当前手牌并返回大厅</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  保持本局契约锁定，再次进入时将强制恢复本副手牌继续
                </div>
              </div>
            </div>
          </button>

          {/* Cancel */}
          <div className="pt-2 text-center">
            <button
              onClick={() => {
                triggerHaptic('light');
                onClose();
              }}
              className="text-xs text-slate-400 hover:text-slate-200 transition py-1.5 px-4 rounded-lg hover:bg-slate-800 cursor-pointer flex items-center gap-1.5 mx-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>留在牌桌，继续理牌</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
