import React from 'react';
import { HandEvaluation } from '../types';
import { HAND_TYPE_CN } from '../gameLogic';

interface HandSummaryProps {
  front?: HandEvaluation | null;
  middle?: HandEvaluation | null;
  back?: HandEvaluation | null;
  isDaoShui?: boolean;
}

export function HandSummary({ front, middle, back, isDaoShui }: HandSummaryProps) {
  if (!front && !middle && !back) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
      {front && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <span className="font-semibold text-slate-500">前墩:</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{HAND_TYPE_CN[front.type] || front.type}</span>
          {front.bonusPoints ? (
            <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 font-bold px-1.5 py-0.5 rounded">
              +{front.bonusPoints}
            </span>
          ) : null}
        </div>
      )}

      {middle && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <span className="font-semibold text-slate-500">中墩:</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{HAND_TYPE_CN[middle.type] || middle.type}</span>
          {middle.bonusPoints ? (
            <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 font-bold px-1.5 py-0.5 rounded">
              +{middle.bonusPoints}
            </span>
          ) : null}
        </div>
      )}

      {back && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <span className="font-semibold text-slate-500">后墩:</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{HAND_TYPE_CN[back.type] || back.type}</span>
          {back.bonusPoints ? (
            <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 font-bold px-1.5 py-0.5 rounded">
              +{back.bonusPoints}
            </span>
          ) : null}
        </div>
      )}

      {isDaoShui && (
        <div className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 border border-rose-200 font-bold flex items-center gap-1">
          ⚠️ 违规倒水 (后墩 &lt; 中墩 或 中墩 &lt; 前墩)
        </div>
      )}
    </div>
  );
}
