import React from 'react';
import { X, CheckCircle2, User, VolumeX, Sparkles, ArrowRight, Shield, Layers } from 'lucide-react';
import { Carriage } from '../lib/carriageManager';
import { triggerHaptic } from '../lib/haptics';

interface ReservationSeatModalProps {
  isOpen: boolean;
  onClose: () => void;
  carriageIndex: number;
  carriage: Carriage | null;
  currentUserId?: string;
  onSelectSeat: (seatIndex: number) => void;
  title?: string;
  subtitle?: string;
  previousRoundResult?: {
    roundIndex: number;
    seatNumber: number;
    pointsWon: number;
  } | null;
  onAdvanceToNextRound?: () => void;
}

export function ReservationSeatModal({
  isOpen,
  onClose,
  carriageIndex,
  carriage,
  currentUserId = 'player_user',
  onSelectSeat,
  title = '预约场 · 选择入座位置',
  subtitle,
  previousRoundResult,
  onAdvanceToNextRound
}: ReservationSeatModalProps) {
  if (!isOpen) return null;

  const totalSeats = 8;
  const submissions = carriage?.submissions || {};

  // Count occupied seats
  const occupiedCount = Object.keys(submissions).length;
  const allOccupied = occupiedCount >= totalSeats;

  const handleSeatClick = (seatIndex: number, isOccupied: boolean) => {
    if (isOccupied) {
      triggerHaptic('warning');
      return;
    }
    triggerHaptic('success');
    onSelectSeat(seatIndex);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-blue-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/25 border border-blue-500/40 text-blue-400 flex items-center justify-center text-xl font-black shadow-inner">
              📅
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-wide">{title}</h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-black font-mono">
                  第 {carriageIndex} 局
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {subtitle || '1-8号座位对应8副独立手牌 · 请挑选席位进入理牌'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="p-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Previous round feedback banner (if just transitioned from previous round) */}
        {previousRoundResult && (
          <div className="bg-emerald-950/70 border-b border-emerald-500/30 px-5 py-2.5 flex items-center justify-between text-xs text-emerald-300 font-bold shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                上一局 (第 {previousRoundResult.roundIndex} 局 · {previousRoundResult.seatNumber}号座位) 理牌已提交！
                战绩：<span className="font-black font-mono text-amber-300">{previousRoundResult.pointsWon >= 0 ? `+${previousRoundResult.pointsWon}` : previousRoundResult.pointsWon} 水</span>
              </span>
            </div>
            <span className="text-[11px] text-emerald-400/80">已保存战绩</span>
          </div>
        )}

        {/* Instructions & Quiet badge */}
        <div className="bg-slate-950/80 border-b border-slate-800/80 px-5 py-2.5 flex items-center justify-between text-xs text-slate-300 shrink-0">
          <div className="flex items-center gap-2 text-slate-400">
            <Layers className="w-4 h-4 text-blue-400 shrink-0" />
            <span>选择座位后立即发对应 13 张手牌，理牌提交后可继续选座进入下一局。</span>
          </div>
          <span className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-blue-300 bg-blue-500/15 px-2 py-0.5 rounded-full border border-blue-500/30">
            <VolumeX className="w-3 h-3 text-blue-400" />
            <span>静音纯净专场</span>
          </span>
        </div>

        {/* 1-8 Seats Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 no-scrollbar space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
            <span>席位一览 (1-8号座位)</span>
            <span>已入座: <span className="text-amber-400 font-mono font-black">{occupiedCount}</span> / {totalSeats}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: totalSeats }).map((_, seatIdx) => {
              const seatNum = seatIdx + 1;
              const sub = submissions[seatIdx];
              const isOccupied = Boolean(sub);
              const isSelf = isOccupied && (sub.playerId === currentUserId || sub.playerId === 'player_user');

              return (
                <div
                  key={seatIdx}
                  id={`seat-card-${seatNum}`}
                  onClick={() => handleSeatClick(seatIdx, isOccupied)}
                  className={`relative p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3 text-center ${
                    isSelf
                      ? 'bg-emerald-950/30 border-emerald-500/40 opacity-90 cursor-not-allowed'
                      : isOccupied
                      ? 'bg-slate-950/60 border-slate-800 opacity-70 cursor-not-allowed'
                      : 'bg-gradient-to-b from-slate-800/80 to-slate-900 border-blue-500/30 hover:border-amber-400/80 hover:from-slate-800 hover:to-slate-850 hover:shadow-lg hover:shadow-amber-500/10 cursor-pointer group active:scale-[0.98]'
                  }`}
                >
                  {/* Seat badge & number */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                      isSelf
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : isOccupied
                        ? 'bg-slate-800 text-slate-400 border border-slate-700'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30 group-hover:bg-amber-500/20 group-hover:text-amber-300 group-hover:border-amber-500/40'
                    }`}>
                      {seatNum}号位置
                    </span>

                    <span className="text-[10px] text-slate-400 font-mono">
                      手牌 #{seatNum}
                    </span>
                  </div>

                  {/* Center Visual */}
                  <div className="py-2 flex flex-col items-center justify-center">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition ${
                      isSelf
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                        : isOccupied
                        ? 'bg-slate-800/80 border border-slate-700 text-slate-400'
                        : 'bg-blue-600/20 border border-blue-500/30 text-blue-300 group-hover:scale-110 group-hover:border-amber-400/50 group-hover:bg-amber-500/20 group-hover:text-amber-200'
                    }`}>
                      {isSelf ? '✅' : isOccupied ? (sub.avatar || '👤') : '🪑'}
                    </div>

                    <div className="mt-2 text-xs font-bold truncate max-w-full">
                      {isSelf ? (
                        <span className="text-emerald-300">本人已交牌</span>
                      ) : isOccupied ? (
                        <span className="text-slate-400">{sub.playerName || `玩家${seatNum}`}</span>
                      ) : (
                        <span className="text-white group-hover:text-amber-300 transition">空闲待入座</span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {isSelf ? (
                        <span className="text-emerald-400/80 text-[10px]">已记录本座战绩</span>
                      ) : isOccupied ? (
                        <span className="text-slate-400 text-[10px]">已提交手牌</span>
                      ) : (
                        <span className="text-blue-300/80 group-hover:text-amber-300/80 transition text-[10px]">
                          13张手牌待理
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Button / Status Tag */}
                  <div className="pt-1">
                    {isSelf ? (
                      <div className="w-full py-1.5 rounded-xl bg-emerald-500/10 text-emerald-300 text-[11px] font-bold border border-emerald-500/20">
                        本局已完成
                      </div>
                    ) : isOccupied ? (
                      <div className="w-full py-1.5 rounded-xl bg-slate-800 text-slate-400 text-[11px] font-medium border border-slate-700">
                        席位已被占
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="w-full py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 group-hover:from-amber-500 group-hover:to-orange-500 text-white group-hover:text-slate-950 text-xs font-black transition shadow-sm"
                      >
                        入座理牌
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* All seats occupied notice */}
          {allOccupied && onAdvanceToNextRound && (
            <div className="p-4 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-center space-y-2">
              <div className="text-sm font-black text-amber-300">
                本局 (第 {carriageIndex} 局) 8个席位已全部理牌完毕！
              </div>
              <p className="text-xs text-amber-200/80">
                可以立即开启并进入第 {carriageIndex + 1} 局选座
              </p>
              <button
                onClick={onAdvanceToNextRound}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs rounded-xl shadow transition active:scale-95 cursor-pointer"
              >
                开启第 {carriageIndex + 1} 局选座
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950/90 border-t border-slate-800 px-5 py-3 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span>选座后自动绑定该席位手牌与结算记录，预防混淆</span>
          </div>

          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            返回大厅
          </button>
        </div>

      </div>
    </div>
  );
}
