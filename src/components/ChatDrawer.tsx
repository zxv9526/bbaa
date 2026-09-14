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
  Trash2
} from 'lucide-react';
import { ChatMessage, ChatMessageType } from '../types';
import {
  QUICK_PHRASE_GROUPS,
  CHAT_EMOJIS,
  VoiceRecorder,
  speakTextMessage
} from '../lib/chatManager';

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

type TabType = 'quick' | 'emoji' | 'history';

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
  
  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [drawerVolume, setDrawerVolume] = useState<number>(0);
  const voiceRecorderRef = useRef<VoiceRecorder | null>(null);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Handle Recording cleanup
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (voiceRecorderRef.current) voiceRecorderRef.current.cancel();
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

  // 4. Voice Recording Flow
  const handleStartRecord = async () => {
    setRecordError(null);
    try {
      const recorder = new VoiceRecorder();
      recorder.onVolume = (vol) => setDrawerVolume(vol);
      voiceRecorderRef.current = recorder;
      await recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);

      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((prev) => {
          if (prev >= 9) {
            // Auto stop at 10 seconds
            handleStopRecord();
            return 10;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('Record error:', err);
      setRecordError(err.message || '无法访问麦克风，请检查浏览器权限');
      setIsRecording(false);
    }
  };

  const handleStopRecord = async () => {
    if (!isRecording || !voiceRecorderRef.current) return;
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    try {
      const result = await voiceRecorderRef.current.stop();
      setIsRecording(false);
      voiceRecorderRef.current = null;

      if (result.duration >= 1) {
        onSendMessage('voice', `[语音消息 ${result.duration}"]`, result.audioUrl, result.duration);
        onClose();
      } else {
        setRecordError('说话时间太短');
      }
    } catch (err: any) {
      console.error('Stop record error:', err);
      setIsRecording(false);
      setRecordError('录音处理失败');
    }
  };

  const handleCancelRecord = () => {
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

  // 5. Voice Audio Playback
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
        <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-slate-800/60 bg-slate-900/60 shrink-0">
          <button
            onClick={() => setActiveTab('quick')}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'quick'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>经典快捷语</span>
          </button>
          <button
            onClick={() => setActiveTab('emoji')}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'emoji'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
            <span>趣味表情</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer relative ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>消息记录</span>
            {messages.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
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

          {/* TAB 2: Emoji Grid */}
          {activeTab === 'emoji' && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 py-2">
              {CHAT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleSendEmoji(emoji)}
                  className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 flex items-center justify-center text-2xl hover:scale-110 active:scale-95 transition shadow cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* TAB 3: Message History */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {messages.length > 0 && onClearMessages && (
                <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-800 text-[11px] text-slate-400">
                  <span>共 {messages.length} 条对讲记录</span>
                  <button
                    onClick={onClearMessages}
                    className="flex items-center gap-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>清空记录</span>
                  </button>
                </div>
              )}

              {messages.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  暂无对讲记录，点击快捷战术或语音与全桌玩家互动吧~
                </div>
              ) : (
                messages.map((msg) => {
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
                      className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in`}
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
                          <div
                            className={`px-3.5 py-2 rounded-2xl text-xs font-medium leading-relaxed break-words shadow ${
                              isMe
                                ? 'bg-indigo-600 text-white rounded-tr-sm'
                                : 'bg-slate-800 text-slate-100 border border-slate-700/80 rounded-tl-sm'
                            }`}
                          >
                            {msg.content}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
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
            onClick={() => {
              if (isRecording) {
                handleStopRecord();
              } else {
                handleStartRecord();
              }
            }}
            className={`px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 shadow ${
              isRecording
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-slate-800 hover:bg-slate-750 text-emerald-400 border border-emerald-500/30'
            }`}
            title="点击开始录制语音对讲消息"
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
            <span className="hidden min-[380px]:inline">{isRecording ? '结束对讲' : '语音对讲'}</span>
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
    </div>
  );
}
