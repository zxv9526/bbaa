import React, { useState, useEffect } from 'react';
import { Card, PlayerScoreDetail } from '../types';
import { CardView } from './CardView';
import { HAND_TYPE_CN, SPECIAL_HAND_CN } from '../gameLogic';
import { sounds } from '../sound';
import confetti from 'canvas-confetti';
import {
  RotateCcw,
  ArrowRight,
  Sparkles,
  Zap,
  Flame,
  Award,
  ChevronRight,
  FastForward,
  Play
} from 'lucide-react';

interface ShowdownStageProps {
  results: PlayerScoreDetail[];
  onPlayAgain: () => void;
  onBackToMenu: () => void;
}

type Step = 'front' | 'middle' | 'back' | 'guns' | 'summary';

export function ShowdownStage({ results, onPlayAgain, onBackToMenu }: ShowdownStageProps) {
  const [currentStep, setCurrentStep] = useState<Step>('front');
  const [autoPlay, setAutoPlay] = useState<boolean>(true);

  const userResult = results.find(r => r.playerId === 'player_user') || results[0];
  const isSpecialMatch = results.some(r => r.specialHand);

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
        <div className="flex items-center gap-1.5 sm:gap-2">
          {[
            { id: 'front', label: '1. 头墩对决', icon: '🔹' },
            { id: 'middle', label: '2. 中墩比拼', icon: '🔷' },
            { id: 'back', label: '3. 尾墩决胜', icon: '🟣' },
            { id: 'guns', label: '4. 打枪翻倍', icon: '💥' },
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
                className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 scale-105'
                    : isPassed
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                    : 'bg-slate-900/50 text-slate-500'
                }`}
              >
                <span>{item.icon}</span>
                <span className="hidden md:inline">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoPlay(!autoPlay)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
              autoPlay
                ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            {autoPlay ? <Zap className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {autoPlay ? '自动播放中' : '手动比牌'}
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
          本局触发特殊牌型，按特殊牌规则直接结算积分！
        </div>
      )}

      {/* Arena: Comparison Cards for All Players */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {results.map(p => {
          const isUser = p.playerId === 'player_user';
          const showFront = stepIndex >= 0;
          const showMid = stepIndex >= 1;
          const showBack = stepIndex >= 2;

          return (
            <div
              key={p.playerId}
              className={`rounded-3xl p-4 sm:p-5 flex flex-col items-center gap-3 transition-all duration-300 relative shadow-xl ${
                isUser
                  ? 'bg-slate-900 border-2 border-blue-500/80 shadow-blue-500/10'
                  : 'bg-slate-900/90 border border-slate-800'
              }`}
            >
              {/* Player Header */}
              <div className="w-full flex items-center justify-between">
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
                    {p.specialHand && (
                      <div className="text-[11px] font-black text-amber-400 flex items-center gap-1">
                        <Flame className="w-3 h-3" /> {SPECIAL_HAND_CN[p.specialHand].name} (+{SPECIAL_HAND_CN[p.specialHand].points}分)
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
                    {p.finalPoints >= 0 ? `+${p.finalPoints}` : p.finalPoints} 分
                  </div>
                )}
              </div>

              {/* 3 Duns */}
              <div className="w-full flex flex-col items-center gap-2.5 pt-2">
                {/* 1. FRONT DUN */}
                <div
                  className={`w-full flex flex-col items-center p-2 rounded-2xl transition-all ${
                    currentStep === 'front'
                      ? 'bg-blue-500/20 ring-2 ring-blue-500'
                      : 'bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between w-full text-[11px] text-slate-400 mb-1 px-1">
                    <span className="font-bold">前墩 (3张)</span>
                    {showFront && (
                      <span className="font-extrabold text-blue-300">
                        {HAND_TYPE_CN[p.frontScore.type] || p.frontScore.type}
                        {p.frontScore.bonusPoints ? ` (+${p.frontScore.bonusPoints})` : ''}
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
                      ? 'bg-indigo-500/20 ring-2 ring-indigo-500'
                      : 'bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between w-full text-[11px] text-slate-400 mb-1 px-1">
                    <span className="font-bold">中墩 (5张)</span>
                    {showMid && (
                      <span className="font-extrabold text-indigo-300">
                        {HAND_TYPE_CN[p.midScore.type] || p.midScore.type}
                        {p.midScore.bonusPoints ? ` (+${p.midScore.bonusPoints})` : ''}
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
                      ? 'bg-purple-500/20 ring-2 ring-purple-500'
                      : 'bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between w-full text-[11px] text-slate-400 mb-1 px-1">
                    <span className="font-bold">后墩 (5张)</span>
                    {showBack && (
                      <span className="font-extrabold text-purple-300">
                        {HAND_TYPE_CN[p.backScore.type] || p.backScore.type}
                        {p.backScore.bonusPoints ? ` (+${p.backScore.bonusPoints})` : ''}
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
                  ⚠️ 倒水判负 (-6分/人)
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
          <p className="text-slate-400">前墩只比三条、对子与高牌。若前墩拿三条，触发“冲三”额外加 3 分！</p>
        </div>
      )}

      {currentStep === 'middle' && (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 text-center text-slate-300 text-xs font-medium space-y-1">
          <div className="font-bold text-sm text-indigo-400">🔷 第二步：中墩 (5 张) 策略比拼</div>
          <p className="text-slate-400">中墩若出现同花顺(+10分)、铁支(+8分)、葫芦(+2分)享有墩位特殊翻倍加分。</p>
        </div>
      )}

      {currentStep === 'back' && (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 text-center text-slate-300 text-xs font-medium space-y-1">
          <div className="font-bold text-sm text-purple-400">🟣 第三步：后墩 (5 张) 决胜压轴</div>
          <p className="text-slate-400">后墩为整手牌最强压轴墩位，决定谁能在最后关头锁住胜局！</p>
        </div>
      )}

      {currentStep === 'guns' && (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col items-center gap-3 text-center">
          <div className="text-2xl font-black text-amber-400 flex items-center gap-2">
            💥 打枪与全垒打翻倍判定
          </div>
          <div className="text-xs text-slate-300 max-w-lg leading-relaxed">
            {results.some(r => r.isHomeRun) ? (
              <span className="text-yellow-300 font-bold">
                👑 震撼全场！有玩家完成【全垒打】（通杀全场对手），总积分翻倍！
              </span>
            ) : results.some(r => Object.values(r.dunScores).some(d => d.isGun)) ? (
              <span className="text-orange-300 font-bold">
                🔫 发生打枪！三墩全胜的对决得分直接翻倍！
              </span>
            ) : (
              <span className="text-slate-400">
                本局无通杀三墩打枪，双方比分平稳入账。
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
              本局净胜得分:{' '}
              <span
                className={`text-2xl font-black ${
                  userResult.finalPoints >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {userResult.finalPoints >= 0 ? `+${userResult.finalPoints}` : userResult.finalPoints} 分
              </span>
            </p>
          </div>

          {/* Opponent Matchup Breakdown Table */}
          <div className="w-full max-w-xl bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-xs">
            <div className="font-bold text-slate-400 mb-3 text-left flex items-center gap-1.5">
              <Award className="w-4 h-4 text-blue-400" /> 对阵各对手详细得分明细:
            </div>
            <div className="space-y-2">
              {results
                .filter(p => p.playerId !== userResult.playerId)
                .map(opp => {
                  const dunInfo = userResult.dunScores[opp.playerId];
                  if (!dunInfo) return null;

                  const pt = dunInfo.total;
                  return (
                    <div
                      key={opp.playerId}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{opp.avatar}</span>
                        <span className="font-bold text-white">{opp.name}</span>
                        {dunInfo.isGun && (
                          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.5 rounded font-black">
                            被打枪
                          </span>
                        )}
                      </div>
                      <div
                        className={`font-black text-sm ${
                          pt >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {pt >= 0 ? `+${pt}` : pt} 分
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={onPlayAgain}
              className="px-7 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-xl shadow-blue-600/30 flex items-center gap-2 transition active:scale-95"
            >
              <RotateCcw className="w-4 h-4" /> 再来一局
            </button>
            <button
              onClick={onBackToMenu}
              className="px-6 py-3.5 rounded-2xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-sm transition"
            >
              返回大厅
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
