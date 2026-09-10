import React, { useState, useEffect } from 'react';
import { Card, RoomPlayer, RoomState } from '../types';
import { CardView } from './CardView';
import { sounds } from '../sound';
import { triggerHaptic } from '../lib/haptics';
import { Crown, Sparkles, Scissors, Play, RefreshCw, Volume2, Users, ArrowRight } from 'lucide-react';
import { createDeck, createDoubleDeck, shuffle, cutDeck } from '../gameLogic';

interface ShuffleCutStageProps {
  room: RoomState;
  currentUserId: string;
  currentUserName: string;
  onConfirmDeal: (dealtCards: Card[]) => void;
  onShuffleAction: () => void;
  onCutAction: (position: number, cutCard: Card) => void;
  onSendMessage?: (content: string) => void;
  onExit: () => void;
}

export function ShuffleCutStage({
  room,
  currentUserId,
  currentUserName,
  onConfirmDeal,
  onShuffleAction,
  onCutAction,
  onSendMessage,
  onExit
}: ShuffleCutStageProps) {
  const players = room.players || [];
  const dealerIdx = room.dealerIndex % (players.length || 1);
  const currentDealer = players[dealerIdx];
  const nextDealer = players[(dealerIdx + 1) % (players.length || 1)];
  const isMeDealer = currentDealer?.id === currentUserId || currentDealer?.name === currentUserName;

  // Deck state
  const totalCards = room.maxPlayers === 8 ? 104 : 52;
  const [deck, setDeck] = useState<Card[]>(() => {
    return room.maxPlayers === 8 ? shuffle(createDoubleDeck()) : shuffle(createDeck());
  });

  const [step, setStep] = useState<'shuffle' | 'cut' | 'ready_deal'>('shuffle');
  const [isShufflingAnim, setIsShufflingAnim] = useState(false);
  const [isCuttingAnim, setIsCuttingAnim] = useState(false);
  const [cutDepthPercent, setCutDepthPercent] = useState<number>(50);
  const [cutCard, setCutCard] = useState<Card | null>(room.cutCard || null);
  const [shuffleCount, setShuffleCount] = useState<number>(room.shuffleCount || 0);

  // Sync external changes
  useEffect(() => {
    if (room.shuffleCount && room.shuffleCount !== shuffleCount) {
      setShuffleCount(room.shuffleCount);
    }
    if (room.cutCard) {
      setCutCard(room.cutCard);
      setStep('ready_deal');
    }
  }, [room.shuffleCount, room.cutCard]);

  // AI dealer auto execution if in local testing
  useEffect(() => {
    if (currentDealer?.isAi && !isMeDealer) {
      const timer = setTimeout(() => {
        handleShuffle();
        setTimeout(() => {
          handleCut();
          setTimeout(() => {
            handleDeal();
          }, 1200);
        }, 1200);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [currentDealer?.isAi]);

  // 1. 洗牌动作
  const handleShuffle = () => {
    if (isShufflingAnim) return;
    setIsShufflingAnim(true);
    sounds.playShuffle();
    triggerHaptic('medium');

    const newDeck = shuffle(deck);
    setDeck(newDeck);
    const newCount = shuffleCount + 1;
    setShuffleCount(newCount);
    onShuffleAction();

    setTimeout(() => {
      setIsShufflingAnim(false);
    }, 600);
  };

  // 2. 切牌动作
  const handleCut = () => {
    if (isCuttingAnim) return;
    setIsCuttingAnim(true);
    sounds.playCut();
    triggerHaptic('heavy');

    const cutIndex = Math.floor((cutDepthPercent / 100) * deck.length);
    const { deck: newCutDeck, cutCard: exposedCard } = cutDeck(deck, cutIndex);

    setDeck(newCutDeck);
    setCutCard(exposedCard);
    onCutAction(cutIndex, exposedCard);

    setTimeout(() => {
      setIsCuttingAnim(false);
      setStep('ready_deal');
    }, 700);
  };

  // 3. 确认发牌
  const handleDeal = () => {
    sounds.playDeal();
    triggerHaptic('heavy');
    onConfirmDeal(deck);
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col justify-between items-center p-2 sm:p-4 text-white select-none">
      {/* Top Banner: Round & Rotating Dealer Info */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl backdrop-blur flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-red-600 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg shadow-red-600/30">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-amber-400">
                第 {room.roundIndex || 1} 局
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                用户轮流发牌制
              </span>
              <span className="text-xs text-slate-400">
                ({room.maxPlayers === 8 ? '双副104牌' : '单副52牌'})
              </span>
            </div>
            <div className="text-xs sm:text-sm font-bold text-slate-200 mt-0.5">
              本局发牌官：
              <span className="text-amber-300 font-black">
                {currentDealer?.name || '未知'}
                {isMeDealer && ' (你)'}
              </span>
              <span className="text-slate-400 font-normal text-xs ml-2">
                • 下局轮到: {nextDealer?.name || '下一位'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onSendMessage && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onSendMessage('快点发牌呀，等不及了！')}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition border border-slate-700 active:scale-95"
              >
                ⏰ 催促发牌
              </button>
              <button
                onClick={() => onSendMessage('发牌手洗得漂亮！')}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition border border-slate-700 active:scale-95"
              >
                👍 赞发牌手
              </button>
            </div>
          )}
          <button
            onClick={onExit}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold transition border border-slate-700"
          >
            退出
          </button>
        </div>
      </div>

      {/* Players Circle Preview */}
      <div className="w-full flex items-center justify-center gap-2 sm:gap-4 py-2 overflow-x-auto no-scrollbar">
        {players.map((p, idx) => {
          const isDealer = idx === dealerIdx;
          const isMe = p.id === currentUserId || p.name === currentUserName;
          return (
            <div
              key={p.id || idx}
              className={`relative flex flex-col items-center p-2 rounded-2xl border transition-all ${
                isDealer
                  ? 'bg-amber-950/40 border-amber-500/80 shadow-lg shadow-amber-950/50 scale-105'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              {isDealer && (
                <div className="absolute -top-2.5 -right-1 px-1.5 py-0.2 rounded-md bg-gradient-to-r from-amber-500 to-red-600 text-slate-950 text-[10px] font-black flex items-center gap-0.5 shadow">
                  <Crown className="w-3 h-3" />
                  <span>庄</span>
                </div>
              )}
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl">
                {p.avatar || '🎲'}
              </div>
              <div className="text-[11px] font-bold text-slate-200 mt-1 max-w-[70px] truncate text-center">
                {p.name}
              </div>
              <div className="text-[10px] text-slate-400">
                {isMe ? '你' : isDealer ? '发牌手' : `${idx + 1}号位`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Interactive Poker Table (Felt & Deck) */}
      <div className="relative w-full max-w-2xl h-72 sm:h-80 bg-gradient-to-b from-emerald-900 via-emerald-950 to-slate-950 rounded-[40px] border-4 border-amber-800/60 shadow-2xl p-6 flex flex-col items-center justify-center overflow-hidden">
        {/* Table Felt Accent Lines */}
        <div className="absolute inset-3 rounded-[32px] border-2 border-dashed border-emerald-500/20 pointer-events-none" />
        <div className="absolute top-4 text-xs font-black tracking-widest text-emerald-400/40 uppercase">
          ✦ THIRTEEN WATER CASINO TABLE ✦
        </div>

        {/* The Card Deck in Center */}
        <div className="relative flex items-center justify-center my-auto">
          {/* Shuffling animation cards */}
          {isShufflingAnim ? (
            <div className="flex items-center gap-4 animate-pulse">
              <div className="w-20 h-28 bg-blue-900 rounded-xl border-2 border-white/20 shadow-2xl -rotate-12 transform transition -translate-x-3 flex items-center justify-center text-2xl font-black text-white/50">
                🎴
              </div>
              <div className="w-20 h-28 bg-blue-900 rounded-xl border-2 border-white/20 shadow-2xl rotate-12 transform transition translate-x-3 flex items-center justify-center text-2xl font-black text-white/50">
                🎴
              </div>
            </div>
          ) : isCuttingAnim ? (
            /* Cutting animation cards */
            <div className="relative flex items-center justify-center">
              <div className="w-20 h-28 bg-blue-900 rounded-xl border-2 border-white/30 shadow-2xl -translate-y-6 translate-x-4 rotate-6 transition-all duration-300 flex items-center justify-center text-white/70">
                <Scissors className="w-6 h-6 text-amber-300" />
              </div>
              <div className="w-20 h-28 bg-blue-950 rounded-xl border-2 border-white/20 shadow-2xl translate-y-3 -translate-x-4 -rotate-3 transition-all duration-300 flex items-center justify-center text-white/50">
                🎴
              </div>
            </div>
          ) : (
            /* Normal stacked deck */
            <div className="relative cursor-pointer group" onClick={() => isMeDealer && handleShuffle()}>
              {/* Stack shadow layers */}
              <div className="absolute -inset-1.5 bg-blue-950 rounded-xl transform translate-x-1.5 translate-y-1.5 opacity-60" />
              <div className="absolute -inset-1 bg-blue-900 rounded-xl transform translate-x-1 translate-y-1 opacity-80" />
              {/* Top card */}
              <div className="relative w-22 h-30 bg-gradient-to-br from-blue-800 via-blue-900 to-indigo-950 rounded-xl border-2 border-amber-400/40 shadow-2xl flex flex-col items-center justify-center p-2 group-hover:scale-105 transition duration-300">
                <div className="w-full h-full border border-blue-400/30 rounded-lg flex flex-col items-center justify-center">
                  <div className="text-3xl">🎴</div>
                  <div className="text-[10px] font-black text-amber-300 mt-1 tracking-wider">
                    {totalCards} 张
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Revealed Cut Card Banner */}
        {cutCard && (
          <div className="absolute bottom-4 bg-slate-900/90 border border-amber-500/60 px-4 py-1.5 rounded-2xl flex items-center gap-3 shadow-xl animate-in fade-in zoom-in-95">
            <span className="text-xs font-bold text-amber-300">切牌指示牌:</span>
            <div className="scale-75 origin-left -my-3">
              <CardView card={cutCard} size="sm" />
            </div>
            <span className="text-[11px] text-slate-300">切点深度: {cutDepthPercent}%</span>
          </div>
        )}
      </div>

      {/* Action Controls Area */}
      <div className="w-full max-w-xl bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 mt-2 flex flex-col items-center gap-4 shadow-xl">
        {/* Status text */}
        <div className="text-center space-y-1">
          <div className="text-sm font-black text-white flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>
              {isMeDealer
                ? '你是本局庄家！请进行洗牌、切牌并向全场发牌'
                : `等待庄家【${currentDealer?.name}】洗牌切牌与发牌...`}
            </span>
          </div>
          <div className="text-xs text-slate-400">
            已洗牌次数: <strong className="text-amber-400">{shuffleCount}</strong> 次
            {cutCard && ` · 已切牌`}
          </div>
        </div>

        {/* If user is the dealer: Full interactive controls */}
        {isMeDealer ? (
          <div className="w-full flex flex-col gap-3">
            {/* Cut Depth Slider if in cut step */}
            <div className="w-full bg-slate-950/70 p-3 rounded-2xl border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-amber-400" /> 切牌深度调节 (Cut Depth)
                </span>
                <span className="text-amber-400 font-mono font-black">{cutDepthPercent}%</span>
              </div>
              <input
                type="range"
                min="15"
                max="85"
                value={cutDepthPercent}
                onChange={e => setCutDepthPercent(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>切牌上半部 (浅)</span>
                <span>对半腰斩 (50%)</span>
                <span>切牌下半部 (深)</span>
              </div>
            </div>

            {/* Action Buttons: 洗牌 / 切牌 / 发牌 */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                onClick={handleShuffle}
                disabled={isShufflingAnim}
                className="py-3 px-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30 transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isShufflingAnim ? 'animate-spin' : ''}`} />
                <span>洗牌 ({shuffleCount})</span>
              </button>

              <button
                onClick={handleCut}
                disabled={isCuttingAnim}
                className="py-3 px-3 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/30 transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Scissors className="w-4 h-4" />
                <span>切牌</span>
              </button>

              <button
                onClick={handleDeal}
                className="py-3 px-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 transition active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>确认发牌</span>
              </button>
            </div>
          </div>
        ) : (
          /* Non-dealer view: waiting or proxy deal */
          <div className="w-full flex flex-col items-center gap-2 py-2">
            <div className="text-xs text-slate-300 font-medium">
              当前为【{currentDealer?.name}】发牌回合，请稍候片刻...
            </div>
            {/* If playing with AI bots, offer a bypass button to deal immediately */}
            {currentDealer?.isAi && (
              <button
                onClick={handleDeal}
                className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition active:scale-95 flex items-center gap-1.5 shadow-lg"
              >
                <span>立即帮 AI 发牌开始</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
