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
    <div className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-white p-3.5 rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
          <Sparkles className="w-6 h-6 text-yellow-200" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-base font-black tracking-wide">{info.name}</h4>
            <span className="bg-black/30 backdrop-blur text-yellow-300 text-xs px-2 py-0.5 rounded-full font-bold">
              +{info.points} 分
            </span>
          </div>
          <p className="text-xs text-white/90">{info.desc} • 特殊牌型免比直接全胜</p>
        </div>
      </div>

      {onUseSpecial && (
        <button
          onClick={onUseSpecial}
          className="w-full sm:w-auto px-5 py-2 rounded-xl bg-white text-orange-600 font-extrabold hover:bg-yellow-50 shadow transition-all active:scale-95 text-xs sm:text-sm whitespace-nowrap"
        >
          {isUsed ? '已选特殊牌提交' : '一键选用特殊牌'}
        </button>
      )}
    </div>
  );
}
