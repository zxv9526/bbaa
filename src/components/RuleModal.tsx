import React from 'react';
import { BookOpen, X, Trophy, AlertCircle, Sparkles, CheckCircle } from 'lucide-react';
import { SPECIAL_HAND_CN } from '../gameLogic';
import { SpecialHandType } from '../types';

interface RuleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RuleModal({ isOpen, onClose }: RuleModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">十三水 (Chinese Poker) 规则与计分</h3>
              <p className="text-xs text-slate-500">前墩三张 · 中墩五张 · 后墩五张</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 dark:text-slate-300">
          {/* 基本理牌规则 */}
          <section className="space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-base">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              1. 基础摆牌与倒水规则
            </h4>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              每位玩家分得 13 张扑克牌，需将其分成三墩：
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border">
                <div className="font-bold text-blue-600">前墩 (Head)</div>
                <div className="text-slate-500 mt-0.5">3 张牌</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border">
                <div className="font-bold text-indigo-600">中墩 (Middle)</div>
                <div className="text-slate-500 mt-0.5">5 张牌</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border">
                <div className="font-bold text-purple-600">后墩 (Back)</div>
                <div className="text-slate-500 mt-0.5">5 张牌</div>
              </div>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>严禁“倒水 / 倒道”：</strong>牌力大小必须满足：
                <span className="font-bold font-mono"> 后墩 ≥ 中墩 ≥ 前墩</span>。
                若违反倒水规则，将直接判负并向场上其他玩家赔付打枪分！
              </div>
            </div>
          </section>

          {/* 牌型大小与喜分加分 */}
          <section className="space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-base">
              <Trophy className="w-4 h-4 text-amber-500" />
              2. 常见牌型大小关系与墩位喜分
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              五条 (八人双副牌) &gt; 同花顺 &gt; 铁支 (四条) &gt; 葫芦 (三带二) &gt; 同花 &gt; 顺子 &gt; 三条 &gt; 两对 &gt; 一对 &gt; 乌龙 (单张高牌)。
            </p>
            <div className="text-xs bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div>• <strong>点数大小：</strong>A &gt; K &gt; Q &gt; J &gt; 10 &gt; 9 &gt; 8 &gt; 7 &gt; 6 &gt; 5 &gt; 4 &gt; 3 &gt; 2</div>
              <div>• <strong>花色大小：</strong>黑桃 ♠ &gt; 红桃 ♥ &gt; 梅花 ♣ &gt; 方块 ♦</div>
              <div className="pt-1 border-t border-slate-200 dark:border-slate-700">
                <span className="font-bold text-amber-600 dark:text-amber-400">✨ 墩位喜分奖励 (获胜额外计水)：</span>
                <div className="grid grid-cols-2 gap-1 mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                  <div>• 前墩三条：+3 水</div>
                  <div>• 中墩葫芦：+2 水</div>
                  <div>• 铁支：中墩+8水 / 后墩+4水</div>
                  <div>• 同花顺：中墩+10水 / 后墩+5水</div>
                  <div>• 五条：中墩+16水 / 后墩+8水</div>
                  <div>• 打枪：总得分翻倍 (+3水)</div>
                </div>
              </div>
            </div>
          </section>

          {/* 打枪与全垒打 */}
          <section className="space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              3. 打枪 (Gun) 与 全垒打 (Home Run)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 rounded-xl space-y-1">
                <div className="font-bold text-indigo-800 dark:text-indigo-300">💥 打枪 (Gun)</div>
                <p className="text-slate-600 dark:text-slate-400">
                  若一名玩家在 前、中、后 三墩全部战胜某一对手，触发“打枪”，对该对手的得分翻倍（+3分及翻倍计分）。
                </p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl space-y-1">
                <div className="font-bold text-amber-800 dark:text-amber-300">👑 全垒打 (Home Run)</div>
                <p className="text-slate-600 dark:text-slate-400">
                  在四人局中，若一名玩家同时打枪了其余全部 3 位对手，达成“全垒打”，本局总获胜积分再翻倍！
                </p>
              </div>
            </div>
          </section>

          {/* 特殊牌型表格 */}
          <section className="space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-orange-500" />
              4. 特殊牌型加分表 (免比直接胜出)
            </h4>
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="p-2">牌型名称</th>
                    <th className="p-2">基础加分</th>
                    <th className="p-2">特征说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {(Object.keys(SPECIAL_HAND_CN) as SpecialHandType[]).map(key => {
                    const item = SPECIAL_HAND_CN[key];
                    return (
                      <tr key={key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-2 font-bold text-orange-600">{item.name}</td>
                        <td className="p-2 font-bold text-amber-600">+{item.points}</td>
                        <td className="p-2 text-slate-500">{item.desc}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition text-xs"
          >
            我已知晓
          </button>
        </div>
      </div>
    </div>
  );
}
