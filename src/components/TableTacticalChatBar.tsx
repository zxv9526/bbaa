import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Mic,
  Volume2,
  VolumeX,
  Send,
  Radio,
  Zap,
  X,
  Sparkles
} from 'lucide-react';
import {
  VoiceRecorder,
  playRadioChirpStart,
  playRadioChirpEnd,
  createSimulatedVoiceAudioUrl,
  QUICK_PHRASE_GROUPS
} from '../lib/chatManager';
import { triggerHaptic } from '../lib/haptics';
import { ChatMessage } from '../types';

interface TableTacticalChatBarProps {
  onSendMessage: (type: 'text' | 'voice' | 'quick', content: string, audioUrl?: string, audioDuration?: number) => void;
  onOpenFullChat: () => void;
  ttsEnabled: boolean;
  onToggleTts: () => void;
  unreadCount?: number;
  latestMessage?: ChatMessage | null;
  activeSpeakerId?: string | null;
}

export function TableTacticalChatBar({
  onSendMessage,
  onOpenFullChat,
  ttsEnabled,
  onToggleTts,
  unreadCount = 0,
  latestMessage,
  activeSpeakerId: externalSpeakerId
}: TableTacticalChatBarProps) {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [showQuickVoice, setShowQuickVoice] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<{
    id: string;
    name: string;
    avatar: string;
    text: string;
    isVoice: boolean;
  } | null>(null);

  const recorderRef = useRef<VoiceRecorder | null>(null);
  const timerRef = useRef<any>(null);
  const speakerTimerRef = useRef<any>(null);
  const holdStartRef = useRef<number>(0);

  // Monitor latestMessage for active speaker ripple effect
  useEffect(() => {
    if (latestMessage) {
      const isRecent = Date.now() - latestMessage.timestamp < 4500;
      if (isRecent) {
        if (speakerTimerRef.current) clearTimeout(speakerTimerRef.current);
        
        setActiveSpeaker({
          id: latestMessage.senderId,
          name: latestMessage.senderName,
          avatar: latestMessage.senderAvatar || '👤',
          text: latestMessage.type === 'voice' 
            ? '正在语音对讲中...' 
            : latestMessage.content.length > 10 
            ? latestMessage.content.slice(0, 10) + '...' 
            : latestMessage.content,
          isVoice: latestMessage.type === 'voice'
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

  const startVoiceRecord = async () => {
    if (isRecording) return;
    try {
      playRadioChirpStart();
      triggerHaptic('medium');
      const recorder = new VoiceRecorder();
      recorderRef.current = recorder;
      await recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      holdStartRef.current = Date.now();

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

    try {
      playRadioChirpEnd();
      triggerHaptic('success');
      const { audioUrl, duration } = await recorderRef.current.stop();
      if (duration < 0.4) {
        return;
      }
      onSendMessage('voice', `[语音消息 ${Math.max(1, Math.round(duration))}秒]`, audioUrl, Math.max(1, Math.round(duration)));
    } catch (err) {
      console.error('Stop voice error:', err);
    } finally {
      recorderRef.current = null;
    }
  };

  const cancelVoiceRecord = () => {
    if (!recorderRef.current || !isRecording) return;
    clearInterval(timerRef.current);
    setIsRecording(false);
    triggerHaptic('light');
    try {
      recorderRef.current.cancel();
    } catch {}
    recorderRef.current = null;
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

  return (
    <div className="relative w-full">
      {/* 🚀 Quick Voice Tactical Phrases Popover */}
      {showQuickVoice && (
        <div className="absolute bottom-full left-0 mb-2 w-72 sm:w-80 bg-slate-900/95 border border-indigo-500/50 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md z-50 animate-in slide-in-from-bottom-2 fade-in">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
            <div className="flex items-center gap-1 text-xs font-black text-amber-300">
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>战术快捷语音 (一键对讲)</span>
            </div>
            <button
              onClick={() => setShowQuickVoice(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto no-scrollbar">
            {QUICK_PHRASE_GROUPS.flatMap(g => g.phrases).slice(0, 8).map((phrase, idx) => (
              <button
                key={idx}
                onClick={() => handleSendQuickVoicePhrase(phrase)}
                className="text-left px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-indigo-600/30 hover:border-indigo-400/50 border border-slate-700/60 text-slate-200 hover:text-white text-xs font-medium transition flex items-center justify-between group active:scale-98 cursor-pointer"
              >
                <span className="truncate">{phrase}</span>
                <span className="text-[10px] text-indigo-300 opacity-0 group-hover:opacity-100 transition shrink-0 ml-1">🔊 播报</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Tactical Bar */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-2 py-1.5 shadow-md flex items-center justify-between gap-2 shrink-0 backdrop-blur">
        {/* 1. Left Voice & Tactical Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Recording Mode Indicator & Controls */}
          {isRecording ? (
            <div className="flex items-center gap-1.5 animate-in fade-in">
              <button
                onClick={stopVoiceRecordAndSend}
                className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-rose-950/60 animate-pulse cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5 animate-spin" />
                <span>松开发送 ({recordingSeconds}s)</span>
                {/* Audio Wave Bars */}
                <div className="flex items-end gap-0.5 h-3 ml-0.5">
                  <span className="w-0.5 h-2 bg-white animate-pulse" />
                  <span className="w-0.5 h-3 bg-white animate-bounce" />
                  <span className="w-0.5 h-1.5 bg-white animate-pulse" />
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
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={startVoiceRecord}
                className="px-2.5 py-1 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 hover:text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 shadow cursor-pointer"
                title="点击开始录音对讲"
              >
                <Mic className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden xs:inline">对讲</span>
              </button>

              {/* ⚡ Quick Voice Tactical Phrases Button */}
              <button
                onClick={() => setShowQuickVoice(!showQuickVoice)}
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
            {/* 🌟 Radiant Multi-layer Pulsing Ripple Avatar (波纹扩散的脉冲动画效果) */}
            <div className="relative flex items-center justify-center w-6 h-6 shrink-0">
              {/* Outer expanding ping wave */}
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-65 animate-ping" />
              {/* Middle pulsing ring */}
              <span className="absolute -inset-1 rounded-full border-2 border-emerald-400/70 animate-pulse ring-2 ring-emerald-500/30" />
              {/* Center avatar */}
              <span className="relative z-10 text-sm">{activeSpeaker.avatar}</span>
            </div>

            {/* Speaker identity & content */}
            <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 truncate">
                <span className="text-xs font-black text-amber-300 truncate max-w-[70px] sm:max-w-[100px]">
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
              placeholder="输入战术喊话..."
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
              <span className="w-2 h-2 rounded-full bg-rose-500 absolute -top-0.5 -right-0.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

