import React from 'react';
import { X, ShieldAlert, GraduationCap, Coins, ArrowRight, BookOpen, AlertCircle } from 'lucide-react';

interface NoPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPoints: () => void;
  currentPoints: number;
}

export function NoPointsModal({
  isOpen,
  onClose,
  onOpenPoints,
  currentPoints
}: NoPointsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center text-xl font-bold shadow-inner">
              🚫
            </div>
            <div>
              <h3 className="font-black text-lg text-white">积分不足 · 无法进入牌局</h3>
              <p className="text-xs text-slate-400">场次实行真实水数积分对决结算</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Current Points Display */}
          <div className="bg-gradient-to-br from-rose-950/40 via-slate-950 to-slate-900 border border-rose-500/30 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Coins className="w-5 h-5 text-amber-400" />
              <span className="text-xs sm:text-sm text-slate-300 font-medium">当前账户可用积分:</span>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-black text-rose-400">
              {currentPoints.toLocaleString()} <span className="text-xs font-sans text-slate-400">分</span>
            </div>
          </div>

          {/* Explanation Alert */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs text-slate-300 leading-relaxed">
            <div className="font-bold text-amber-300 flex items-center gap-1.5 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>入场限制规则说明</span>
            </div>
            <p className="text-slate-300">
              十三水对局为<b>真实结算牌局</b>，对局结束时将根据实际胜负道数、喜分及打枪倍率进行严格结算。为维护牌局契约精神与公平竞技环境，<b>积分为 0 或无积分的玩家不允许进入牌局</b>。
            </p>
          </div>

          {/* Solution */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-slate-400">解决方案：</div>

            <div
              onClick={() => {
                onClose();
                onOpenPoints();
              }}
              className="group bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 hover:from-amber-950/70 border border-amber-500/30 hover:border-amber-400 rounded-2xl p-4 flex items-center justify-between gap-3 cursor-pointer transition shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl font-bold shrink-0 group-hover:scale-105 transition">
                  🪙
                </div>
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                    打开积分管理 / 好友赠送
                  </div>
                  <div className="text-xs text-slate-400">
                    可通过 Telegram 充值，或让好友通过手机号向您赠送积分
                  </div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition shrink-0" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm transition cursor-pointer"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
