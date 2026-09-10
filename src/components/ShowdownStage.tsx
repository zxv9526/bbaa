import React, { useState, useEffect } from 'react';
import { Card, PlayerScoreDetail } from '../types';
import { CardView } from './CardView';
import { HAND_TYPE_CN, SPECIAL_HAND_CN } from '../gameLogic';
import { sounds } from '../sound';
import confetti from 'canvas-confetti';
import {
  RotateCcw,
  Sparkles,
  Zap,
  Flame,
  Award,
  ChevronRight,
  FastForward,
  Play,
  ChevronDown,
  ChevronUp,
  Target,
  Trophy,
  HelpCircle,
  MessageSquare
} from 'lucide-react';

interface ShowdownStageProps {
  results: PlayerScoreDetail[];
  onPlayAgain: () => void;
  onBackToMenu: () => void;
  onOpenChat?: () => void;
  playAgainLabel?: string;
}

type Step = 'front' | 'middle' | 'back' | 'guns' | 'summary';

export function ShowdownStage({
  results,
  onPlayAgain,
  onBackToMenu,
  onOpenChat,
  playAgainLabel
}: ShowdownStageProps) {
  const [currentStep, setCurrentStep] = useState<Step>('front');
  const [autoPlay, setAutoPlay] = useState<boolean>(true);
  const [expandedOppId, setExpandedOppId] = useState<string | null>(null);

  const userResult = results.find(r => r.playerId === 'player_user') || results[0];
  const isSpecialMatch = results.some(r => r.specialHand);

  // 👥 计算我与所有对手的战果统计
  const opponents = results.filter(r => r.playerId !== userResult.playerId);
  let wonCount = 0;
  let lostCount = 0;
  let tieCount = 0;
  let gunKillCount = 0;

  opponents.forEach(opp => {
    const vsInfo = userResult.dunScores[opp.playerId];
    if (!vsInfo) return;
    if (vsInfo.total > 0) wonCount++;
    else if (vsInfo.total < 0) lostCount++;
    else tieCount++;

    if (vsInfo.gunPoints > 0) gunKillCount++;
  });

  // 按最终得分从高到低排序排行榜
  const rankedResults = [...results].sort((a, b) => b.finalPoints - a.finalPoints);

  // Play sounds and animations as steps change
  useEffect(() => {
    sounds.playCardFlip();

    if (currentStep === 'front' || currentStep === 'middle' || currentStep === 'back') {
      sounds.playDunWin();
    } else if (currentStep === 'guns') {
      const hasGun = results.some(r => Object.values(r.dunScores).some(d => d.isGun));
      const hasHomeRun = results.some(r => r.isHomeRun);
      if (hasHomeRun) {
        sounds.playHomeRun();
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 } });
      } else if (hasGun) {
        sounds.playGunShot();
      }
    } else if (currentStep === 'summary') {
      if (userResult && userResult.finalPoints > 0) {
        sounds.playVictory();
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
    }
  }, [currentStep]);

  // Auto-play timer
  useEffect(() => {
    if (!autoPlay || currentStep === 'summary') return;

    const timer = setTimeout(() => {
      handleNextStep();
    }, 2800);

    return () => clearTimeout(timer);
  }, [currentStep, autoPlay]);

  const handleNextStep = () => {
    if (currentStep === 'front') setCurrentStep('middle');
    else if (currentStep === 'middle') setCurrentStep('back');
    else if (currentStep === 'back') setCurrentStep('guns');
    else if (currentStep === 'guns') setCurrentStep('summary');
  };

  const handleSkipAll = () => {
    setAutoPlay(false);
    setCurrentStep('summary');
  };

  const stepOrder: Step[] = ['front', 'middle', 'back', 'guns', 'summary'];
  const stepIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="w-full flex flex-col items-center gap-6 animate-in fade-in duration-300">
      {/* Top Phase Indicator & Control Bar */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Step Tabs */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'front', label: '1. 头墩对决', icon: '🔹' },
            { id: 'middle', label: '2. 中墩比拼', icon: '🔷' },
            { id: 'back', label: '3. 尾墩决胜', icon: '🟣' },
            { id: 'guns', label: '4. 打枪结算', icon: '💥' },
            { id: 'summary', label: '5. 积分战报', icon: '🏆' }
          ].map((item, idx) => {
            const isActive = item.id === currentStep;
            const isPassed = stepIndex > idx;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setAutoPlay(false);
                  setCurrentStep(item.id as Step);
                }}
                className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 scale-105'
                    : isPassed
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                    : 'bg-slate-900/50 text-slate-500'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setAutoPlay(!autoPlay)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
              autoPlay
                ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            {autoPlay ? <Zap className="w-3.5 h-3.5 text-emerald-400" /> : <Play className="w-3.5 h-3.5" />}
            {autoPlay ? '自动演示中' : '手动比牌'}
          </button>

          {currentStep !== 'summary' && (
            <>
              <button
                onClick={handleNextStep}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 transition active:scale-95 shadow"
              >
                下一步 <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleSkipAll}
                className="px-3 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold transition flex items-center gap-1"
                title="直接查看最终结算"
              >
                <FastForward className="w-3.5 h-3.5" /> 跳过
              </button>
            </>
          )}
        </div>
      </div>

      {/* Special Hand Alert if any */}
      {isSpecialMatch && (
        <div className="w-full p-4 rounded-3xl bg-gradient-to-r from-amber-600/30 via-orange-600/20 to-amber-600/30 border border-amber-500/50 flex items-center justify-center gap-3 text-amber-200 text-sm font-bold shadow-lg">
          <Sparkles className="w-5 h-5 text-amber-400 animate-spin" />
          本局触发特殊牌型，按特殊牌固定水数直接结算！
        </div>
      )}

      {/* Arena: Comparison Cards for All Players */}
      <div className={`w-full grid gap-4 ${
        results.length === 2
          ? 'grid-cols-1 sm:grid-cols-2 max-w-4xl'
          : results.length <= 4
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4'
      }`}>
        {results.map(p => {
          const isUser = p.playerId === 'player_user';
          const showFront = stepIndex >= 0;
          const showMid = stepIndex >= 1;
          const showBack = stepIndex >= 2;

          return (
            <div
              key={p.playerId}
              className={`rounded-3xl p-4 flex flex-col items-center gap-3 transition-all duration-300 relative shadow-xl ${
                isUser
                  ? 'bg-slate-900 border-2 border-blue-500/80 shadow-blue-500/10'
                  : 'bg-slate-900/90 border border-slate-800'
              }`}
            >
              {/* Player Header */}
              <div className="w-full flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{p.avatar}</span>
                  <div>
                    <div className="font-bold text-sm text-white flex items-center gap-1.5">
                      {p.name}
                      {isUser && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600 text-white font-black">
                          我
                        </span>
                      )}
                    </div>
                    {p.specialHand ? (
                      <div className="text-[11px] font-black text-amber-400 flex items-center gap-1">
                        <Flame className="w-3 h-3" /> {SPECIAL_HAND_CN[p.specialHand].name} (+{SPECIAL_HAND_CN[p.specialHand].points}水)
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 font-medium">
                        {p.isAi ? '电脑玩家' : '玩家'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Score badge at final step */}
                {currentStep === 'summary' && (
                  <div
                    className={`font-black px-3 py-1 rounded-full text-xs shadow-sm ${
                      p.finalPoints >= 0
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {p.finalPoints >= 0 ? `+${p.finalPoints}` : p.finalPoints} 水
                  </div>
                )}
              </div>

              {/* 3 Duns */}
              <div className="w-full flex flex-col items-center gap-2.5 pt-1">
                {/* 1. FRONT DUN */}
                <div
                  className={`w-full flex flex-col items-center p-2 rounded-2xl transition-all ${
                    currentStep === 'front'
                      ? 'bg-blue-500/20 ring-2 ring-blue-500 shadow-md'
                      : 'bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between w-full text-[11px] text-slate-400 mb-1 px-1">
                    <span className="font-bold">头墩 (3张)</span>
                    {showFront && (
                      <span className="font-extrabold text-blue-300">
                        {HAND_TYPE_CN[p.frontScore.type] || p.frontScore.type}
                        {p.frontScore.bonusPoints ? ` (+${p.frontScore.bonusPoints}水)` : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 justify-center">
                    {(showFront ? p.arrangement.front : [1, 2, 3]).map((c, i) => (
                      <CardView
                        key={`pf_${i}`}
                        card={showFront ? (c as Card) : undefined}
                        isFaceDown={!showFront}
                        size="sm"
                      />
                    ))}
                  </div>
                </div>

                {/* 2. MIDDLE DUN */}
                <div
                  className={`w-full flex flex-col items-center p-2 rounded-2xl transition-all ${
                    currentStep === 'middle'
                      ? 'bg-indigo-500/20 ring-2 ring-indigo-500 shadow-md'
                      : 'bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between w-full text-[11px] text-slate-400 mb-1 px-1">
                    <span className="font-bold">中墩 (5张)</span>
                    {showMid && (
                      <span className="font-extrabold text-indigo-300">
                        {HAND_TYPE_CN[p.midScore.type] || p.midScore.type}
                        {p.midScore.bonusPoints ? ` (+${p.midScore.bonusPoints}水)` : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 justify-center">
                    {(showMid ? p.arrangement.middle : [1, 2, 3, 4, 5]).map((c, i) => (
                      <CardView
                        key={`pm_${i}`}
                        card={showMid ? (c as Card) : undefined}
                        isFaceDown={!showMid}
                        size="sm"
                      />
                    ))}
                  </div>
                </div>

                {/* 3. BACK DUN */}
                <div
                  className={`w-full flex flex-col items-center p-2 rounded-2xl transition-all ${
                    currentStep === 'back'
                      ? 'bg-purple-500/20 ring-2 ring-purple-500 shadow-md'
                      : 'bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between w-full text-[11px] text-slate-400 mb-1 px-1">
                    <span className="font-bold">尾墩 (5张)</span>
                    {showBack && (
                      <span className="font-extrabold text-purple-300">
                        {HAND_TYPE_CN[p.backScore.type] || p.backScore.type}
                        {p.backScore.bonusPoints ? ` (+${p.backScore.bonusPoints}水)` : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 justify-center">
                    {(showBack ? p.arrangement.back : [1, 2, 3, 4, 5]).map((c, i) => (
                      <CardView
                        key={`pb_${i}`}
                        card={showBack ? (c as Card) : undefined}
                        isFaceDown={!showBack}
                        size="sm"
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Status Badges */}
              {p.arrangement.isDaoShui && (
                <div className="w-full text-center py-1 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-bold">
                  ⚠️ 倒水判负 (-6水/人)
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Step Details & Explanations */}
      {currentStep === 'front' && (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 text-center text-slate-300 text-xs font-medium space-y-1">
          <div className="font-bold text-sm text-blue-400">🔹 第一步：头墩 (前墩 3 张) 比拼</div>
          <p className="text-slate-400">前墩比拼牌力大小。若前墩凑出“三条”（冲三），直接享有喜分 +3 水！</p>
        </div>
      )}

      {currentStep === 'middle' && (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 text-center text-slate-300 text-xs font-medium space-y-1">
          <div className="font-bold text-sm text-indigo-400">🔷 第二步：中墩 (5 张) 策略比拼</div>
          <p className="text-slate-400">中墩出现同花顺(+10水)、铁支(+8水)、葫芦(+2水)享墩位特殊高额喜分。</p>
        </div>
      )}

      {currentStep === 'back' && (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 text-center text-slate-300 text-xs font-medium space-y-1">
          <div className="font-bold text-sm text-purple-400">🟣 第三步：尾墩 (5 张) 决胜压轴</div>
          <p className="text-slate-400">尾墩为整手牌最强压轴墩位（尾墩铁支+4水，同花顺+5水），锁住最终胜局！</p>
        </div>
      )}

      {currentStep === 'guns' && (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col items-center gap-3 text-center">
          <div className="text-2xl font-black text-amber-400 flex items-center gap-2">
            💥 打枪与全垒打结算
          </div>
          <div className="text-xs text-slate-300 max-w-lg leading-relaxed space-y-1">
            {results.some(r => r.isHomeRun) ? (
              <span className="text-yellow-300 font-bold block">
                👑 震撼全场！有玩家完成【全垒打】（通杀全场所有对手），总赢水数直接 ×2 翻倍！
              </span>
            ) : results.some(r => Object.values(r.dunScores).some(d => d.isGun)) ? (
              <span className="text-orange-300 font-bold block">
                🔫 发生打枪对决！三墩全胜玩家获得额外的 +3 水打枪通杀奖励！
              </span>
            ) : (
              <span className="text-slate-400 block">
                本局各对手互有胜负，未发生 3-0 通杀打枪，比分平稳入账。
              </span>
            )}
          </div>
        </div>
      )}

      {/* FINAL SUMMARY LEDGER */}
      {currentStep === 'summary' && (
        <div className="w-full bg-slate-900 border-2 border-blue-500/60 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center gap-6 text-center animate-in zoom-in-95">
          {/* Main Title */}
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              {userResult.isHomeRun && (
                <span className="bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black text-xs px-3.5 py-1 rounded-full animate-bounce shadow-md">
                  👑 全垒打 (Home Run) × 2倍
                </span>
              )}
              {Object.values(userResult.dunScores).some(d => d.isGun) && !userResult.isHomeRun && (
                <span className="bg-indigo-600 text-white font-black text-xs px-3.5 py-1 rounded-full">
                  💥 打枪大捷 (Gun Win)
                </span>
              )}
            </div>

            <h2
              className={`text-3xl sm:text-4xl font-black ${
                userResult.finalPoints > 0
                  ? 'text-emerald-400'
                  : userResult.finalPoints < 0
                  ? 'text-rose-400'
                  : 'text-slate-300'
              }`}
            >
              {userResult.finalPoints > 0
                ? '🎉 旗开得胜！'
                : userResult.finalPoints < 0
                ? '💔 遗憾惜败！'
                : '🤝 势均力敌 (平局)'}
            </h2>

            <p className="text-slate-400 text-sm font-medium mt-1">
              本局净胜水数:{' '}
              <span
                className={`text-2xl font-black ${
                  userResult.finalPoints >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {userResult.finalPoints >= 0 ? `+${userResult.finalPoints}` : userResult.finalPoints} 水
              </span>
            </p>
          </div>

          {/* 🎖️ 我的战果速览条 (Battle Overview Banner) */}
          {opponents.length > 0 && (
            <div className="w-full max-w-xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-amber-500/30 rounded-2xl p-3.5 sm:p-4 text-xs shadow-xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="font-black text-amber-300 flex items-center gap-1.5 text-xs sm:text-sm">
                  <Target className="w-4 h-4 text-amber-400" />
                  战绩速报 ({opponents.length + 1}人场 · 对战 {opponents.length} 家)
                </span>
                <span className={`font-mono font-black text-xs px-2.5 py-0.5 rounded-full border ${
                  userResult.finalPoints >= 0 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                }`}>
                  净胜: {userResult.finalPoints >= 0 ? `+${userResult.finalPoints}` : userResult.finalPoints} 水
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2 flex flex-col items-center">
                  <span className="text-slate-400 text-[10px]">🏆 战胜对手</span>
                  <span className="text-base sm:text-lg font-black text-emerald-400">
                    {wonCount} <span className="text-xs font-normal text-emerald-500/80">家</span>
                  </span>
                </div>

                <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-2 flex flex-col items-center">
                  <span className="text-slate-400 text-[10px]">💥 击发打枪</span>
                  <span className="text-base sm:text-lg font-black text-amber-400">
                    {gunKillCount} <span className="text-xs font-normal text-amber-500/80">家</span>
                  </span>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-2 flex flex-col items-center">
                  <span className="text-slate-400 text-[10px]">🤝 握手平局</span>
                  <span className="text-base sm:text-lg font-black text-slate-300">
                    {tieCount} <span className="text-xs font-normal text-slate-400">家</span>
                  </span>
                </div>

                <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-2 flex flex-col items-center">
                  <span className="text-slate-400 text-[10px]">💔 惜败对手</span>
                  <span className="text-base sm:text-lg font-black text-rose-400">
                    {lostCount} <span className="text-xs font-normal text-rose-500/80">家</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard Ranking Table */}
          <div className="w-full max-w-xl bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-xs">
            <div className="font-bold text-slate-300 mb-3 text-left flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-amber-400 font-black">
                <Trophy className="w-4 h-4" /> 本局玩家排行榜 (Rankings)
              </span>
              <span className="text-slate-500 text-[11px] font-normal">点击对手行可展开对局计算明细</span>
            </div>

            <div className="space-y-2">
              {rankedResults.map((player, rankIdx) => {
                const isUser = player.playerId === userResult.playerId;
                return (
                  <div
                    key={player.playerId}
                    className={`flex flex-col rounded-xl border transition ${
                      isUser
                        ? 'bg-blue-950/40 border-blue-500/50'
                        : 'bg-slate-900/90 border-slate-800'
                    }`}
                  >
                    {/* Rank Header */}
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                          rankIdx === 0 ? 'bg-amber-500 text-black' : rankIdx === 1 ? 'bg-slate-300 text-black' : rankIdx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {rankIdx + 1}
                        </span>
                        <span className="text-xl">{player.avatar}</span>
                        <div className="text-left">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {player.name}
                            {isUser && <span className="text-[10px] px-1.5 py-0.2 bg-blue-600 text-white font-bold rounded">我</span>}
                          </div>
                          {player.specialHand && (
                            <span className="text-[10px] text-amber-300 font-bold">
                              ✨ {SPECIAL_HAND_CN[player.specialHand].name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className={`font-black text-sm ${
                          player.finalPoints >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {player.finalPoints >= 0 ? `+${player.finalPoints}` : player.finalPoints} 水
                        </div>

                        {!isUser && (
                          <button
                            onClick={() => setExpandedOppId(expandedOppId === player.playerId ? null : player.playerId)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                            title="查看与该对手的比分明细"
                          >
                            {expandedOppId === player.playerId ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Matchup Breakdown with User */}
                    {!isUser && (expandedOppId === player.playerId || results.length === 2) && (
                      <div className="px-4 pb-3.5 pt-1 border-t border-slate-800/80 bg-slate-950/40 text-[11px] space-y-2 animate-in fade-in duration-200">
                        {(() => {
                          const vsInfo = userResult.dunScores[player.playerId];
                          if (!vsInfo) return <div className="text-slate-500 text-center py-1">暂无对局明细</div>;

                          return (
                            <div className="space-y-1.5 text-left text-slate-300">
                              <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                                <span className="text-slate-400 font-bold">🔹 头墩对决:</span>
                                <span>
                                  {vsInfo.front > 0 ? '胜 (+1水)' : vsInfo.front < 0 ? '负 (-1水)' : '平 (0水)'}
                                  {vsInfo.frontBonus !== 0 && (
                                    <span className={vsInfo.frontBonus > 0 ? 'text-amber-300 font-bold ml-1' : 'text-rose-400 ml-1'}>
                                      (喜分 {vsInfo.frontBonus > 0 ? `+${vsInfo.frontBonus}` : vsInfo.frontBonus}水)
                                    </span>
                                  )}
                                </span>
                              </div>

                              <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                                <span className="text-slate-400 font-bold">🔷 中墩对决:</span>
                                <span>
                                  {vsInfo.mid > 0 ? '胜 (+1水)' : vsInfo.mid < 0 ? '负 (-1水)' : '平 (0水)'}
                                  {vsInfo.midBonus !== 0 && (
                                    <span className={vsInfo.midBonus > 0 ? 'text-indigo-300 font-bold ml-1' : 'text-rose-400 ml-1'}>
                                      (喜分 {vsInfo.midBonus > 0 ? `+${vsInfo.midBonus}` : vsInfo.midBonus}水)
                                    </span>
                                  )}
                                </span>
                              </div>

                              <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                                <span className="text-slate-400 font-bold">🟣 尾墩对决:</span>
                                <span>
                                  {vsInfo.back > 0 ? '胜 (+1水)' : vsInfo.back < 0 ? '负 (-1水)' : '平 (0水)'}
                                  {vsInfo.backBonus !== 0 && (
                                    <span className={vsInfo.backBonus > 0 ? 'text-purple-300 font-bold ml-1' : 'text-rose-400 ml-1'}>
                                      (喜分 {vsInfo.backBonus > 0 ? `+${vsInfo.backBonus}` : vsInfo.backBonus}水)
                                    </span>
                                  )}
                                </span>
                              </div>

                              {vsInfo.gunPoints !== 0 && (
                                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/50">
                                  <span className="text-amber-400 font-bold">💥 打枪通杀:</span>
                                  <span className={vsInfo.gunPoints > 0 ? 'text-amber-300 font-bold' : 'text-rose-400 font-bold'}>
                                    {vsInfo.gunPoints > 0 ? `+${vsInfo.gunPoints}水 (通杀对方)` : `${vsInfo.gunPoints}水 (被打枪)`}
                                  </span>
                                </div>
                              )}

                              <div className="flex justify-between items-center pt-1 font-bold">
                                <span className="text-white">小计与该对手净胜:</span>
                                <span className={vsInfo.total >= 0 ? 'text-emerald-400 font-black' : 'text-rose-400 font-black'}>
                                  {vsInfo.total >= 0 ? `+${vsInfo.total}` : vsInfo.total} 水
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 sm:gap-4 mt-2 flex-wrap justify-center">
            <button
              onClick={onPlayAgain}
              className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-blue-600/30 flex items-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              {playAgainLabel || '再来一局'}
            </button>
            {onOpenChat && (
              <button
                onClick={onOpenChat}
                className="px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-750 text-indigo-300 border border-indigo-500/30 font-bold text-sm transition cursor-pointer active:scale-95 flex items-center gap-1.5 shadow"
              >
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                互动对讲
              </button>
            )}
            <button
              onClick={onBackToMenu}
              className="px-6 py-3.5 rounded-2xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-sm transition cursor-pointer"
            >
              返回大厅
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
