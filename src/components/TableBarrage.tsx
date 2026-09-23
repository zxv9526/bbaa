import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Play, Square, MessageSquare, Radio } from 'lucide-react';
import { ChatMessage } from '../types';

interface TableBarrageProps {
  messages: ChatMessage[];
  enabled: boolean;
  onPlayVoice?: (msg: ChatMessage) => void;
  playingAudioId?: string | null;
}

interface BarrageItem {
  id: string;
  msg: ChatMessage;
  lane: number; // 0, 1, or 2
  createdAt: number;
}

export function TableBarrage({
  messages,
  enabled,
  onPlayVoice,
  playingAudioId
}: TableBarrageProps) {
  const [activeBarrages, setActiveBarrages] = useState<BarrageItem[]>([]);
  const processedMsgIdsRef = useRef<Set<string>>(new Set());

  // Watch for new messages and spawn barrage items
  useEffect(() => {
    if (!enabled || messages.length === 0) return;

    const latest = messages[messages.length - 1];
    if (!latest || processedMsgIdsRef.current.has(latest.id)) return;

    // Only process messages created within the last 6 seconds
    if (Date.now() - latest.timestamp > 6000) return;

    processedMsgIdsRef.current.add(latest.id);

    // Pick lane with least active items
    const laneCounts = [0, 0, 0];
    activeBarrages.forEach(b => {
      if (b.lane >= 0 && b.lane < 3) laneCounts[b.lane]++;
    });
    const chosenLane = laneCounts.indexOf(Math.min(...laneCounts));

    const newItem: BarrageItem = {
      id: 'barrage_' + latest.id + '_' + Date.now(),
      msg: latest,
      lane: chosenLane,
      createdAt: Date.now()
    };

    setActiveBarrages(prev => [...prev.slice(-5), newItem]);

    // Auto-remove after 7.5 seconds
    const timer = setTimeout(() => {
      setActiveBarrages(prev => prev.filter(b => b.id !== newItem.id));
    }, 7500);

    return () => clearTimeout(timer);
  }, [messages, enabled]);

  // Clean up old barrages periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveBarrages(prev => prev.filter(b => now - b.createdAt < 7500));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!enabled || activeBarrages.length === 0) return null;

  return (
    <div className="absolute inset-x-0 top-12 sm:top-16 z-30 pointer-events-none overflow-hidden h-28 sm:h-32">
      {activeBarrages.map((item) => {
        const { msg, lane } = item;
        const isVoice = msg.type === 'voice';
        const isPlaying = playingAudioId === msg.id;

        return (
          <div
            key={item.id}
            style={{
              top: `${lane * 36 + 6}px`,
              animation: 'barrageSlide 7.5s linear forwards'
            }}
            className="absolute left-full whitespace-nowrap flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-slate-700/80 shadow-xl pointer-events-auto cursor-pointer hover:border-emerald-500/80 transition group"
            onClick={() => {
              if (isVoice && onPlayVoice) {
                onPlayVoice(msg);
              }
            }}
            title={isVoice ? '点击收听该语音' : msg.content}
          >
            {/* Avatar & Seat badge */}
            <div className="relative flex items-center justify-center text-sm shrink-0">
              <span>{msg.senderAvatar || '👤'}</span>
              {typeof msg.seatIndex === 'number' && (
                <span className="absolute -bottom-1 -right-1 px-1 rounded-full text-[8px] font-black bg-indigo-600 text-white border border-indigo-400 leading-none">
                  {msg.seatIndex + 1}
                </span>
              )}
            </div>

            {/* Sender name */}
            <span className="text-[11px] font-bold text-slate-300 max-w-[80px] truncate">
              {msg.isUser ? '我' : msg.senderName}:
            </span>

            {/* Content or Voice Bar */}
            {isVoice ? (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black">
                {isPlaying ? (
                  <Square className="w-3 h-3 fill-current text-rose-400 animate-pulse" />
                ) : (
                  <Volume2 className="w-3 h-3 text-emerald-400 group-hover:scale-110 transition-transform" />
                )}
                <span>微信语音 {msg.audioDuration || 2}"</span>
                {/* Audio wave equalizer */}
                <div className="flex items-end gap-0.5 h-2.5 ml-0.5">
                  <span className={`w-0.5 bg-emerald-400 rounded-full ${isPlaying ? 'h-2.5 animate-bounce' : 'h-1.5'}`} />
                  <span className={`w-0.5 bg-emerald-300 rounded-full ${isPlaying ? 'h-3 animate-pulse' : 'h-2'}`} />
                  <span className={`w-0.5 bg-emerald-400 rounded-full ${isPlaying ? 'h-2 animate-bounce' : 'h-1'}`} />
                </div>
              </div>
            ) : msg.type === 'emoji' ? (
              <span className="text-lg leading-none">{msg.content}</span>
            ) : (
              <span className="text-xs font-semibold text-slate-100 max-w-[200px] sm:max-w-[320px] truncate">
                {msg.content}
              </span>
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes barrageSlide {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(calc(-100vw - 380px));
          }
        }
      `}</style>
    </div>
  );
}
