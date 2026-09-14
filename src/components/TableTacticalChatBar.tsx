import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  Radio,
  Zap,
  X,
  Sparkles,
  Headphones,
  Sliders,
  Smile
} from 'lucide-react';
import {
  VoiceRecorder,
  OpenMicListener,
  playRadioChirpStart,
  playRadioChirpEnd,
  createSimulatedVoiceAudioUrl,
  QUICK_PHRASE_GROUPS,
  CHAT_EMOJIS
} from '../lib/chatManager';
import { triggerHaptic } from '../lib/haptics';
import { ChatMessage } from '../types';

interface TableTacticalChatBarProps {
  onSendMessage: (type: 'text' | 'voice' | 'quick' | 'emoji', content: string, audioUrl?: string, audioDuration?: number) => void;
  onOpenFullChat: () => void;
  ttsEnabled: boolean;
  onToggleTts: () => void;
  unreadCount?: number;
  latestMessage?: ChatMessage | null;
  activeSpeakerId?: string | null;
  onUserSpeakingChange?: (speaking: boolean) => void;
}

export function TableTacticalChatBar({
  onSendMessage,
  onOpenFullChat,
  ttsEnabled,
  onToggleTts,
  unreadCount = 0,
  latestMessage,
  activeSpeakerId: externalSpeakerId,
  onUserSpeakingChange
}: TableTacticalChatBarProps) {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [showQuickVoice, setShowQuickVoice] = useState(false);
  const [showQuickEmoji, setShowQuickEmoji] = useState(false);
  const [currentVolume, setCurrentVolume] = useState<number>(0);
  const [voiceMode, setVoiceMode] = useState<'ptt' | 'openMic'>('ptt');
  const [isOpenMicActive, setIsOpenMicActive] = useState(false);
  const [isOpenMicMuted, setIsOpenMicMuted] = useState(false);
  const [isSlideCancel, setIsSlideCancel] = useState(false);

  const [activeSpeaker, setActiveSpeaker] = useState<{
    id: string;
    name: string;
    avatar: string;
    text: string;
    isVoice: boolean;
    seatBadge?: string;
    dealerBadge?: boolean;
  } | null>(null);

  const recorderRef = useRef<VoiceRecorder | null>(null);
  const openMicRef = useRef<OpenMicListener | null>(null);
  const timerRef = useRef<any>(null);
  const speakerTimerRef = useRef<any>(null);
  const pointerStartYRef = useRef<number>(0);
  const isPointerDownRef = useRef<boolean>(false);

  // Monitor latestMessage for active speaker ripple effect
  useEffect(() => {
    if (latestMessage) {
      const isRecent = Date.now() - latestMessage.timestamp < 4500;
      if (isRecent) {
        if (speakerTimerRef.current) clearTimeout(speakerTimerRef.current);
        
        const seatBadge = typeof latestMessage.seatIndex === 'number'
          ? `${latestMessage.seatIndex + 1}号位`
          : undefined;

        setActiveSpeaker({
          id: latestMessage.senderId,
          name: latestMessage.senderName,
          avatar: latestMessage.senderAvatar || '👤',
          text: latestMessage.type === 'voice' 
            ? '正在语音对讲中...' 
            : latestMessage.content.length > 14 
            ? latestMessage.content.slice(0, 14) + '...' 
            : latestMessage.content,
          isVoice: latestMessage.type === 'voice',
          seatBadge,
          dealerBadge: latestMessage.isDealer
        });

        speakerTimerRef.current = setTimeout(() => {
          setActiveSpeaker(null);
        }, latestMessage.type === 'voice' ? 4500 : 3500);
      }
    }
    return () => {
      if (speakerTimerRef.current) clearTimeout(speakerTimerRef.current);
    };
  }, [latestMessage]);

  // Handle Open Mic cleanup on unmount
  useEffect(() => {
    return () => {
      if (openMicRef.current) {
        openMicRef.current.stop();
        openMicRef.current = null;
      }
    };
  }, []);

  // 1. PTT Voice Record Routine
  const startVoiceRecord = async () => {
    if (isRecording) return;
    try {
      playRadioChirpStart();
      triggerHaptic('medium');
      const recorder = new VoiceRecorder();
      recorder.onVolume = (vol) => {
        setCurrentVolume(vol);
      };
      recorderRef.current = recorder;
      await recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      setIsSlideCancel(false);
      if (onUserSpeakingChange) onUserSpeakingChange(true);

      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= 15) {
            stopVoiceRecordAndSend();
            return 15;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.warn('Microphone recording error:', err);
    }
  };

  const stopVoiceRecordAndSend = async () => {
    if (!recorderRef.current || !isRecording) return;
    clearInterval(timerRef.current);
    setIsRecording(false);
    setCurrentVolume(0);
    if (onUserSpeakingChange) onUserSpeakingChange(false);

    try {
      if (isSlideCancel) {
        recorderRef.current.cancel();
        triggerHaptic('light');
        return;
      }

      playRadioChirpEnd();
      triggerHaptic('success');
      const { audioUrl, duration } = await recorderRef.current.stop();
      if (duration < 0.4) {
        return;
      }
      onSendMessage('voice', `[对讲语音 ${Math.max(1, Math.round(duration))}秒]`, audioUrl, Math.max(1, Math.round(duration)));
    } catch (err) {
      console.error('Stop voice error:', err);
    } finally {
      recorderRef.current = null;
      setIsSlideCancel(false);
    }
  };

  const cancelVoiceRecord = () => {
    if (!recorderRef.current || !isRecording) return;
    clearInterval(timerRef.current);
    setIsRecording(false);
    setCurrentVolume(0);
    setIsSlideCancel(false);
    if (onUserSpeakingChange) onUserSpeakingChange(false);
    triggerHaptic('light');
    try {
      recorderRef.current.cancel();
    } catch {}
    recorderRef.current = null;
  };

  // Pointer hold-to-talk handlers (for mobile and mouse)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (voiceMode !== 'ptt' || isRecording) return;
    isPointerDownRef.current = true;
    pointerStartYRef.current = e.clientY;
    startVoiceRecord();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isRecording || !isPointerDownRef.current) return;
    const diffY = pointerStartYRef.current - e.clientY;
    if (diffY > 40) {
      if (!isSlideCancel) {
        setIsSlideCancel(true);
        triggerHaptic('heavy');
      }
    } else {
      if (isSlideCancel) setIsSlideCancel(false);
    }
  };

  const handlePointerUp = () => {
    if (isPointerDownRef.current && isRecording) {
      isPointerDownRef.current = false;
      stopVoiceRecordAndSend();
    }
  };

  // 2. Open-Mic Mode Toggle
  const toggleOpenMicMode = async () => {
    if (voiceMode === 'ptt') {
      // Switch to Open Mic
      setVoiceMode('openMic');
      const listener = new OpenMicListener();
      listener.onVolume = (vol) => {
        setCurrentVolume(vol);
      };
      listener.onSpeakingChange = (speaking) => {
        if (onUserSpeakingChange) onUserSpeakingChange(speaking);
      };
      listener.onVoiceSnippet = (audioUrl, duration) => {
        onSendMessage('voice', `[自由麦语音 ${duration}秒]`, audioUrl, duration);
      };
      const ok = await listener.start();
      if (ok) {
        openMicRef.current = listener;
        setIsOpenMicActive(true);
        setIsOpenMicMuted(false);
        triggerHaptic('success');
      } else {
        setVoiceMode('ptt');
        alert('无法访问麦克风，请确认浏览器已授予麦克风权限');
      }
    } else {
      // Switch back to PTT
      if (openMicRef.current) {
        openMicRef.current.stop();
        openMicRef.current = null;
      }
      setIsOpenMicActive(false);
      setVoiceMode('ptt');
      setCurrentVolume(0);
      if (onUserSpeakingChange) onUserSpeakingChange(false);
      triggerHaptic('light');
    }
  };

  const toggleMuteOpenMic = () => {
    if (!openMicRef.current) return;
    const newMute = !isOpenMicMuted;
    openMicRef.current.setMuted(newMute);
    setIsOpenMicMuted(newMute);
    triggerHaptic('light');
  };

  const handleSubmitText = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    triggerHaptic('light');
    onSendMessage('text', trimmed);
    setInputText('');
  };

  const handleSendQuickVoicePhrase = (phrase: string) => {
    playRadioChirpStart();
    triggerHaptic('medium');
    setShowQuickVoice(false);
    const audioUrl = createSimulatedVoiceAudioUrl(2, 340 + Math.random() * 80);
    onSendMessage('voice', phrase, audioUrl, 2);
  };

  const handleSendQuickEmoji = (emoji: string) => {
    triggerHaptic('light');
    setShowQuickEmoji(false);
    onSendMessage('emoji', emoji);
  };

  // Calculate live volume LED bar active count (1 to 5)
  const volumeLevel = Math.min(5, Math.ceil(currentVolume / 18));

  return (
    <div className="relative w-full select-none">
      {/* 🚀 Quick Voice Tactical Phrases Popover */}
      {showQuickVoice && (
        <div className="absolute bottom-full left-0 mb-2 w-72 sm:w-80 bg-slate-900/95 border border-indigo-500/50 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md z-50 animate-in slide-in-from-bottom-2 fade-in">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>战术快捷语音 (电台播报)</span>
            </div>
            <button
              onClick={() => setShowQuickVoice(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-1 max-h-52 overflow-y-auto no-scrollbar">
            {QUICK_PHRASE_GROUPS.flatMap(g => g.phrases).slice(0, 12).map((phrase, idx) => (
              <button
                key={idx}
                onClick={() => handleSendQuickVoicePhrase(phrase)}
                className="text-left px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-indigo-600/30 hover:border-indigo-400/50 border border-slate-700/60 text-slate-200 hover:text-white text-xs font-medium transition flex items-center justify-between group active:scale-98 cursor-pointer"
              >
                <span className="truncate">{phrase}</span>
                <span className="text-[10px] text-indigo-300 opacity-0 group-hover:opacity-100 transition shrink-0 ml-1">🔊 广播</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 😀 Quick Emoji Reaction Popover */}
      {showQuickEmoji && (
        <div className="absolute bottom-full left-12 sm:left-24 mb-2 w-64 bg-slate-900/95 border border-amber-500/50 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md z-50 animate-in slide-in-from-bottom-2 fade-in">
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
              <Smile className="w-3.5 h-3.5 text-amber-400" />
              <span>快速表情反应</span>
            </div>
            <button
              onClick={() => setShowQuickEmoji(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-6 gap-1.5 max-h-44 overflow-y-auto no-scrollbar">
            {CHAT_EMOJIS.slice(0, 18).map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleSendQuickEmoji(emoji)}
                className="h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 flex items-center justify-center text-lg hover:scale-125 active:scale-90 transition cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Tactical Bar */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-2 py-1.5 shadow-md flex items-center justify-between gap-2 shrink-0 backdrop-blur">
        {/* 1. Left Voice & Mode Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* PTT Recording Active State */}
          {isRecording ? (
            <div
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="flex items-center gap-1.5 animate-in fade-in"
            >
              <button
                onClick={stopVoiceRecordAndSend}
                className={`px-2.5 py-1 rounded-xl text-white font-black text-xs flex items-center gap-1.5 shadow-lg transition active:scale-95 cursor-pointer ${
                  isSlideCancel
                    ? 'bg-amber-600 ring-2 ring-amber-400'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/60 animate-pulse'
                }`}
              >
                <Radio className="w-3.5 h-3.5 animate-spin" />
                <span>{isSlideCancel ? '松开取消' : `松开发送 (${recordingSeconds}s)`}</span>

                {/* Real-time Sound Wave Equalizer from Mic Volume */}
                <div className="flex items-end gap-0.5 h-3 ml-1">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <span
                      key={lvl}
                      className={`w-0.5 rounded-full transition-all duration-75 ${
                        volumeLevel >= lvl
                          ? lvl > 3 ? 'bg-amber-300 h-3' : 'bg-emerald-300 h-2.5'
                          : 'bg-white/30 h-1'
                      }`}
                    />
                  ))}
                </div>
              </button>
              <button
                onClick={cancelVoiceRecord}
                className="p-1 text-slate-400 hover:text-rose-300 rounded-lg hover:bg-slate-800 text-xs transition cursor-pointer"
                title="取消录音"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : voiceMode === 'openMic' ? (
            /* 🎙️ Open Mic Mode Active View */
            <div className="flex items-center gap-1">
              <button
                onClick={toggleMuteOpenMic}
                className={`px-2.5 py-1 rounded-xl border text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer shadow ${
                  isOpenMicMuted
                    ? 'bg-rose-950/60 border-rose-500 text-rose-300'
                    : 'bg-emerald-950/70 border-emerald-500 text-emerald-300'
                }`}
                title={isOpenMicMuted ? '点击取消麦克风静音' : '自由麦已开启 (点击临时静音)'}
              >
                {isOpenMicMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />}
                <span className="hidden xs:inline">{isOpenMicMuted ? '静音中' : '自由麦'}</span>

                {/* Real-time Level Bars */}
                {!isOpenMicMuted && (
                  <div className="flex items-end gap-0.5 h-2.5 ml-1">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <span
                        key={lvl}
                        className={`w-0.5 rounded-full transition-all duration-75 ${
                          volumeLevel >= lvl ? 'bg-emerald-400 h-2.5' : 'bg-emerald-950 h-1'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </button>

              {/* Mode Switch Button (Back to PTT) */}
              <button
                onClick={toggleOpenMicMode}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition cursor-pointer"
                title="切换回按键对讲 (PTT)"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            /* 🎙️ Default PTT Mode View */
            <div className="flex items-center gap-1">
              <button
                onPointerDown={handlePointerDown}
                onClick={startVoiceRecord}
                className="px-2.5 py-1 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 hover:text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 shadow cursor-pointer touch-none"
                title="按住对讲 / 点击开始录音"
              >
                <Mic className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden xs:inline">按住对讲</span>
              </button>

              {/* Toggle to Open Mic (自由麦) */}
              <button
                onClick={toggleOpenMicMode}
                className="px-1.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-emerald-300 text-xs font-bold transition active:scale-95 cursor-pointer"
                title="开启自由麦 (免按键说话)"
              >
                <Headphones className="w-3.5 h-3.5" />
              </button>

              {/* ⚡ Quick Voice Tactical Phrases Button */}
              <button
                onClick={() => {
                  setShowQuickVoice(!showQuickVoice);
                  setShowQuickEmoji(false);
                }}
                className={`px-2 py-1 rounded-xl border text-xs font-bold flex items-center gap-1 transition active:scale-95 shadow cursor-pointer ${
                  showQuickVoice
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-800/80 hover:bg-slate-750 border-slate-700 text-amber-400/90 hover:text-amber-300'
                }`}
                title="快捷战术语音"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span className="hidden sm:inline">快捷</span>
              </button>

              {/* 😀 Quick Emoji Button */}
              <button
                onClick={() => {
                  setShowQuickEmoji(!showQuickEmoji);
                  setShowQuickVoice(false);
                }}
                className={`px-1.5 py-1 rounded-xl border text-xs font-bold flex items-center gap-1 transition active:scale-95 shadow cursor-pointer ${
                  showQuickEmoji
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-800/80 hover:bg-slate-750 border-slate-700 text-amber-400/90 hover:text-amber-300'
                }`}
                title="表情反应"
              >
                <Smile className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* TTS Toggle */}
          <button
            onClick={onToggleTts}
            className={`p-1 rounded-lg border text-xs transition cursor-pointer ${
              ttsEnabled
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}
            title={ttsEnabled ? '语音朗读已开启 (点击静音)' : '语音朗读已静音 (点击开启)'}
          >
            {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* 2. Middle Area: Active Voice Speaker Ripple Animation OR Text Input */}
        {activeSpeaker ? (
          <div
            onClick={onOpenFullChat}
            className="flex-1 flex items-center gap-2 px-2 py-0.5 rounded-lg bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 min-w-0 cursor-pointer animate-in fade-in transition hover:bg-emerald-950/90"
            title="点击查看消息记录"
          >
            {/* 🌟 Radiant Multi-layer Pulsing Ripple Avatar */}
            <div className="relative flex items-center justify-center w-6 h-6 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-65 animate-ping" />
              <span className="absolute -inset-1 rounded-full border-2 border-emerald-400/70 animate-pulse ring-2 ring-emerald-500/30" />
              <span className="relative z-10 text-sm">{activeSpeaker.avatar}</span>
            </div>

            {/* Speaker identity & content */}
            <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 truncate">
                {activeSpeaker.seatBadge && (
                  <span className="px-1 py-0.2 rounded text-[9px] font-black bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 shrink-0">
                    {activeSpeaker.seatBadge}
                  </span>
                )}
                {activeSpeaker.dealerBadge && (
                  <span className="px-1 py-0.2 rounded text-[9px] font-black bg-amber-500/30 text-amber-200 border border-amber-400/40 shrink-0">
                    👑庄
                  </span>
                )}
                <span className="text-xs font-black text-amber-300 truncate max-w-[65px] sm:max-w-[90px]">
                  {activeSpeaker.name}
                </span>
                <span className="text-[11px] text-emerald-200/90 truncate">
                  {activeSpeaker.text}
                </span>
              </div>

              {/* Dynamic Sound Wave Equalizer Bars */}
              <div className="flex items-end gap-0.5 h-3 shrink-0 mr-1">
                <span className="w-0.5 h-2 bg-emerald-400 animate-pulse" />
                <span className="w-0.5 h-3 bg-emerald-300 animate-bounce" />
                <span className="w-0.5 h-1.5 bg-emerald-400 animate-pulse" />
                <span className="w-0.5 h-2.5 bg-emerald-300 animate-bounce" />
              </div>
            </div>
          </div>
        ) : (
          /* Direct Text Input Form */
          <form onSubmit={handleSubmitText} className="flex-1 flex items-center gap-1.5 min-w-0">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isRecording ? '录音中...' : '输入战术喊话...'}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">发送</span>
            </button>
          </form>
        )}

        {/* 3. Open Full Chat Drawer Button */}
        <div className="flex items-center shrink-0">
          <button
            onClick={onOpenFullChat}
            className="relative px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer shadow"
            title="打开完整对讲抽屉"
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">聊天</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 min-w-[16px] text-center rounded-full bg-rose-500 text-white text-[9px] font-black absolute -top-1 -right-1 shadow-md animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

