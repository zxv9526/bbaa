import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Mic,
  MicOff,
  Smile,
  MessageSquare,
  Volume2,
  VolumeX,
  Play,
  Square,
  Sparkles,
  Radio,
  Trash2,
  Sliders,
  Activity,
  Headphones,
  ShieldCheck,
  Check,
  Copy,
  Filter
} from 'lucide-react';
import { ChatMessage, ChatMessageType } from '../types';
import {
  QUICK_PHRASE_GROUPS,
  CHAT_EMOJIS,
  VoiceRecorder,
  speakTextMessage
} from '../lib/chatManager';
import {
  TripleVoiceEngine,
  VoiceEngineStats,
  VadSensitivity
} from '../lib/tripleVoiceEngine';
import { TripleVoiceDiagnosticsModal } from './TripleVoiceDiagnosticsModal';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (type: ChatMessageType, content: string, audioUrl?: string, audioDuration?: number) => void;
  onClearMessages?: () => void;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string;
  ttsEnabled: boolean;
  onToggleTts: () => void;
}

export const TABLE_INTERACTION_ITEMS = [
  { emoji: '🍻', label: '碰杯敬酒', desc: '敬牌友一杯' },
  { emoji: '💣', label: '战术手雷', desc: '牌运炸裂' },
  { emoji: '🍵', label: '奉茶慢品', desc: '不急慢慢想' },
  { emoji: '🍗', label: '加个鸡腿', desc: '犒劳队友' },
  { emoji: '💸', label: '大吉大利', desc: '财源广进' },
  { emoji: '👑', label: '庄家霸气', desc: '威武发牌' },
  { emoji: '⚡', label: '出牌电击', desc: '催牌专用' },
  { emoji: '👏', label: '精彩鼓掌', desc: '绝妙牌型' },
  { emoji: '🔥', label: '手气爆棚', desc: '火力全开' },
  { emoji: '🧊', label: '冷静一下', desc: '稳扎稳打' },
  { emoji: '🎉', label: '大获全胜', desc: '全胜通吃' },
  { emoji: '🤝', label: '承让承让', desc: '切磋牌技' }
];

type TabType = 'quick' | 'emoji' | 'history' | 'settings';

export function ChatDrawer({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  onClearMessages,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  ttsEnabled,
  onToggleTts
}: ChatDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('quick');
  const [inputText, setInputText] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'voice' | 'text' | 'emoji'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Voice Engine State & Stats
  const engine = TripleVoiceEngine.getInstance();
  const [voiceStats, setVoiceStats] = useState<VoiceEngineStats>(() => engine.getStats());
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [micTesting, setMicTesting] = useState(false);
  const [micTestVolume, setMicTestVolume] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setVoiceStats(engine.getStats());
    const handleStats = (st: VoiceEngineStats) => {
      setVoiceStats(st);
    };
    engine.onStatsChange = handleStats;
    const interval = setInterval(() => {
      setVoiceStats(engine.getStats());
    }, 1200);

    return () => {
      clearInterval(interval);
    };
  }, [isOpen, engine]);

  // Voice Recording State Machine
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [drawerVolume, setDrawerVolume] = useState<number>(0);
  const voiceRecorderRef = useRef<VoiceRecorder | null>(null);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordPhaseRef = useRef<'idle' | 'starting' | 'recording' | 'stopping'>('idle');
  const pendingStopRef = useRef(false);

  // Audio Playback State
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll messages in history tab
  useEffect(() => {
    if (activeTab === 'history' && isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab, isOpen]);

  // Handle Recording & Audio cleanup
  useEffect(() => {
    return () => {
      pendingStopRef.current = false;
      recordPhaseRef.current = 'idle';
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      if (voiceRecorderRef.current) {
        voiceRecorderRef.current.cancel();
        voiceRecorderRef.current = null;
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  // 1. Text Message Send
  const handleSendText = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage('text', trimmed);
    setInputText('');
    if (ttsEnabled) {
      speakTextMessage(trimmed);
    }
  };

  // 2. Quick Phrase Send
  const handleSendQuickPhrase = (phrase: string) => {
    onSendMessage('quick', phrase);
    if (ttsEnabled) {
      speakTextMessage(phrase);
    }
    onClose();
  };

  // 3. Emoji Send
  const handleSendEmoji = (emoji: string) => {
    onSendMessage('emoji', emoji);
    onClose();
  };

  // 4. Voice Recording Flow (Robust State Machine)
  const handleStartRecord = async () => {
    if (recordPhaseRef.current !== 'idle') return;
    recordPhaseRef.current = 'starting';
    pendingStopRef.current = false;
    setRecordError(null);

    try {
      const recorder = new VoiceRecorder();
      recorder.onVolume = (vol) => setDrawerVolume(vol);
      voiceRecorderRef.current = recorder;
      await recorder.start();

      // Check if user clicked stop during async start
      if (pendingStopRef.current) {
        pendingStopRef.current = false;
        recordPhaseRef.current = 'stopping';
        try {
          const res = await recorder.stop();
          if (res.duration >= 1) {
            onSendMessage('voice', `[语音消息 ${res.duration}"]`, res.audioUrl, res.duration);
            onClose();
          }
        } catch {}
        recordPhaseRef.current = 'idle';
        voiceRecorderRef.current = null;
        setIsRecording(false);
        return;
      }

      recordPhaseRef.current = 'recording';
      setIsRecording(true);
      setRecordSeconds(0);

      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((prev) => {
          if (prev >= 9) {
            handleStopRecord();
            return 10;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('Record error:', err);
      recordPhaseRef.current = 'idle';
      setIsRecording(false);
      setRecordError(err.message || '无法访问麦克风，请检查浏览器权限');
    }
  };

  const handleStopRecord = async () => {
    if (recordPhaseRef.current === 'starting') {
      pendingStopRef.current = true;
      return;
    }
    if (recordPhaseRef.current !== 'recording') return;
    recordPhaseRef.current = 'stopping';

    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    const recorder = voiceRecorderRef.current;
    if (!recorder) {
      recordPhaseRef.current = 'idle';
      setIsRecording(false);
      return;
    }

    try {
      const result = await recorder.stop();
      recordPhaseRef.current = 'idle';
      setIsRecording(false);
      voiceRecorderRef.current = null;

      if (result.duration >= 1) {
        onSendMessage('voice', `[语音消息 ${result.duration}"]`, result.audioUrl, result.duration);
        onClose();
      } else {
        setRecordError('说话时间太短 (需大于1秒)');
      }
    } catch (err: any) {
      console.error('Stop record error:', err);
      recordPhaseRef.current = 'idle';
      setIsRecording(false);
      setRecordError('录音处理失败');
    }
  };

  const handleToggleRecord = () => {
    if (recordPhaseRef.current === 'idle') {
      handleStartRecord();
    } else if (recordPhaseRef.current === 'starting') {
      pendingStopRef.current = true;
    } else if (recordPhaseRef.current === 'recording') {
      handleStopRecord();
    }
  };

  const handleCancelRecord = () => {
    pendingStopRef.current = false;
    recordPhaseRef.current = 'idle';
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (voiceRecorderRef.current) {
      voiceRecorderRef.current.cancel();
      voiceRecorderRef.current = null;
    }
    setIsRecording(false);
    setRecordSeconds(0);
  };

  // 5. Voice Audio Playback with Master Volume & Deafen Check
  const handlePlayVoice = (msg: ChatMessage) => {
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
    audio.volume = engine.isUserDeafened() ? 0 : engine.getOutputVolume();
    audioPlayerRef.current = audio;
    setPlayingAudioId(msg.id);

    audio.onended = () => {
      setPlayingAudioId(null);
    };
    audio.onerror = () => {
      setPlayingAudioId(null);
    };

    audio.play().catch((err) => {
      console.warn('Playback error:', err);
      setPlayingAudioId(null);
    });
  };

  // 6. Real-time Mic Testing
  const handleToggleMicTest = async () => {
    if (micTesting) {
      setMicTesting(false);
      engine.onLocalVolumeChange = undefined;
      setMicTestVolume(0);
    } else {
      setMicTesting(true);
      const ok = await engine.startMicrophone();
      if (ok) {
        engine.onLocalVolumeChange = (vol) => {
          setMicTestVolume(vol);
        };
      } else {
        setMicTesting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-lg bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[680px] overflow-hidden">
        
        {/* Header Bar */}
        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                牌桌聊天与语音
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  全场互通
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">支持文字、表情、经典快捷语与真实语音对讲</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* TTS Voice Broadcast Toggle */}
            <button
              onClick={onToggleTts}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                ttsEnabled
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title={ttsEnabled ? '点击关闭语音朗读播报' : '点击开启语音朗读播报'}
            >
              {ttsEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{ttsEnabled ? '语音朗读: 开' : '语音: 关'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-3 sm:px-4 pt-3 pb-2 border-b border-slate-800/60 bg-slate-900/60 shrink-0">
          <button
            onClick={() => setActiveTab('quick')}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'quick'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>快捷语</span>
          </button>
          <button
            onClick={() => setActiveTab('emoji')}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'emoji'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
            <span>表情</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer relative ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>消息</span>
            {messages.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer relative ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>语音设置</span>
            {engine.isUserDeafened() && (
              <span className="w-2 h-2 rounded-full bg-rose-500" title="已开启静音他人模式" />
            )}
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[220px] max-h-[360px]">
          {/* TAB 1: Quick Phrases */}
          {activeTab === 'quick' && (
            <div className="space-y-4">
              {QUICK_PHRASE_GROUPS.map((group) => (
                <div key={group.category} className="space-y-1.5">
                  <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5 px-1">
                    <span>{group.icon}</span>
                    <span>{group.category}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {group.phrases.map((phrase) => (
                      <button
                        key={phrase}
                        onClick={() => handleSendQuickPhrase(phrase)}
                        className="text-left px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-indigo-600/20 hover:border-indigo-500/40 border border-slate-700/60 text-slate-200 hover:text-indigo-200 text-xs font-medium transition cursor-pointer active:scale-98 flex items-center justify-between group"
                      >
                        <span>{phrase}</span>
                        <span className="text-[10px] text-slate-500 group-hover:text-indigo-300 transition">
                          发送 ➔
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: Emoji & Interactive Props Grid */}
          {activeTab === 'emoji' && (
            <div className="space-y-4 py-1">
              {/* Table Interactive Props */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5 px-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>牌桌互动趣味道具</span>
                  <span className="text-[10px] text-slate-500 font-normal">（发送后全桌头顶实时浮动）</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {TABLE_INTERACTION_ITEMS.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => handleSendEmoji(item.emoji)}
                      className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-amber-600/20 hover:border-amber-400/50 border border-slate-700/60 flex flex-col items-center justify-center gap-1 transition shadow cursor-pointer active:scale-95 group"
                      title={item.desc}
                    >
                      <span className="text-2xl group-hover:scale-125 transition-transform duration-200">
                        {item.emoji}
                      </span>
                      <span className="text-[11px] font-bold text-slate-200 group-hover:text-amber-300 transition">
                        {item.label}
                      </span>
                      <span className="text-[9px] text-slate-500 truncate max-w-full">
                        {item.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Standard Chat Emojis */}
              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5 px-1">
                  <Smile className="w-3.5 h-3.5 text-slate-400" />
                  <span>常用对战表情</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                  {CHAT_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleSendEmoji(emoji)}
                      className="h-12 rounded-xl bg-slate-800/70 hover:bg-slate-750 border border-slate-700/50 flex items-center justify-center text-2xl hover:scale-120 active:scale-90 transition shadow cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Message History */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {/* History Top Filter & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2 border-b border-slate-800 text-[11px] text-slate-400">
                {/* Filter Pills */}
                <div className="flex items-center gap-1">
                  {(['all', 'voice', 'text', 'emoji'] as const).map((f) => {
                    const count = f === 'all' 
                      ? messages.length 
                      : f === 'voice' 
                      ? messages.filter(m => m.type === 'voice').length 
                      : f === 'emoji' 
                      ? messages.filter(m => m.type === 'emoji').length 
                      : messages.filter(m => m.type === 'text' || m.type === 'quick').length;

                    const label = f === 'all' ? '全部' : f === 'voice' ? '🎙️语音' : f === 'text' ? '💬文字' : '😊表情';

                    return (
                      <button
                        key={f}
                        onClick={() => setHistoryFilter(f)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
                          historyFilter === f
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span>{label}</span>
                        <span className="opacity-70">({count})</span>
                      </button>
                    );
                  })}
                </div>

                {messages.length > 0 && onClearMessages && (
                  <button
                    onClick={onClearMessages}
                    className="flex items-center gap-1 text-slate-500 hover:text-rose-400 transition cursor-pointer ml-auto"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>清空</span>
                  </button>
                )}
              </div>

              {/* Message List */}
              {(() => {
                const filteredMessages = messages.filter(m => {
                  if (historyFilter === 'all') return true;
                  if (historyFilter === 'voice') return m.type === 'voice';
                  if (historyFilter === 'emoji') return m.type === 'emoji';
                  return m.type === 'text' || m.type === 'quick';
                });

                if (filteredMessages.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      {historyFilter === 'all' 
                        ? '暂无对讲记录，点击快捷战术或语音与全桌玩家互动吧~'
                        : '当前分类下暂无消息记录'}
                    </div>
                  );
                }

                return filteredMessages.map((msg) => {
                  if (msg.senderId === 'system') {
                    return (
                      <div key={msg.id} className="flex justify-center my-1.5 animate-in fade-in">
                        <span className="px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700/60 text-slate-300 text-[11px] font-medium flex items-center gap-1.5 shadow-sm">
                          <span>{msg.senderAvatar || '📢'}</span>
                          <span>{msg.content}</span>
                        </span>
                      </div>
                    );
                  }

                  const isMe = msg.senderId === currentUserId;
                  const seatBadge = typeof msg.seatIndex === 'number'
                    ? `${msg.seatIndex + 1}号位`
                    : '';
                  const timeStr = msg.timestamp
                    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : '';

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in group`}
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shrink-0 shadow">
                        {msg.senderAvatar || '👤'}
                      </div>
                      <div
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}
                      >
                        <div className={`flex items-center gap-1 text-[10px] text-slate-400 px-1 mb-0.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <span className="font-bold text-slate-200">
                            {isMe ? '我' : msg.senderName}
                          </span>
                          {seatBadge && (
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              isMe
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                            }`}>
                              {seatBadge}
                            </span>
                          )}
                          {msg.isDealer && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              👑庄家
                            </span>
                          )}
                          {timeStr && (
                            <span className="text-slate-500 font-mono text-[9px]">{timeStr}</span>
                          )}
                        </div>

                        {msg.type === 'voice' ? (
                          <button
                            onClick={() => handlePlayVoice(msg)}
                            className={`px-3.5 py-2 rounded-2xl font-bold text-xs flex items-center gap-2 cursor-pointer shadow transition active:scale-95 ${
                              isMe
                                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                                : 'bg-slate-800 text-emerald-300 border border-emerald-500/30 hover:bg-slate-750'
                            }`}
                          >
                            {playingAudioId === msg.id ? (
                              <Square className="w-3.5 h-3.5 fill-current animate-pulse text-rose-300" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-current text-white" />
                            )}
                            <span>语音 {msg.audioDuration || 2}"</span>
                            {/* Animated Audio Equalizer when playing */}
                            {playingAudioId === msg.id ? (
                              <div className="flex items-end gap-0.5 h-3.5 ml-1">
                                <span className="w-0.5 h-2 bg-white animate-pulse" />
                                <span className="w-0.5 h-3.5 bg-white animate-bounce" />
                                <span className="w-0.5 h-1.5 bg-white animate-pulse" />
                                <span className="w-0.5 h-3 bg-white animate-bounce" />
                              </div>
                            ) : (
                              <span className="text-xs opacity-75">🔊</span>
                            )}
                          </button>
                        ) : msg.type === 'emoji' ? (
                          <div className="text-3xl p-1 animate-in zoom-in-50">{msg.content}</div>
                        ) : (
                          <div className="relative group/msg">
                            <div
                              className={`px-3.5 py-2 rounded-2xl text-xs font-medium leading-relaxed break-words shadow ${
                                isMe
                                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                                  : 'bg-slate-800 text-slate-100 border border-slate-700/80 rounded-tl-sm'
                              }`}
                            >
                              {msg.content}
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard?.writeText?.(msg.content);
                                setCopiedId(msg.id);
                                setTimeout(() => setCopiedId(null), 1800);
                              }}
                              className={`absolute -bottom-2 ${isMe ? 'left-0' : 'right-0'} opacity-0 group-hover/msg:opacity-100 transition px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] text-slate-400 hover:text-white flex items-center gap-0.5 shadow cursor-pointer`}
                              title="复制此文本"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                  <span className="text-emerald-400 text-[9px]">已复制</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-2.5 h-2.5" />
                                  <span className="text-[9px]">复制</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* TAB 4: Voice & Audio Settings */}
          {activeTab === 'settings' && (
            <div className="space-y-4 text-xs">
              {/* Header Banner */}
              <div className="p-3 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900 border border-indigo-500/20 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-white text-xs flex items-center gap-1.5">
                      <span>对讲音频与传输偏好</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        实时生效
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">配置个人耳聋免打扰、音量控制及对讲拾音门限</div>
                  </div>
                </div>
              </div>

              {/* Master Volume Control */}
              <div className="p-3.5 bg-slate-850/80 border border-slate-700/60 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>接收对讲语音音量</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-indigo-300 font-bold">
                      {Math.round(engine.getOutputVolume() * 100)}%
                    </span>
                    <button
                      onClick={() => {
                        const newVol = engine.getOutputVolume() > 0 ? 0 : 0.85;
                        engine.setOutputVolume(newVol);
                        setVoiceStats(engine.getStats());
                      }}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-[10px] font-bold text-slate-300 transition"
                    >
                      {engine.getOutputVolume() === 0 ? '恢复' : '静音'}
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(engine.getOutputVolume() * 100)}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10) / 100;
                    engine.setOutputVolume(v);
                    setVoiceStats(engine.getStats());
                  }}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Switches Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Deafen Toggle */}
                <div className="p-3 bg-slate-850/80 border border-slate-700/60 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-200 flex items-center gap-1">
                      <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                      <span>对讲免打扰 (耳聋模式)</span>
                    </div>
                    <div className="text-[10px] text-slate-400">静音所有牌友实时语音与语音条</div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !engine.isUserDeafened();
                      engine.setDeafened(next);
                      setVoiceStats(engine.getStats());
                    }}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                      engine.isUserDeafened() ? 'bg-rose-600' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        engine.isUserDeafened() ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Auto Play Toggle */}
                <div className="p-3 bg-slate-850/80 border border-slate-700/60 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-200 flex items-center gap-1">
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                      <span>新语音对讲自动播放</span>
                    </div>
                    <div className="text-[10px] text-slate-400">收到他人对讲时无需点击直接收听</div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !engine.getAutoPlayVoice();
                      engine.setAutoPlayVoice(next);
                      setVoiceStats(engine.getStats());
                    }}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                      engine.getAutoPlayVoice() ? 'bg-emerald-600' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        engine.getAutoPlayVoice() ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Radio Chirp FX Toggle */}
                <div className="p-3 bg-slate-850/80 border border-slate-700/60 rounded-2xl flex items-center justify-between sm:col-span-2">
                  <div>
                    <div className="font-bold text-slate-200 flex items-center gap-1">
                      <Radio className="w-3.5 h-3.5 text-amber-400" />
                      <span>无线电步话机对讲提示音</span>
                    </div>
                    <div className="text-[10px] text-slate-400">模拟真实车厢无线电呼叫与挂断清脆滴声 (Chirp FX)</div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !engine.getRadioChirpEnabled();
                      engine.setRadioChirpEnabled(next);
                      setVoiceStats(engine.getStats());
                    }}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                      engine.getRadioChirpEnabled() ? 'bg-amber-600' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        engine.getRadioChirpEnabled() ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* VAD Sensitivity Selection */}
              <div className="p-3.5 bg-slate-850/80 border border-slate-700/60 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    <span>自由麦拾音门限灵敏度</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    当前: {engine.getVadSensitivity() === 'low' ? '低灵敏' : engine.getVadSensitivity() === 'high' ? '高灵敏' : '标准平衡'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'low' as VadSensitivity, label: '低灵敏', desc: '吵闹环境 / 防误触' },
                    { id: 'medium' as VadSensitivity, label: '标准平衡', desc: '推荐日常交流' },
                    { id: 'high' as VadSensitivity, label: '高灵敏', desc: '安静夜间 / 轻语' }
                  ].map((item) => {
                    const isSelected = engine.getVadSensitivity() === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          engine.setVadSensitivity(item.id);
                          setVoiceStats(engine.getStats());
                        }}
                        className={`p-2 rounded-xl text-left transition border cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 shadow-sm'
                            : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-750'
                        }`}
                      >
                        <div className="font-black text-xs flex items-center justify-between">
                          <span>{item.label}</span>
                          {isSelected && <Check className="w-3 h-3 text-cyan-400" />}
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5">{item.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Microphone Real-time Hardware Test */}
              <div className="p-3.5 bg-slate-850/80 border border-slate-700/60 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-400" />
                    <span>麦克风实时输入电平测试</span>
                  </div>
                  <button
                    onClick={handleToggleMicTest}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                      micTesting
                        ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {micTesting ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    <span>{micTesting ? '停止测试' : '开始试麦'}</span>
                  </button>
                </div>

                {/* 10-level LED VU Meter */}
                <div className="flex items-center gap-1 h-3 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  {Array.from({ length: 20 }).map((_, idx) => {
                    const threshold = (idx + 1) * 5;
                    const isActive = micTesting && micTestVolume >= threshold;
                    return (
                      <div
                        key={idx}
                        className={`flex-1 h-full rounded-xs transition-colors duration-75 ${
                          isActive
                            ? idx > 15
                              ? 'bg-rose-500'
                              : idx > 10
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                            : 'bg-slate-800/60'
                        }`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>-40dB</span>
                  <span>-18dB (最佳)</span>
                  <span>0dB (过载)</span>
                </div>
              </div>

              {/* Triple-tier Network Link Status & Diagnostics Button */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <div>
                    <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                      <span>三重保底链路:</span>
                      <span className="font-mono text-emerald-400 font-black">
                        {voiceStats.activeTier === 'webrtc'
                          ? 'WebRTC P2P 高清直连'
                          : voiceStats.activeTier === 'websocket'
                          ? 'WebSocket 中继广播'
                          : 'HTTP 智能极速轮询'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      延迟: {voiceStats.latencyMs || 18}ms · 发送: {voiceStats.packetsSent}包 · 接收: {voiceStats.packetsReceived}包
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowDiagnosticsModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>详细诊断</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Recording Overlay / Audio Controller with Live VU Meter */}
        {isRecording && (
          <div className="p-4 bg-rose-950/60 border-t border-rose-500/40 flex items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping" />
              <div>
                <div className="text-xs font-black text-rose-200 flex items-center gap-2">
                  <span>正在录音...</span>
                  <span className="font-mono text-white text-sm">{recordSeconds}s</span>
                  <span className="text-rose-300/80">/ 10s</span>
                  {/* Dynamic 5-bar VU meter */}
                  <div className="flex items-end gap-0.5 h-3 ml-1.5">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <span
                        key={lvl}
                        className={`w-0.5 rounded-full transition-all duration-75 ${
                          drawerVolume >= lvl * 18
                            ? lvl > 3 ? 'bg-amber-400 h-3' : 'bg-emerald-400 h-2.5'
                            : 'bg-white/20 h-1'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="text-[10px] text-rose-300">松开或点击停止即可发送实时语音</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelRecord}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleStopRecord}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/30 transition flex items-center gap-1 active:scale-95 cursor-pointer"
              >
                <Send className="w-3 h-3" /> 发送
              </button>
            </div>
          </div>
        )}

        {/* Record Error Toast */}
        {recordError && (
          <div className="px-4 py-2 bg-rose-500/20 border-t border-rose-500/30 text-rose-300 text-xs font-bold text-center">
            {recordError}
          </div>
        )}

        {/* Bottom Input & Voice Record Action Bar */}
        <div className="p-3 sm:p-4 bg-slate-950/70 border-t border-slate-800/80 flex items-center gap-2 shrink-0">
          {/* Voice Record Button (按住/点击对讲) */}
          <button
            onClick={handleToggleRecord}
            className={`px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 shadow ${
              isRecording
                ? 'bg-rose-600 text-white animate-pulse'
                : recordPhaseRef.current === 'starting'
                ? 'bg-amber-600 text-white animate-bounce'
                : 'bg-slate-800 hover:bg-slate-750 text-emerald-400 border border-emerald-500/30'
            }`}
            title="点击开始录制语音对讲消息"
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
            <span className="hidden min-[380px]:inline">
              {isRecording ? '结束对讲' : recordPhaseRef.current === 'starting' ? '准备中...' : '语音对讲'}
            </span>
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendText();
            }}
            placeholder="输入聊天内容..."
            maxLength={60}
            className="flex-1 bg-slate-850 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />

          {/* Send Button */}
          <button
            onClick={handleSendText}
            disabled={!inputText.trim()}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-1 cursor-pointer active:scale-95 shrink-0 ${
              inputText.trim()
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>发送</span>
          </button>
        </div>

      </div>

      {/* Embedded Diagnostics Modal */}
      {showDiagnosticsModal && (
        <TripleVoiceDiagnosticsModal
          isOpen={showDiagnosticsModal}
          onClose={() => setShowDiagnosticsModal(false)}
        />
      )}
    </div>
  );
}
