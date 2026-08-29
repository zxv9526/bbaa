import React, { useState, useEffect } from 'react';
import { Carriage, CarriagePoolStats, getCompletedCarriagesList, getCarriageStats, resetCarriagePool, setPlayerCarriageIndexProgress } from '../lib/carriageManager';
import { PlayerScoreDetail } from '../types';
import { ShowdownStage } from './ShowdownStage';
import {
  Train,
  Layers,
  Trophy,
  RotateCcw,
  X,
  ChevronRight,
  Sparkles,
  Zap,
  Flame,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Award
} from 'lucide-react';

interface CarriageHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCarriageIndex: number;
  onSelectCarriageIndex: (index: number) => void;
  onResetPool: () => void;
}

export function CarriageHubModal({
  isOpen,
  onClose,
  currentCarriageIndex,
  onSelectCarriageIndex,
  onResetPool
}: CarriageHubModalProps) {
  const [stats, setStats] = useState<CarriagePoolStats>(() => getCarriageStats());
  const [completedList, setCompletedList] = useState<Carriage[]>([]);
  const [inspectCarriage, setInspectCarriage] = useState<Carriage | null>(null);

  useEffect(() => {
    if (isOpen) {
      refreshData();
    }
  }, [isOpen]);

  const refreshData = () => {
    const s = getCarriageStats();
    setStats(s);
    setCompletedList(getCompletedCarriagesList());
  };

  if (!isOpen) return null;

  // Calculate total net points won in completed carriages
  const totalNetPoints = completedList.reduce((acc, c) => {
    const userResult = c.matchResults?.find(r => r.playerId === 'player_user');
    return acc + (userResult?.finalPoints || 0);
  }, 0);

  const handleReset = () => {
    if (window.confirm('确定要刷新并重新生成 300 局预发牌车厢库吗？')) {
      resetCarriagePool();
      onResetPool();
      refreshData();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Train className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                异步发牌车厢控制中心
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold">
                  8人模式 300局预存
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                进入车厢自动接力发牌 • 提交后秒入下一节车厢 • 自动补足300局库存
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
        {inspectCarriage && inspectCarriage.matchResults ? (
          <div className="p-6 overflow-y-auto flex-1">
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => setInspectCarriage(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition flex items-center gap-1.5"
              >
                ← 返回车厢战绩名录
              </button>
              <div className="text-xs text-slate-400 font-mono">
                车厢编号: #{inspectCarriage.index} | 完成时间: {new Date(inspectCarriage.completedAt || '').toLocaleString('zh-CN')}
              </div>
            </div>

            <ShowdownStage
              results={inspectCarriage.matchResults}
              onPlayAgain={() => setInspectCarriage(null)}
              onBackToMenu={() => setInspectCarriage(null)}
            />
          </div>
        ) : (
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            
            {/* Top Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800/60 border border-slate-750 p-4 rounded-2xl">
                <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                  <Train className="w-4 h-4 text-blue-400" />
                  当前车厢
                </div>
                <div className="mt-2 text-2xl font-black text-blue-400 font-mono">
                  第 {currentCarriageIndex} 节
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  即刻准备理牌
                </div>
              </div>

              <div className="bg-slate-800/60 border border-slate-750 p-4 rounded-2xl">
                <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-400" />
                  预发牌库存
                </div>
                <div className="mt-2 text-2xl font-black text-amber-400 font-mono">
                  {stats.unclaimedCount} <span className="text-sm font-normal text-slate-400">/ 300局</span>
                </div>
                <div className="mt-1 text-[11px] text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  低于50局自动满额
                </div>
              </div>

              <div className="bg-slate-800/60 border border-slate-750 p-4 rounded-2xl">
                <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  已战车厢数
                </div>
                <div className="mt-2 text-2xl font-black text-emerald-400 font-mono">
                  {stats.completedCount} 节
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  8人场实时结算
                </div>
              </div>

              <div className="bg-slate-800/60 border border-slate-750 p-4 rounded-2xl">
                <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-purple-400" />
                  车厢累计赢输
                </div>
                <div className={`mt-2 text-2xl font-black font-mono ${totalNetPoints >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {totalNetPoints >= 0 ? `+${totalNetPoints}` : totalNetPoints} 水
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  全服自动清算
                </div>
              </div>
            </div>

            {/* How carriage async mode works */}
            <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 border border-indigo-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  车厢发牌说明（异步接力机制）
                </div>
                <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                  系统已为您预先生成并洗好了 300 局 8 人模式（双副 104 张牌）车厢。您在第 1 节车厢提交理牌后，系统将自动清算本局并瞬移为您发放第 2 节车厢的扑克牌，无需任何等待！
                </p>
              </div>

              <button
                onClick={handleReset}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                重新生成300局牌库
              </button>
            </div>

            {/* Completed Carriage History Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  已完成车厢战绩明细 ({completedList.length} 局)
                </h3>
              </div>

              {completedList.length === 0 ? (
                <div className="py-12 text-center bg-slate-800/30 border border-slate-800 rounded-2xl">
                  <Train className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-slate-400">暂无已完成车厢记录</p>
                  <p className="text-xs text-slate-500 mt-1">进入第 {currentCarriageIndex} 节车厢理牌即可开启体验！</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {completedList.map(c => {
                    const userResult = c.matchResults?.find(r => r.playerId === 'player_user');
                    const netPts = userResult?.finalPoints || 0;
                    const isWin = netPts > 0;
                    const isLoss = netPts < 0;

                    return (
                      <div
                        key={c.id}
                        className="p-3.5 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-750/60 rounded-xl flex items-center justify-between transition group"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs font-mono ${
                            isWin ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            isLoss ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                            'bg-slate-700 text-slate-300'
                          }`}>
                            #{c.index}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-2">
                              第 {c.index} 节车厢
                              {userResult?.specialHand && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px]">
                                  {userResult.specialHand}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                              <span>8人大局比拼</span>
                              <span>•</span>
                              <span>{new Date(c.completedAt || '').toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className={`text-sm font-black font-mono ${
                            isWin ? 'text-amber-400' : isLoss ? 'text-rose-400' : 'text-slate-400'
                          }`}>
                            {netPts > 0 ? `+${netPts}` : netPts} 水
                          </div>

                          <button
                            onClick={() => setInspectCarriage(c)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-xs font-bold transition flex items-center gap-1 border border-blue-500/30"
                          >
                            复盘比牌 <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            支持多车厢无限连战，提交即刻自动进入下一节车厢
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition"
          >
            确定并返回游戏
          </button>
        </div>

      </div>
    </div>
  );
}
