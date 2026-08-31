import React, { useState, useEffect } from 'react';
import { History, X, Trophy, ChevronRight, Layers, ArrowLeft } from 'lucide-react';
import { getMatchReplays, MatchReplayItem, PlayerReplayData } from '../lib/matchReplay';
import { CardView } from './CardView';
import { SPECIAL_HAND_CN } from '../gameLogic';

interface MatchReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  phone: string;
}

export function MatchReplayModal({ isOpen, onClose, phone }: MatchReplayModalProps) {
  const [replays, setReplays] = useState<MatchReplayItem[]>([]);
  const [selectedReplay, setSelectedReplay] = useState<MatchReplayItem | null>(null);

  useEffect(() => {
    if (isOpen) {
      const list = getMatchReplays(phone);
      setReplays(list);
      setSelectedReplay(null);
    }
  }, [isOpen, phone]);

  if (!isOpen) return null;

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            {selectedReplay ? (
              <button
                onClick={() => setSelectedReplay(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition mr-1"
                title="返回列表"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <History className="w-4 h-4" />
              </div>
            )}
            <div>
              <h3 className="text-base font-black text-white">
                {selectedReplay ? `第 ${selectedReplay.carriageIndex} 局手牌复盘` : '对局手牌复盘'}
              </h3>
              <p className="text-xs text-slate-400">
                {selectedReplay 
                  ? `${selectedReplay.mode === 'vs_ai_8p' ? '八人场' : selectedReplay.mode === 'vs_ai_4p' ? '四人场' : '双人场'} • ${formatDate(selectedReplay.timestamp)}`
                  : '查看最近 20 局对局手牌与比牌记录'
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {selectedReplay ? (
            /* Detailed Match View */
            <div className="space-y-4">
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center justify-between text-xs">
                <span className="text-slate-300 font-bold">{selectedReplay.summaryText}</span>
                <span className={`font-black text-sm ${selectedReplay.myScore >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  我的最终得分: {selectedReplay.myScore >= 0 ? `+${selectedReplay.myScore}` : selectedReplay.myScore} 水
                </span>
              </div>

              <div className="space-y-3">
                {selectedReplay.players.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    className={`p-3.5 rounded-2xl border transition ${
                      p.isMe
                        ? 'bg-blue-950/30 border-blue-500/50 shadow-md shadow-blue-500/5'
                        : 'bg-slate-950/50 border-slate-800/80'
                    }`}
                  >
                    {/* Player Info Header */}
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{p.avatar}</span>
                        <span className="text-xs font-bold text-white">
                          {p.name} {p.isMe && <span className="text-[10px] text-blue-400 font-black ml-1">(我)</span>}
                        </span>
                        {p.isHomeRun && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            👑 全垒打
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-black ${p.finalScore >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {p.finalScore >= 0 ? `+${p.finalScore}` : p.finalScore} 水
                      </span>
                    </div>

                    {/* Special Hand or 3 Duns */}
                    {p.specialHand ? (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
                        <span className="text-xs font-black text-amber-300">
                          🌟 特殊牌型: {SPECIAL_HAND_CN[p.specialHand]?.name || p.specialHand}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Front Dun */}
                        <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-[11px] font-bold text-slate-400">前墩</span>
                            <span className="text-[11px] text-blue-300 font-medium">
                              {p.frontEval?.typeName ? `[${p.frontEval.typeName}]` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                            {p.front.map(c => (
                              <CardView key={c.id} card={c} size="sm" />
                            ))}
                          </div>
                        </div>

                        {/* Mid Dun */}
                        <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                            <span className="text-[11px] font-bold text-slate-400">中墩</span>
                            <span className="text-[11px] text-indigo-300 font-medium">
                              {p.midEval?.typeName ? `[${p.midEval.typeName}]` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                            {p.mid.map(c => (
                              <CardView key={c.id} card={c} size="sm" />
                            ))}
                          </div>
                        </div>

                        {/* Back Dun */}
                        <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="w-2 h-2 rounded-full bg-purple-500" />
                            <span className="text-[11px] font-bold text-slate-400">后墩</span>
                            <span className="text-[11px] text-purple-300 font-medium">
                              {p.backEval?.typeName ? `[${p.backEval.typeName}]` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                            {p.back.map(c => (
                              <CardView key={c.id} card={c} size="sm" />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Replays List */
            replays.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <History className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-50" />
                <p className="text-sm font-bold">暂无对局复盘记录</p>
                <p className="text-xs text-slate-500 mt-1">完成任意一局牌局后将自动记录手牌详情</p>
              </div>
            ) : (
              <div className="space-y-2">
                {replays.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedReplay(r)}
                    className="w-full p-3.5 rounded-2xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 text-left transition flex items-center justify-between group active:scale-[0.99] cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                        r.myScore >= 0
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {r.myScore >= 0 ? `+${r.myScore}` : r.myScore}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{r.mode === 'vs_ai_8p' ? '八人场' : r.mode === 'vs_ai_4p' ? '四人场' : '双人单挑'} • 第 {r.carriageIndex} 局</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>{formatDate(r.timestamp)}</span>
                          <span className="text-slate-600">•</span>
                          <span className="truncate max-w-[200px]">{r.summaryText}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400 group-hover:text-amber-400 transition text-xs font-bold">
                      <span>查看明细</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                ))}
              </div>
            )
          )}
        </div>

      </div>
    </div>
  );
}
