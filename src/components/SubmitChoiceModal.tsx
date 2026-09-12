import React from 'react';
import { Sparkles, ArrowRight, Home, X, Layers, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Card, SpecialHandType } from '../types';
import { evaluateHand, HAND_TYPE_CN, SPECIAL_HAND_CN } from '../gameLogic';
import { triggerHaptic } from '../lib/haptics';

interface SubmitChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (action: 'reveal' | 'quick_next' | 'exit') => void;
  carriageIndex: number;
  seatIndex?: number;
  roundIndex?: number;
  mode?: 'vs_ai_8p' | 'realtime' | 'reservation' | 'practice';
  front: Card[];
  mid: Card[];
  back: Card[];
  specialHand: SpecialHandType | null;
  useSpecialHand: boolean;
  onToggleSpecialHand?: () => void;
}

export function SubmitChoiceModal({
  isOpen,
  onClose,
  onConfirm,
  carriageIndex,
  seatIndex = 0,
  roundIndex,
  mode,
  front,
  mid,
  back,
  specialHand,
  useSpecialHand,
  onToggleSpecialHand
}: SubmitChoiceModalProps) {
  if (!isOpen) return null;

  const isSpecial = useSpecialHand && specialHand;
  const fEval = !isSpecial && front.length === 3 ? evaluateHand(front, 'front') : null;
  const mEval = !isSpecial && mid.length === 5 ? evaluateHand(mid, 'middle') : null;
  const bEval = !isSpecial && back.length === 5 ? evaluateHand(back, 'back') : null;

  const handleReveal = () => {
    triggerHaptic('success');
    onConfirm('reveal');
  };

  const handleQuickNext = () => {
    triggerHaptic('medium');
    onConfirm('quick_next');
  };

  const handleExit = () => {
    triggerHaptic('light');
    onConfirm('exit');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">确认提交牌型</h3>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span>{mode === 'reservation' ? '📅 预约场' : mode === 'realtime' ? '⚡ 实时对战场' : '八人巅峰场'}</span>
                <span>•</span>
                <span>第 <span className="text-amber-400 font-bold font-mono">{carriageIndex}</span> 局</span>
                <span>•</span>
                <span className="text-amber-300 font-bold font-mono bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-500/40 text-[11px]">
                  {seatIndex + 1}号座位
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hand Arrangement Summary */}
        <div className="p-5 space-y-4">
          {/* ⚠️ Special Hand Missed Warning */}
          {specialHand && !useSpecialHand && (
            <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-2xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs font-black text-amber-300">
                  检测到特殊牌型：【{SPECIAL_HAND_CN[specialHand].name}】(+{SPECIAL_HAND_CN[specialHand].points}水)
                </div>
                <div className="text-[11px] text-amber-200/80 mt-0.5">
                  您当前未选用特殊牌型，确定以普通三墩方式比牌吗？
                </div>
                {onToggleSpecialHand && (
                  <button
                    onClick={() => {
                      triggerHaptic('success');
                      onToggleSpecialHand();
                    }}
                    className="mt-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg transition active:scale-95 flex items-center gap-1 shadow"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>改用特殊牌型提交 (+{SPECIAL_HAND_CN[specialHand].points}水)</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 space-y-2.5">
            <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>本局理牌概览：</span>
            </div>

            {isSpecial ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center">
                <div className="text-sm font-black text-amber-300">
                  🌟 特殊牌型: {SPECIAL_HAND_CN[specialHand].name}
                </div>
                <div className="text-xs text-amber-400/80 mt-0.5">
                  加算底分: +{SPECIAL_HAND_CN[specialHand].points} 水 (免常规比牌)
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-medium mb-1">前墩 (3张)</div>
                  <div className="font-bold text-amber-300 truncate">
                    {fEval ? HAND_TYPE_CN[fEval.type] : '-'}
                  </div>
                  {fEval?.bonusPoints ? (
                    <div className="text-[10px] text-emerald-400 font-bold mt-0.5">
                      +{fEval.bonusPoints}水
                    </div>
                  ) : null}
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-medium mb-1">中墩 (5张)</div>
                  <div className="font-bold text-amber-300 truncate">
                    {mEval ? HAND_TYPE_CN[mEval.type] : '-'}
                  </div>
                  {mEval?.bonusPoints ? (
                    <div className="text-[10px] text-emerald-400 font-bold mt-0.5">
                      +{mEval.bonusPoints}水
                    </div>
                  ) : null}
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-medium mb-1">后墩 (5张)</div>
                  <div className="font-bold text-amber-300 truncate">
                    {bEval ? HAND_TYPE_CN[bEval.type] : '-'}
                  </div>
                  {bEval?.bonusPoints ? (
                    <div className="text-[10px] text-emerald-400 font-bold mt-0.5">
                      +{bEval.bonusPoints}水
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {/* Two Prominent Choices */}
          <div className="space-y-3 pt-1">
            <div className="text-xs text-slate-400 font-medium text-center">
              请选择提交后的后续操作：
            </div>

            {mode === 'reservation' ? (
              <>
                {/* Reservation Mode Choice 1: Submit & Pick Seat for Next Round */}
                <button
                  id="btn-submit-and-select-seat"
                  onClick={handleQuickNext}
                  className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:to-red-400 text-slate-950 font-black flex items-center justify-between shadow-lg shadow-orange-500/20 transition active:scale-[0.98] cursor-pointer group"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-9 h-9 rounded-xl bg-slate-950/20 flex items-center justify-center text-slate-950 shrink-0 group-hover:scale-105 transition">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-950">提交并选择位置进入下一局</div>
                      <div className="text-[11px] text-slate-900/85 font-bold">
                        保存本局({seatIndex + 1}号位)理牌，选座进入第 {carriageIndex + 1} 局继续对局
                      </div>
                    </div>
                  </div>
                  <Sparkles className="w-4 h-4 text-slate-950 shrink-0" />
                </button>

                {/* Reservation Mode Choice 2: Submit & Finish Game (Return to Lobby) */}
                <button
                  id="btn-confirm-submit-and-exit"
                  onClick={handleExit}
                  className="w-full p-3 rounded-2xl bg-slate-800/90 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold flex items-center justify-between transition active:scale-[0.98] cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-8 h-8 rounded-xl bg-slate-700/60 flex items-center justify-center text-slate-300 shrink-0">
                      <Home className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">提交并结束游戏</div>
                      <div className="text-[10px] text-slate-400">
                        保存本局({seatIndex + 1}号位)战绩记录，结束牌局返回大厅
                      </div>
                    </div>
                  </div>
                </button>

                {/* Optional: Showdown Reveal */}
                <button
                  id="btn-confirm-submit-reveal"
                  onClick={handleReveal}
                  className="w-full p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-300 font-medium flex items-center justify-between transition active:scale-[0.98] cursor-pointer"
                >
                  <span className="text-xs">观看本局全员比牌与结算揭晓 (可选)</span>
                  <span className="text-[10px] text-slate-500">揭晓三墩</span>
                </button>
              </>
            ) : (
              <>
                {/* Normal Mode Choice 1: Confirm & Reveal Showdown */}
                <button
                  id="btn-confirm-submit-reveal"
                  onClick={handleReveal}
                  className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:to-red-400 text-slate-950 font-black flex items-center justify-between shadow-lg shadow-orange-500/20 transition active:scale-[0.98] cursor-pointer group"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-9 h-9 rounded-xl bg-slate-950/20 flex items-center justify-center text-slate-950 shrink-0 group-hover:scale-105 transition">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-950">确认交牌 · 揭晓比牌 (推荐)</div>
                      <div className="text-[11px] text-slate-900/80 font-bold">
                        揭晓全员三墩、打枪全垒打与总水数，再进入下局发牌
                      </div>
                    </div>
                  </div>
                  <Sparkles className="w-4 h-4 text-slate-950 shrink-0" />
                </button>

                {/* Normal Mode Choice 2: Quick Next */}
                <button
                  id="btn-quick-next"
                  onClick={handleQuickNext}
                  className="w-full p-3 rounded-2xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-bold flex items-center justify-between transition active:scale-[0.98] cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-300 shrink-0">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">直接交牌并进入下一局</div>
                      <div className="text-[10px] text-blue-300/80">跳过比牌动画，极速开下一局</div>
                    </div>
                  </div>
                </button>

                {/* Normal Mode Choice 3: Submit & Finish Game */}
                <button
                  id="btn-confirm-submit-and-exit"
                  onClick={handleExit}
                  className="w-full p-3 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700/80 text-slate-200 font-bold flex items-center justify-between transition active:scale-[0.98] cursor-pointer group hover:border-slate-600"
                >
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-8 h-8 rounded-xl bg-slate-700/60 flex items-center justify-center text-slate-300 shrink-0 group-hover:bg-slate-600 transition">
                      <Home className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-white">交牌结算 · 结束游戏返回大厅</div>
                      <div className="text-[10px] text-slate-400">完成本局比牌计分与历史记录，退出并返回游戏大厅</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white transition" />
                </button>
              </>
            )}
          </div>

          {/* Cancel Button */}
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onClose();
              }}
              className="text-xs text-slate-400 hover:text-slate-200 transition py-1 px-4 rounded-lg hover:bg-slate-800"
            >
              返回继续调整手牌
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
