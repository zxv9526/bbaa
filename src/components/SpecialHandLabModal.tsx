import React from 'react';
import { X, Sparkles, Wand2, ShieldCheck, Flame, Zap, Award } from 'lucide-react';
import { SpecialHandType } from '../types';
import { SPECIAL_HAND_CN } from '../gameLogic';

interface SpecialHandLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSpecial: (type: SpecialHandType) => void;
}

const SPECIAL_HAND_OPTIONS: {
  type: SpecialHandType;
  name: string;
  water: number;
  desc: string;
  category: 'super' | 'high' | 'standard';
  badgeColor: string;
}[] = [
  {
    type: 'Supreme Dragon',
    name: '至尊青龙',
    water: 108,
    desc: '同一花色的 2 到 A 一条龙，十三水最高无上神牌',
    category: 'super',
    badgeColor: 'from-amber-400 to-yellow-600 text-slate-950'
  },
  {
    type: 'Dragon',
    name: '一条龙',
    water: 52,
    desc: '2 到 A 各一张牌，不限花色（A到K顺畅贯通）',
    category: 'super',
    badgeColor: 'from-purple-500 to-indigo-600 text-white'
  },
  {
    type: 'Twelve Royals',
    name: '十二皇族',
    water: 36,
    desc: '13 张牌全由 J、Q、K、A 皇族大牌组成',
    category: 'super',
    badgeColor: 'from-rose-500 to-pink-600 text-white'
  },
  {
    type: 'Three Straight Flushes',
    name: '三同花顺',
    water: 26,
    desc: '前墩、中墩、后墩三墩均为同花顺',
    category: 'high',
    badgeColor: 'from-blue-500 to-cyan-600 text-white'
  },
  {
    type: 'Three Quads',
    name: '三分天下 (三铁支)',
    water: 24,
    desc: '牌中有三组铁支（四条炸弹）',
    category: 'high',
    badgeColor: 'from-emerald-500 to-teal-600 text-white'
  },
  {
    type: 'All High',
    name: '全大 (8-A)',
    water: 20,
    desc: '13 张牌的点数均在 8、9、10、J、Q、K、A 之间',
    category: 'standard',
    badgeColor: 'from-amber-500/30 to-amber-500/50 text-amber-200'
  },
  {
    type: 'All Low',
    name: '全小 (2-8)',
    water: 20,
    desc: '13 张牌的点数均在 2、3、4、5、6、7、8 之间',
    category: 'standard',
    badgeColor: 'from-sky-500/30 to-sky-500/50 text-sky-200'
  },
  {
    type: 'Same Color',
    name: '凑一色',
    water: 16,
    desc: '13 张牌全为红牌（红桃/方块）或全为黑牌（黑桃/梅花）',
    category: 'standard',
    badgeColor: 'from-rose-500/30 to-red-500/50 text-rose-200'
  },
  {
    type: 'Four Triples',
    name: '四套三条',
    water: 12,
    desc: '包含 4 组三条外加 1 张单张',
    category: 'standard',
    badgeColor: 'from-violet-500/30 to-violet-500/50 text-violet-200'
  },
  {
    type: 'Five Pairs One Triple',
    name: '五对三条',
    water: 10,
    desc: '5 组对子外加 1 组三条',
    category: 'standard',
    badgeColor: 'from-indigo-500/30 to-indigo-500/50 text-indigo-200'
  },
  {
    type: 'Six Pairs',
    name: '六对半',
    water: 8,
    desc: '包含 6 组对子外加 1 张单张',
    category: 'standard',
    badgeColor: 'from-emerald-500/30 to-emerald-500/50 text-emerald-200'
  },
  {
    type: 'Three Flushes',
    name: '三同花',
    water: 6,
    desc: '前墩、中墩、尾墩三墩全为同花',
    category: 'standard',
    badgeColor: 'from-teal-500/30 to-teal-500/50 text-teal-200'
  },
  {
    type: 'Three Straights',
    name: '三顺子',
    water: 6,
    desc: '前墩、中墩、尾墩三墩全为顺子',
    category: 'standard',
    badgeColor: 'from-slate-700 to-slate-800 text-slate-200'
  }
];

export function SpecialHandLabModal({
  isOpen,
  onClose,
  onSelectSpecial
}: SpecialHandLabModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xl font-black shadow-inner shrink-0">
              🧪
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-white flex items-center gap-2">
                <span>特殊牌型测试台</span>
                <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  试玩专属
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                点击直接加载对应特殊牌型到主牌桌，测试摆牌与比牌效果
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content List */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
          <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>点击任意牌型，立即生成该副手牌进行演练体验：</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {SPECIAL_HAND_OPTIONS.map(item => (
              <div
                key={item.type}
                onClick={() => {
                  onSelectSpecial(item.type);
                  onClose();
                }}
                className="group bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-3.5 flex flex-col justify-between gap-2 cursor-pointer transition shadow-md hover:shadow-amber-950/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-black text-white group-hover:text-amber-300 transition flex items-center gap-1.5">
                      <span>{item.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      {item.desc}
                    </div>
                  </div>
                  <span className={`text-xs font-black font-mono px-2 py-0.5 rounded-lg shrink-0 shadow-sm bg-gradient-to-r ${item.badgeColor}`}>
                    +{item.water} 水
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/40 text-[10px] text-slate-500 group-hover:text-slate-300">
                  <span>点击载入手牌</span>
                  <span className="text-amber-400 font-bold group-hover:translate-x-0.5 transition">载入体验 →</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>特殊牌型免摆三墩，可直接按通赔结算额外水数</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            关闭
          </button>
        </div>

      </div>
    </div>
  );
}
