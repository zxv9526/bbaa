import React from 'react';
import { Card } from '../types';
import { cn } from '../lib/utils';

interface CardViewProps {
  key?: React.Key;
  card?: Card;
  onClick?: () => void;
  selected?: boolean;
  isFaceDown?: boolean;
  disabled?: boolean;
  highlight?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  badge?: string;
}

export function CardView({
  card,
  onClick,
  selected,
  isFaceDown = false,
  disabled = false,
  highlight = false,
  size = 'md',
  className,
  badge
}: CardViewProps) {
  const sizeClasses = {
    sm: 'w-11 h-16 sm:w-12 sm:h-18 text-xs p-1 rounded-lg',
    md: 'w-14 h-20 sm:w-16 sm:h-24 text-sm p-1.5 rounded-xl',
    lg: 'w-16 h-24 sm:w-20 sm:h-28 text-base p-2 rounded-xl'
  }[size];

  // Empty placeholder slot
  if (!card && !isFaceDown) {
    return (
      <div
        onClick={disabled ? undefined : onClick}
        className={cn(
          sizeClasses,
          'border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-center transition-all duration-150',
          !disabled && 'cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 active:scale-95',
          className
        )}
      >
        <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 bg-white/40 dark:bg-slate-700/40" />
      </div>
    );
  }

  // Face down card (牌背)
  if (isFaceDown) {
    return (
      <div
        className={cn(
          sizeClasses,
          'bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 border border-blue-400/30 shadow-sm flex items-center justify-center select-none overflow-hidden relative',
          className
        )}
      >
        <div className="absolute inset-1 border border-blue-300/20 rounded-md flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border border-blue-300/30 flex items-center justify-center text-blue-200/40 text-[10px] font-black">
            13
          </div>
        </div>
      </div>
    );
  }

  if (!card) return null;

  const isRed = card.suit === 'H' || card.suit === 'D';
  const suitSymbol = {
    S: '♠',
    H: '♥',
    C: '♣',
    D: '♦'
  }[card.suit];

  const rankStr = card.rank <= 10 ? card.rank.toString() : {
    11: 'J',
    12: 'Q',
    13: 'K',
    14: 'A'
  }[card.rank];

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={cn(
        sizeClasses,
        'bg-white border-2 flex flex-col justify-between select-none shadow-sm transition-all duration-150 relative cursor-pointer',
        isRed ? 'text-rose-600' : 'text-slate-900',
        selected
          ? 'border-blue-600 shadow-md ring-2 ring-blue-400 -translate-y-2.5 z-20 bg-blue-50/20'
          : highlight
          ? 'border-amber-400 ring-2 ring-amber-300 shadow-md'
          : 'border-slate-200 hover:border-blue-300 hover:shadow hover:-translate-y-1',
        disabled && 'cursor-default opacity-90 hover:translate-y-0',
        className
      )}
    >
      {badge && (
        <span className="absolute -top-2.5 -right-2.5 z-30 bg-indigo-600 text-white font-bold text-[10px] px-1.5 py-0.5 rounded-full shadow">
          {badge}
        </span>
      )}
      
      {/* Top Left */}
      <div className="flex items-center gap-0.5 leading-none">
        <span className="font-extrabold tracking-tighter">{rankStr}</span>
        <span className="text-[11px] sm:text-xs leading-none">{suitSymbol}</span>
      </div>

      {/* Center Suit */}
      <div className="text-xl sm:text-2xl font-normal leading-none self-center opacity-90 my-auto">
        {suitSymbol}
      </div>

      {/* Bottom Right */}
      <div className="flex items-center gap-0.5 leading-none self-end rotate-180">
        <span className="font-extrabold tracking-tighter">{rankStr}</span>
        <span className="text-[11px] sm:text-xs leading-none">{suitSymbol}</span>
      </div>
    </div>
  );
}
