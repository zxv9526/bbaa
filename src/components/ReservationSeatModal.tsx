import React from 'react';
import { X, CheckCircle2, ChevronLeft, ChevronRight, Sparkles, Shield, Play, Layers } from 'lucide-react';
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
  onSwitchRound?: (round: number) => void;
  onAdvanceToNextRound?: () => void;
}

export function ReservationSeatModal({
  isOpen,
  onClose,
  carriageIndex,
  carriage,
  currentUserId = 'player_user',
  onSelectSeat,
  title = '预约场 · 选定席位 (10局周期)',
  subtitle,
  previousRoundResult,
  onSwitchRound,
  onAdvanceToNextRound
}: ReservationSeatModalProps) {
  if (!isOpen) return null;

  const totalSeats = 8;
  const submissions = carriage?.submissions || {};
  const occupiedCount = Object.keys(submissions).length;
  const isAllOccupied = occupiedCount >= totalSeats;

  const handleSeatClick = (seatIndex: number) => {
    triggerHaptic('success');
    onSelectSeat(seatIndex);
  };

  const cycleStartRound = Math.floor((carriageIndex - 1) / 10) * 10 + 1;
  const cycleEndRound = cycleStartRound + 9;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      {/* Modal Card - Strictly no scrolling, compact layout */}
      <div className="w-full max-w-2xl bg-slate-900 border border-blue-500/40 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Compact Header */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 px-3.5 sm:px-5 py-2.5 sm:py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600/25 border border-blue-500/40 text-blue-400 flex items-center justify-center text-lg sm:text-xl font-black shadow-inner shrink-0">
              📅
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white tracking-wide">{title}</h3>
                
                {/* Cycle Badge */}
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] sm:text-xs font-bold font-mono">
                  第 {cycleStartRound}~{cycleEndRound} 局
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-300">
                {subtitle || '每10局仅需选择一次位置 · 选定后后续9局将默认保持该席位'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                triggerHaptic('light');
                onClose();
              }}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Previous round feedback banner if available */}
        {previousRoundResult && (
          <div className="bg-emerald-950/70 border-b border-emerald-500/30 px-3.5 sm:px-5 py-1.5 flex items-center justify-between text-[11px] sm:text-xs text-emerald-300 font-bold shrink-0">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                第 {previousRoundResult.roundIndex} 局 · {previousRoundResult.seatNumber}号位手牌已提交！
                战绩：<span className="font-mono text-amber-300">{previousRoundResult.pointsWon >= 0 ? `+${previousRoundResult.pointsWon}` : previousRoundResult.pointsWon} 水</span>
              </span>
            </div>
            <span className="text-[10px] text-emerald-400/80">已打满周期，开启新一轮选座</span>
          </div>
        )}

        {/* Status sub-bar */}
        <div className="bg-slate-950/70 border-b border-slate-800/60 px-3.5 sm:px-5 py-1.5 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5 text-blue-300 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>首局自选席位，后续 9 局连战免选座无缝开打</span>
          </div>
          <div className="text-slate-300 font-mono text-[10px] sm:text-[11px]">
            当前局: <span className="text-amber-400 font-bold">第 {carriageIndex} 局</span>
          </div>
        </div>

        {/* 8 Seats Grid: 4 columns x 2 rows, strictly fitting in container without scrolling */}
        <div className="p-2.5 sm:p-4 bg-slate-950/30">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5">
            {Array.from({ length: totalSeats }).map((_, seatIdx) => {
              const seatNum = seatIdx + 1;
              const sub = submissions[seatIdx];
              const isOccupied = Boolean(sub);
              const isSelf = isOccupied && (sub.playerId === currentUserId || sub.playerId === 'player_user');

              return (
                <div
                  key={seatIdx}
                  id={`reservation-seat-${seatNum}`}
                  onClick={() => handleSeatClick(seatIdx)}
                  className="relative p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border transition-all duration-150 flex flex-col justify-between items-center text-center bg-gradient-to-b from-slate-850 to-slate-900 border-blue-500/30 hover:border-amber-400 hover:from-slate-800 hover:to-slate-850 hover:shadow-md hover:shadow-amber-500/10 cursor-pointer group active:scale-[0.97]"
                >
                  {/* Top: Seat number & hand index */}
                  <div className="w-full flex items-center justify-between">
                    <span className="text-[10px] sm:text-[11px] font-black px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/40 group-hover:bg-amber-500/25 group-hover:text-amber-300 group-hover:border-amber-500/50 transition">
                      {seatNum}号位
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      #{seatNum}
                    </span>
                  </div>

                  {/* Middle: Icon & state */}
                  <div className="my-1 sm:my-1.5 flex flex-col items-center justify-center">
                    <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center text-sm sm:text-lg transition bg-blue-600/15 border border-blue-500/30 text-blue-300 group-hover:scale-105 group-hover:border-amber-400/60 group-hover:bg-amber-500/20 group-hover:text-amber-200 shadow-inner">
                      {isSelf ? '✅' : isOccupied ? (sub.avatar || '👤') : '🪑'}
                    </div>

                    <div className="mt-1 text-[10px] sm:text-xs font-bold truncate max-w-full leading-tight">
                      {isSelf ? (
                        <span className="text-emerald-300">本人已交</span>
                      ) : isOccupied ? (
                        <span className="text-slate-300">{sub.playerName || `玩家${seatNum}`}</span>
                      ) : (
                        <span className="text-slate-200 group-hover:text-amber-300 transition">待入座</span>
                      )}
                    </div>
                  </div>

                  {/* Bottom: Compact action button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSeatClick(seatIdx);
                    }}
                    className="w-full py-1 sm:py-1.5 px-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 group-hover:from-amber-500 group-hover:to-orange-500 text-white group-hover:text-slate-950 text-[10px] sm:text-[11px] font-black transition shadow flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Play className="w-2.5 h-2.5 fill-current shrink-0" />
                    <span>选定此位 (连战10局)</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Compact Footer */}
        <div className="bg-slate-950/90 border-t border-slate-800 px-3.5 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="hidden sm:inline">每10局可重选一次位置 · 选定后后续9局默认该位置</span>
            <span className="sm:hidden">每10局可选一次位 · 连续10局锁定</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                triggerHaptic('light');
                onClose();
              }}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              返回大厅
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
