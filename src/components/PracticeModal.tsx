import React, { useState } from 'react';
import { Card, SpecialHandType } from '../types';
import { CardView } from './CardView';
import {
  createDeck,
  shuffle,
  sortCards,
  detectSpecialHand,
  getSuggestedArrangements,
  generateSpecialHand,
  SPECIAL_HAND_CN,
  HAND_TYPE_CN,
  evaluateHand,
  isValidArrangement
} from '../gameLogic';
import { sounds } from '../sound';
import {
  X,
  Sparkles,
  Shuffle,
  Wand2,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  BookOpen
} from 'lucide-react';

interface PracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PracticeModal({ isOpen, onClose }: PracticeModalProps) {
  if (!isOpen) return null;

  const [hand, setHand] = useState<Card[]>(() => {
    const deck = shuffle(createDeck());
    return sortCards(deck.slice(0, 13));
  });

  const [front, setFront] = useState<(Card | null)[]>([null, null, null]);
  const [mid, setMid] = useState<(Card | null)[]>([null, null, null, null, null]);
  const [back, setBack] = useState<(Card | null)[]>([null, null, null, null, null]);
  const [pool, setPool] = useState<Card[]>(() => sortCards(hand));
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const specialDetected = detectSpecialHand(hand);
  const suggestions = getSuggestedArrangements(hand);

  // Deal random hand
  const handleDealRandom = () => {
    sounds.playDeal();
    const deck = shuffle(createDeck());
    const newHand = sortCards(deck.slice(0, 13));
    setHand(newHand);
    setPool(newHand);
    setFront([null, null, null]);
    setMid([null, null, null, null, null]);
    setBack([null, null, null, null, null]);
    setSelectedCardId(null);
  };

  // Load a special hand
  const handleLoadSpecial = (type: SpecialHandType) => {
    sounds.playAutoArrange();
    const newHand = sortCards(generateSpecialHand(type));
    setHand(newHand);
    setPool(newHand);
    setFront([null, null, null]);
    setMid([null, null, null, null, null]);
    setBack([null, null, null, null, null]);
    setSelectedCardId(null);
  };

  // Apply auto-suggest
  const handleApplySuggestion = (idx: number = 0) => {
    if (suggestions[idx]) {
      sounds.playAutoArrange();
      setFront([...suggestions[idx].front]);
      setMid([...suggestions[idx].middle]);
      setBack([...suggestions[idx].back]);
      setPool([]);
      setSelectedCardId(null);
    }
  };

  // Swap Middle and Back
  const handleSwapMidBack = () => {
    sounds.playSwap();
    const currentMid = [...mid];
    const currentBack = [...back];
    setMid(currentBack);
    setBack(currentMid);
  };

  // Clear slots
  const handleClearSlots = () => {
    sounds.playCardPick();
    setPool(sortCards(hand));
    setFront([null, null, null]);
    setMid([null, null, null, null, null]);
    setBack([null, null, null, null, null]);
    setSelectedCardId(null);
  };

  // Card click in Pool
  const handlePoolCardClick = (card: Card) => {
    sounds.playCardPick();
    if (selectedCardId === card.id) {
      setSelectedCardId(null);
    } else {
      setSelectedCardId(card.id);
    }
  };

  // Slot click
  const handleSlotClick = (row: 'front' | 'mid' | 'back', index: number) => {
    const targetArray = row === 'front' ? front : row === 'mid' ? mid : back;
    const setTargetArray = row === 'front' ? setFront : row === 'mid' ? setMid : setBack;

    if (targetArray[index] !== null) {
      sounds.playCardPick();
      const card = targetArray[index]!;
      setPool(prev => sortCards([...prev, card]));
      const newArr = [...targetArray];
      newArr[index] = null;
      setTargetArray(newArr);
      if (selectedCardId === card.id) setSelectedCardId(null);
    } else if (selectedCardId) {
      sounds.playCardPick();
      const card = pool.find(c => c.id === selectedCardId);
      if (card) {
        setPool(prev => prev.filter(c => c.id !== selectedCardId));
        const newArr = [...targetArray];
        newArr[index] = card;
        setTargetArray(newArr);
        setSelectedCardId(null);
      }
    }
  };

  // Evaluations
  const frontFilled = front.every(Boolean);
  const midFilled = mid.every(Boolean);
  const backFilled = back.every(Boolean);
  const allFilled = frontFilled && midFilled && backFilled;

  const fEval = frontFilled ? evaluateHand(front as Card[], 'front') : null;
  const mEval = midFilled ? evaluateHand(mid as Card[], 'middle') : null;
  const bEval = backFilled ? evaluateHand(back as Card[], 'back') : null;

  const isDaoShui = allFilled && !isValidArrangement(front as Card[], mid as Card[], back as Card[]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl font-bold">
              🧪
            </div>
            <div>
              <h3 className="font-black text-lg text-white">十三水自由演练与理牌实验室</h3>
              <p className="text-xs text-slate-400">
                可模拟生成任意特殊牌型、练习摆牌策略并实时校验牌力与倒水规则
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Preset Hand Generaton */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <Wand2 className="w-4 h-4" /> 快速生成演练牌型:
              </span>
              <button
                onClick={handleDealRandom}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 transition"
              >
                <Shuffle className="w-3.5 h-3.5" /> 随机发 13 张
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  'Supreme Dragon',
                  'Dragon',
                  'Twelve Royals',
                  'Three Quads',
                  'Same Color',
                  'Six Pairs',
                  'Three Flushes'
                ] as SpecialHandType[]
              ).map(type => (
                <button
                  key={type}
                  onClick={() => handleLoadSpecial(type)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition"
                >
                  ✨ {SPECIAL_HAND_CN[type].name} ({SPECIAL_HAND_CN[type].points}分)
                </button>
              ))}
            </div>
          </div>

          {/* Special Hand Alert Banner */}
          {specialDetected && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-between">
              <span>
                🌟 检测到特殊牌型: <b>{SPECIAL_HAND_CN[specialDetected].name}</b> (+{SPECIAL_HAND_CN[specialDetected].points}分) - {SPECIAL_HAND_CN[specialDetected].desc}
              </span>
            </div>
          )}

          {/* Arrangement Slots (Front, Mid, Back) */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-5 flex flex-col items-center gap-4">
            <div className="w-full flex items-center justify-between text-xs">
              <span className="font-bold text-white">当前牌位布局</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSwapMidBack}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 transition"
                  title="交换中墩与后墩"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" /> 中后墩互换
                </button>
                <button
                  onClick={() => handleApplySuggestion(0)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 text-xs font-bold flex items-center gap-1 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" /> 一键智能理牌
                </button>
                <button
                  onClick={handleClearSlots}
                  className="px-3 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-400 text-xs font-bold transition"
                >
                  清空
                </button>
              </div>
            </div>

            {/* Validation Banner */}
            {isDaoShui && (
              <div className="w-full p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold text-center">
                ⚠️ 发生违规倒水：后墩牌力必须 &ge; 中墩牌力 &ge; 前墩牌力！
              </div>
            )}
            {allFilled && !isDaoShui && (
              <div className="w-full p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> 摆牌合规 (后墩 &ge; 中墩 &ge; 前墩)
              </div>
            )}

            {/* Slots */}
            <div className="flex flex-col items-center gap-4 w-full">
              {/* Front */}
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                  <span>前墩 (3张)</span>
                  {fEval && (
                    <span className="text-blue-400 font-extrabold">
                      [{HAND_TYPE_CN[fEval.type]}] {fEval.description}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {front.map((c, i) => (
                    <CardView
                      key={`pf_${i}`}
                      card={c || undefined}
                      size="md"
                      onClick={() => handleSlotClick('front', i)}
                    />
                  ))}
                </div>
              </div>

              {/* Mid */}
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                  <span>中墩 (5张)</span>
                  {mEval && (
                    <span className="text-indigo-400 font-extrabold">
                      [{HAND_TYPE_CN[mEval.type]}] {mEval.description}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {mid.map((c, i) => (
                    <CardView
                      key={`pm_${i}`}
                      card={c || undefined}
                      size="md"
                      onClick={() => handleSlotClick('mid', i)}
                    />
                  ))}
                </div>
              </div>

              {/* Back */}
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                  <span>后墩 (5张)</span>
                  {bEval && (
                    <span className="text-purple-400 font-extrabold">
                      [{HAND_TYPE_CN[bEval.type]}] {bEval.description}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {back.map((c, i) => (
                    <CardView
                      key={`pb_${i}`}
                      card={c || undefined}
                      size="md"
                      onClick={() => handleSlotClick('back', i)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Unplaced Pool */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs font-bold text-slate-400 mb-2">
              待摆手牌 ({pool.length} / 13):
            </div>
            {pool.length === 0 ? (
              <div className="text-emerald-400 text-xs font-bold py-3 text-center">
                手牌已全部入槽
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 justify-center">
                {pool.map(c => (
                  <CardView
                    key={c.id}
                    card={c}
                    size="md"
                    selected={selectedCardId === c.id}
                    onClick={() => handlePoolCardClick(c)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <BookOpen className="w-4 h-4 text-blue-400" />
            练习模式不会计入风云榜积分，可放心演练。
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition"
          >
            完成演练
          </button>
        </div>
      </div>
    </div>
  );
}
