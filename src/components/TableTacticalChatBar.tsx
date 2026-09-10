import React, { useState, useRef } from 'react';
import { MessageSquare, Mic, Volume2, VolumeX, Sparkles, Send, Radio } from 'lucide-react';
import { VoiceRecorder } from '../lib/chatManager';
import { triggerHaptic } from '../lib/haptics';

interface TableTacticalChatBarProps {
  onSendMessage: (type: 'text' | 'voice' | 'quick', content: string, audioUrl?: string, audioDuration?: number) => void;
  onOpenFullChat: () => void;
  ttsEnabled: boolean;
  onToggleTts: () => void;
  unreadCount?: number;
}

const TACTICAL_PHRASES = [
  '🔥 这把我必打枪！',
  '⏳ 快点理牌，等急了！',
  '⚠️ 兄弟小心倒水！',
  '👑 特殊牌型直接通杀！',
  '🥺 手气太背求轻虐~',
  '💣 谁敢跟我硬碰硬！',
  '🍻 牌品如人品，开开心心玩！'
];

export function TableTacticalChatBar({
  onSendMessage,
  onOpenFullChat,
  ttsEnabled,
  onToggleTts,
  unreadCount = 0
}: TableTacticalChatBarProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const timerRef = useRef<any>(null);

  const startVoiceRecord = async () => {
    try {
      triggerHaptic('medium');
      const recorder = new VoiceRecorder();
      recorderRef.current = recorder;
      await recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

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
      console.error('Record failed:', err);
      alert(err.message || '麦克风权限未开启或录音不可用');
    }
  };

  const stopVoiceRecordAndSend = async () => {
    if (!recorderRef.current || !isRecording) return;
    triggerHaptic('success');
    clearInterval(timerRef.current);
    setIsRecording(false);

    try {
      const { audioUrl, duration } = await recorderRef.current.stop();
      if (duration < 0.5) {
        // Too short, disregard
        return;
      }
      onSendMessage('voice', `[语音消息 ${Math.round(duration)}秒]`, audioUrl, Math.round(duration));
    } catch (err) {
      console.error('Stop error:', err);
    } finally {
      recorderRef.current = null;
    }
  };

  const handleSendQuickPhrase = (phrase: string) => {
    triggerHaptic('light');
    onSendMessage('quick', phrase);
  };

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-2 py-1.5 shadow-md flex items-center justify-between gap-2 shrink-0 animate-in fade-in">
      {/* 1. Voice Push-to-Talk Button */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isRecording ? (
          <button
            onClick={stopVoiceRecordAndSend}
            className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-rose-950/60 animate-pulse cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5 animate-spin" />
            <span>松开发送 ({recordingSeconds}s)</span>
          </button>
        ) : (
          <button
            onClick={startVoiceRecord}
            className="px-2.5 py-1 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 hover:text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 shadow cursor-pointer"
            title="点击开始录音对讲"
          >
            <Mic className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden xs:inline">对讲</span>
          </button>
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

      {/* 2. Tactical Quick Phrase Chips (横向滚动快捷喊话) */}
      <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-1 min-w-0">
        {TACTICAL_PHRASES.map((phrase, idx) => (
          <button
            key={idx}
            onClick={() => handleSendQuickPhrase(phrase)}
            className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-750 hover:border-amber-500/40 border border-slate-700/80 text-slate-300 hover:text-amber-200 text-[11px] font-bold whitespace-nowrap transition active:scale-95 shrink-0 cursor-pointer shadow-sm"
          >
            {phrase}
          </button>
        ))}
      </div>

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
  );
}
