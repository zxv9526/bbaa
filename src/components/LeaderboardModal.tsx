import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api';
import { GameRecord, PlayerStats } from '../types';
import { Trophy, History, X, RefreshCw, Medal } from 'lucide-react';
import { HAND_TYPE_CN } from '../gameLogic';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlayerName: string;
}

export function LeaderboardModal({ isOpen, onClose, currentPlayerName }: LeaderboardModalProps) {
  const [tab, setTab] = useState<'leaderboard' | 'history'>('leaderboard');
  const [loading, setLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState<PlayerStats[]>([]);
  const [history, setHistory] = useState<GameRecord[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, tab]);

  const loadData = async () => {
    setLoading(true);
    if (tab === 'leaderboard') {
      const res = await ApiClient.getStats();
      setLeaderboard(res.leaderboard || []);
    } else {
      const records = await ApiClient.getGameHistory(undefined, 30);
      setHistory(records);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2 bg-slate-200/80 dark:bg-slate-800 p-1 rounded-2xl">
            <button
              onClick={() => setTab('leaderboard')}
              className={`px-4 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
                tab === 'leaderboard'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              全球风云榜 (D1)
            </button>
            <button
              onClick={() => setTab('history')}
              className={`px-4 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
                tab === 'history'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              对局历史记录
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="刷新"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] text-sm">
          {tab === 'leaderboard' ? (
            <div>
              {leaderboard.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  暂无排行榜数据，快来完成第一局对决吧！
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {leaderboard.map((item, index) => {
                    const isSelf = item.name === currentPlayerName;
                    return (
                      <div
                        key={item.id || index}
                        className={`py-3.5 px-3 flex items-center justify-between rounded-xl transition ${
                          isSelf ? 'bg-blue-50/50 dark:bg-blue-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 flex justify-center">
                            {index === 0 ? (
                              <Medal className="w-6 h-6 text-amber-500" />
                            ) : index === 1 ? (
                              <Medal className="w-6 h-6 text-slate-400" />
                            ) : index === 2 ? (
                              <Medal className="w-6 h-6 text-amber-700" />
                            ) : (
                              <span className="font-bold text-xs text-slate-400">#{index + 1}</span>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              {item.name}
                              {isSelf && (
                                <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-bold">
                                  你
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              胜率: {item.totalGames > 0 ? Math.round((item.wins / item.totalGames) * 100) : 0}% (
                              {item.wins}胜 / {item.losses}负 / {item.draws}平)
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className={`font-black text-sm ${item.totalPoints >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {item.totalPoints >= 0 ? `+${item.totalPoints}` : item.totalPoints} 净分
                          </div>
                          {item.specialHandsCount > 0 && (
                            <div className="text-[10px] text-amber-600 font-medium">
                              {item.specialHandsCount}次 特殊牌
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>
              {history.length === 0 ? (
                <div className="py-12 text-center text-slate-400">暂无对局历史</div>
              ) : (
                <div className="space-y-3">
                  {history.map((h, i) => (
                    <div
                      key={h.id || i}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`font-black px-2 py-0.5 rounded-full text-[11px] ${
                              h.result === 'WIN' || h.result === 'SPECIAL_WIN'
                                ? 'bg-emerald-100 text-emerald-700'
                                : h.result === 'LOSE'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {h.result === 'WIN' ? '胜利' : h.result === 'SPECIAL_WIN' ? '特殊牌大胜' : h.result === 'LOSE' ? '失利' : '平局'}
                          </span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">{h.playerName}</span>
                          <span className="text-slate-400">({'八人场'})</span>
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          牌型: 前墩[{HAND_TYPE_CN[h.frontType as any] || h.frontType}] / 中墩[{HAND_TYPE_CN[h.midType as any] || h.midType}] / 后墩[{HAND_TYPE_CN[h.backType as any] || h.backType}]
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-black text-base ${h.pointsWon >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {h.pointsWon >= 0 ? `+${h.pointsWon}` : h.pointsWon} 分
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(h.createdAt).toLocaleDateString()} {new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
