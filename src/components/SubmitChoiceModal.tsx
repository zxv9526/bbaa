import React from 'react';
import { Sparkles, ArrowRight, Home, X, Layers, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Card, SpecialHandType } from '../types';
import { evaluateHand, HAND_TYPE_CN, SPECIAL_HAND_CN } from '../gameLogic';
import { triggerHaptic } from '../lib/haptics';

interface SubmitChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (advanceToNext: boolean) => void;
  carriageIndex: number;
  mode?: 'vs_ai_8p' | 'vs_ai_4p';
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

  const handleNext = () => {
    triggerHaptic('success');
    onConfirm(true);
  };

  const handleExit = () => {
    triggerHaptic('medium');
    onConfirm(false);
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
              <p className="text-xs text-slate-400">
                八人巅峰场 • 第 <span className="text-amber-400 font-bold font-mono">{carriageIndex}</span> 局
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

            {/* Choice 1: Submit & Advance to Next Round */}
            <button
              id="btn-confirm-submit-and-next"
              onClick={handleNext}
              className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black flex items-center justify-between shadow-lg shadow-emerald-500/20 transition active:scale-[0.98] cursor-pointer group"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition">
                  <ArrowRight className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-white">提交并进入下一局</div>
                  <div className="text-[11px] text-emerald-100/90 font-normal">
                    结算本局得分，并立即自动发牌进入第 {carriageIndex + 1} 局
                  </div>
                </div>
              </div>
              <Sparkles className="w-4 h-4 text-emerald-200 shrink-0" />
            </button>

            {/* Choice 2: Submit & Finish Game (Return to Lobby) */}
            <button
              id="btn-confirm-submit-and-exit"
              onClick={handleExit}
              className="w-full p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-amber-500/50 text-slate-200 font-black flex items-center justify-between shadow-md transition active:scale-[0.98] cursor-pointer group"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition">
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-amber-300">提交后结束游戏</div>
                  <div className="text-[11px] text-slate-400 font-normal">
                    结算本局积分并直接返回游戏大厅
                  </div>
                </div>
              </div>
            </button>
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
