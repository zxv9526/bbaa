import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Volume2, Mic, Play, Square } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatFloatingWidgetProps {
  activeMessages: ChatMessage[];
  onOpenChat: () => void;
  unreadCount?: number;
}

export function ChatFloatingWidget({
  activeMessages,
  onOpenChat,
  unreadCount = 0
}: ChatFloatingWidgetProps) {
  // Current active bubble to display (latest message within 5 seconds)
  const [currentBubble, setCurrentBubble] = useState<ChatMessage | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (activeMessages.length > 0) {
      const latest = activeMessages[activeMessages.length - 1];
      // If message is newer than 6 seconds
      if (Date.now() - latest.timestamp < 6000) {
        setCurrentBubble(latest);
        const timer = setTimeout(() => {
          setCurrentBubble(null);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [activeMessages]);

  const handlePlayVoice = (e: React.MouseEvent, msg: ChatMessage) => {
    e.stopPropagation();
    if (!msg.audioUrl) return;

    if (playingAudioId === msg.id && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setPlayingAudioId(null);
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    const audio = new Audio(msg.audioUrl);
    audioPlayerRef.current = audio;
    setPlayingAudioId(msg.id);

    audio.onended = () => setPlayingAudioId(null);
    audio.onerror = () => setPlayingAudioId(null);
    audio.play().catch(() => setPlayingAudioId(null));
  };

  return (
    <>
      {/* Floating Active Speech Bubble (Floats gracefully in the table viewport) */}
      {currentBubble && (
        <div
          onClick={onOpenChat}
          className="fixed top-20 right-4 sm:right-8 z-40 max-w-xs sm:max-w-sm bg-slate-900/95 border-2 border-indigo-500/80 rounded-2xl p-3 shadow-2xl backdrop-blur-md cursor-pointer animate-in slide-in-from-top-4 fade-in duration-300 hover:scale-102 transition"
        >
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-500/50 flex items-center justify-center text-sm shrink-0">
              {currentBubble.senderAvatar || '👤'}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="text-xs font-black text-amber-300 truncate">
                  {currentBubble.senderName}
                </span>
                <span className="text-[10px] text-slate-400 shrink-0">刚刚发言</span>
              </div>

              {currentBubble.type === 'voice' ? (
                <button
                  onClick={(e) => handlePlayVoice(e, currentBubble)}
                  className="mt-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow cursor-pointer active:scale-95 transition"
                >
                  {playingAudioId === currentBubble.id ? (
                    <Square className="w-3.5 h-3.5 fill-current text-rose-300 animate-pulse" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current text-white" />
                  )}
                  <span>点击收听语音 ({currentBubble.audioDuration || 2}")</span>
                  <span className="text-xs">🔊</span>
                </button>
              ) : currentBubble.type === 'emoji' ? (
                <div className="text-2xl mt-0.5">{currentBubble.content}</div>
              ) : (
                <div className="text-xs text-white leading-relaxed font-medium break-words">
                  {currentBubble.content}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Chat Trigger Button (Fixed at convenient bottom-right) */}
      <button
        id="btn-floating-chat"
        onClick={onOpenChat}
        className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-30 group p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600 text-white shadow-xl shadow-indigo-950/60 border border-indigo-400/40 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
        title="打开牌桌聊天与语音对讲"
      >
        <div className="relative">
          <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border-2 border-slate-900" />
          )}
        </div>
        <div className="hidden min-[480px]:flex flex-col items-start leading-none text-left pr-1">
          <span className="text-xs font-black tracking-wide">聊天 / 语音</span>
          <span className="text-[10px] text-indigo-200 mt-0.5">语音对讲 · 自由文本</span>
        </div>
      </button>
    </>
  );
}
