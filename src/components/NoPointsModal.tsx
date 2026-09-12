import React, { useState } from 'react';
import { X, Coins, ArrowRight, AlertCircle, Gift, Sparkles } from 'lucide-react';
import { canClaimDailyRelief, claimDailyRelief } from '../lib/accountManager';
import { triggerHaptic } from '../lib/haptics';
import confetti from 'canvas-confetti';

interface NoPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPoints: () => void;
  currentPoints: number;
  onPointsClaimed?: () => void;
}

export function NoPointsModal({
  isOpen,
  onClose,
  onOpenPoints,
  currentPoints,
  onPointsClaimed
}: NoPointsModalProps) {
  const [reliefMsg, setReliefMsg] = useState<string>('');
  if (!isOpen) return null;

  const eligibleForRelief = canClaimDailyRelief();

  const handleClaim = () => {
    const res = claimDailyRelief();
    setReliefMsg(res.message);
    if (res.success) {
      triggerHaptic('success');
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.5 } });
      if (onPointsClaimed) {
        onPointsClaimed();
      }
    } else {
      triggerHaptic('error');
    }
  };

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

          {reliefMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold leading-relaxed animate-in fade-in">
              {reliefMsg}
            </div>
          )}

          {/* Daily Relief Option */}
          {eligibleForRelief && !reliefMsg && (
            <div
              onClick={handleClaim}
              className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 border-2 border-emerald-500/50 hover:border-emerald-400 rounded-2xl p-4 flex items-center justify-between gap-3 cursor-pointer transition shadow-lg shadow-emerald-950/40 group active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl font-bold shrink-0 group-hover:scale-110 transition">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-white flex items-center gap-1.5">
                    <span>领取今日破产救济金 (+1,000分)</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-xs text-emerald-200/80 mt-0.5">
                    每日免费 1 次，即刻补充筹码重返巅峰赛场
                  </div>
                </div>
              </div>
              <button className="px-3.5 py-1.5 rounded-xl bg-emerald-600 group-hover:bg-emerald-500 text-white font-black text-xs transition shadow shrink-0">
                立即领取
              </button>
            </div>
          )}

          {/* Solutions */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-slate-400">获取更多积分：</div>

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
