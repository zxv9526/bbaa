import React, { useEffect, useState } from 'react';
import { Card } from '../types';
import { cn } from '../lib/utils';
import {
  getCustomCardAsset,
  getCardAssetUrls,
  getBackAssetUrls,
  getCardCanonicalKey,
  subscribeToSkinChanges,
  markStaticUrlStatus
} from '../lib/cardSkin';

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
  const [, setSkinVersion] = useState(0);
  const [imgErrorIndex, setImgErrorIndex] = useState(0);
  const [hasFallbackToDefault, setHasFallbackToDefault] = useState(false);

  // Subscribe to custom skin updates
  useEffect(() => {
    return subscribeToSkinChanges(() => {
      setSkinVersion(v => v + 1);
      setImgErrorIndex(0);
      setHasFallbackToDefault(false);
    });
  }, []);

  const sizeClasses = {
    sm: 'w-12 h-17 sm:w-14 sm:h-20 text-xs rounded-lg shrink-0',
    md: 'w-[94px] h-[132px] min-[375px]:w-[102px] min-[375px]:h-[144px] min-[414px]:w-[112px] min-[414px]:h-[158px] sm:w-[130px] sm:h-[182px] md:w-[145px] md:h-[202px] text-base sm:text-lg rounded-xl shrink-0',
    lg: 'w-26 h-37 sm:w-34 sm:h-48 text-lg rounded-xl shrink-0'
  }[size];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && onClick) {
      onClick();
    }
  };

  // Empty placeholder slot
  if (!card && !isFaceDown) {
    return (
      <div
        onClick={handleClick}
        className={cn(
          sizeClasses,
          'border border-slate-700/50 bg-slate-800/40 flex items-center justify-center transition-all duration-150 rounded-lg sm:rounded-xl',
          !disabled &&
            'cursor-pointer hover:bg-blue-900/30 active:scale-95',
          className
        )}
      >
        <div className="w-4 h-4 rounded-md bg-slate-700/40" />
      </div>
    );
  }

  const asset = getCustomCardAsset(card, isFaceDown);

  // Fallback candidate URLs list
  const candidateUrls = isFaceDown
    ? getBackAssetUrls()
    : card
    ? getCardAssetUrls(card.rank, card.suit)
    : [];

  const currentImgUrl =
    asset?.imageUrl && imgErrorIndex === 0
      ? asset.imageUrl
      : candidateUrls[imgErrorIndex] || null;

  const handleImageError = () => {
    if (imgErrorIndex + 1 < candidateUrls.length) {
      setImgErrorIndex(prev => prev + 1);
    } else {
      setHasFallbackToDefault(true);
      if (card) {
        markStaticUrlStatus(getCardCanonicalKey(card.rank, card.suit), '', false);
      } else if (isFaceDown) {
        markStaticUrlStatus('back', '', false);
      }
    }
  };

  const handleImageLoad = () => {
    if (card && currentImgUrl) {
      markStaticUrlStatus(getCardCanonicalKey(card.rank, card.suit), currentImgUrl, true);
    } else if (isFaceDown && currentImgUrl) {
      markStaticUrlStatus('back', currentImgUrl, true);
    }
  };

  // Face down card (牌背)
  if (isFaceDown) {
    if (asset?.isSvgText) {
      return (
        <div
          onClick={handleClick}
          className={cn(
            sizeClasses,
            'flex items-center justify-center select-none overflow-hidden relative border border-slate-700/60 p-0 rounded-lg sm:rounded-xl shadow-sm',
            className
          )}
          dangerouslySetInnerHTML={{ __html: asset.isSvgText }}
        />
      );
    }

    if (!hasFallbackToDefault && currentImgUrl) {
      return (
        <div
          onClick={handleClick}
          className={cn(
            sizeClasses,
            'flex items-center justify-center select-none overflow-hidden relative border border-slate-700/60 p-0 rounded-lg sm:rounded-xl bg-slate-900 shadow-sm',
            className
          )}
        >
          <img
            src={currentImgUrl}
            alt="Card Back"
            onError={handleImageError}
            onLoad={handleImageLoad}
            className="w-full h-full object-fill rounded-lg sm:rounded-xl select-none pointer-events-none block border-0"
            loading="eager"
          />
        </div>
      );
    }

    // Built-in Default Blue Face-down back with rounded corners
    return (
      <div
        onClick={handleClick}
        className={cn(
          sizeClasses,
          'bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 border border-slate-700/60 flex items-center justify-center select-none overflow-hidden relative rounded-lg sm:rounded-xl shadow-sm',
          className
        )}
      >
        <div className="w-6 h-6 rounded-md flex items-center justify-center text-blue-200/40 text-[10px] font-black border border-blue-400/20">
          13
        </div>
      </div>
    );
  }

  if (!card) return null;

  // Custom Raw SVG String
  if (asset?.isSvgText) {
    return (
      <div
        onClick={handleClick}
        className={cn(
          sizeClasses,
          'transition-all duration-150 relative cursor-pointer select-none overflow-hidden p-0 flex items-center justify-center rounded-lg sm:rounded-xl shadow-sm',
          selected
            ? 'ring-4 ring-rose-500 border-2 border-rose-500 shadow-md'
            : highlight
            ? 'ring-3 ring-amber-400 border border-slate-200/80 shadow-md'
            : 'border border-slate-200/80',
          disabled && 'cursor-default opacity-90',
          className
        )}
      >
        {badge && (
          <span className="absolute -top-1 -right-1 z-10 bg-indigo-600 text-white font-bold text-[10px] px-1.5 py-0.5 rounded-full shadow">
            {badge}
          </span>
        )}
        <div
          className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:rounded-lg sm:[&>svg]:rounded-xl [&>svg]:border-0 [&>svg]:block"
          dangerouslySetInnerHTML={{ __html: asset.isSvgText }}
        />
      </div>
    );
  }

  // Custom Image URL
  if (!hasFallbackToDefault && currentImgUrl) {
    return (
      <div
        onClick={handleClick}
        className={cn(
          sizeClasses,
          'transition-all duration-150 relative cursor-pointer select-none overflow-hidden p-0 flex items-center justify-center rounded-lg sm:rounded-xl bg-white shadow-sm',
          selected
            ? 'ring-4 ring-rose-500 border-2 border-rose-500 shadow-md'
            : highlight
            ? 'ring-3 ring-amber-400 border border-slate-200/80 shadow-md'
            : 'border border-slate-200/80',
          disabled && 'cursor-default opacity-90',
          className
        )}
      >
        {badge && (
          <span className="absolute -top-1 -right-1 z-10 bg-indigo-600 text-white font-bold text-[10px] px-1.5 py-0.5 rounded-full shadow">
            {badge}
          </span>
        )}
        <img
          src={currentImgUrl}
          alt={`${card.rank}-${card.suit}`}
          onError={handleImageError}
          onLoad={handleImageLoad}
          className="w-full h-full object-fill rounded-lg sm:rounded-xl select-none pointer-events-none block border-0"
          loading="eager"
        />
      </div>
    );
  }

  // Built-in Crisp Vector Card Fallback with rounded corners
  const isRed = card.suit === 'H' || card.suit === 'D';
  const suitSymbol = {
    S: '♠',
    H: '♥',
    C: '♣',
    D: '♦'
  }[card.suit];

  const rankStr =
    card.rank <= 10
      ? card.rank.toString()
      : {
          11: 'J',
          12: 'Q',
          13: 'K',
          14: 'A'
        }[card.rank];

  return (
    <div
      onClick={handleClick}
      className={cn(
        sizeClasses,
        'bg-white p-1.5 flex flex-col justify-between select-none shadow-sm transition-all duration-150 relative cursor-pointer rounded-lg sm:rounded-xl',
        isRed ? 'text-rose-600' : 'text-slate-900',
        selected
          ? 'ring-4 ring-rose-500 border-2 border-rose-500 shadow-md'
          : highlight
          ? 'ring-3 ring-amber-400 border border-slate-300'
          : 'border border-slate-200/90 dark:border-slate-300',
        disabled && 'cursor-default opacity-90',
        className
      )}
    >
      {badge && (
        <span className="absolute -top-2 -right-2 z-10 bg-indigo-600 text-white font-bold text-[10px] px-1.5 py-0.5 rounded-full shadow">
          {badge}
        </span>
      )}

      {/* Top Left */}
      <div className="flex items-center gap-0.5 leading-none">
        <span className="font-black text-base sm:text-lg tracking-tighter">{rankStr}</span>
        <span className="text-base sm:text-lg leading-none">{suitSymbol}</span>
      </div>

      {/* Center Suit */}
      <div className="text-4xl sm:text-5xl font-normal leading-none self-center opacity-90 my-auto">
        {suitSymbol}
      </div>

      {/* Bottom Right */}
      <div className="flex items-center gap-0.5 leading-none self-end rotate-180">
        <span className="font-black text-base sm:text-lg tracking-tighter">{rankStr}</span>
        <span className="text-base sm:text-lg leading-none">{suitSymbol}</span>
      </div>
    </div>
  );
}
