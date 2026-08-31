import React from 'react';
import { SpecialHandType } from '../types';
import { SPECIAL_HAND_CN } from '../gameLogic';
import { Sparkles } from 'lucide-react';

interface SpecialHandBannerProps {
  specialHand: SpecialHandType;
  onUseSpecial?: () => void;
  isUsed?: boolean;
}

export function SpecialHandBanner({ specialHand, onUseSpecial, isUsed }: SpecialHandBannerProps) {
  const info = SPECIAL_HAND_CN[specialHand];
  if (!info) return null;

  return (
    <div className="w-full bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-3 py-1.5 rounded-xl shadow-md flex items-center justify-between gap-2 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-lg bg-black/20 backdrop-blur flex items-center justify-center shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-xs sm:text-sm font-black tracking-wide truncate">{info.name}</span>
          <span className="bg-black/40 text-yellow-300 text-[10px] px-1.5 py-0.2 rounded font-black shrink-0">
            +{info.points}分
          </span>
          <span className="hidden sm:inline text-[11px] text-amber-100/90 truncate">• {info.desc}</span>
        </div>
      </div>

      {onUseSpecial && (
        <button
          onClick={onUseSpecial}
          className={`px-2.5 py-1 rounded-lg font-black text-xs transition-all active:scale-95 shrink-0 whitespace-nowrap shadow ${
            isUsed
              ? 'bg-amber-300 text-slate-950 ring-2 ring-white'
              : 'bg-white text-orange-700 hover:bg-amber-50'
          }`}
        >
          {isUsed ? '✓ 已选用' : '一键选用'}
        </button>
      )}
    </div>
  );
}
