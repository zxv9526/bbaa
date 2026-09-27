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
  Smile,
  Layers,
  Activity,
  Play,
  Square
} from 'lucide-react';
import {
  VoiceRecorder,
  OpenMicListener,
  playRadioChirpStart,
  playRadioChirpEnd,
  createSimulatedVoiceAudioUrl,
  QUICK_PHRASE_GROUPS,
  CHAT_EMOJIS,
  previewPhraseVoice
} from '../lib/chatManager';
import {
  TtsBroadcastEngine,
  TTS_VOICE_ROLES,
  TtsConfig
} from '../lib/ttsEngine';
import { triggerHaptic } from '../lib/haptics';
import { ChatMessage } from '../types';
import {
  TripleVoiceEngine,
  VoiceEngineStats
} from '../lib/tripleVoiceEngine';
import { TripleVoiceDiagnosticsModal } from './TripleVoiceDiagnosticsModal';
import { TtsVoiceSettingsModal } from './TtsVoiceSettingsModal';
import { TABLE_INTERACTION_ITEMS } from './ChatDrawer';

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
  const [emojiSubTab, setEmojiSubTab] = useState<'props' | 'emoji'>('props');
  const [currentVolume, setCurrentVolume] = useState<number>(0);
  const [voiceMode, setVoiceMode] = useState<'ptt' | 'openMic'>('ptt');
  const [isOpenMicActive, setIsOpenMicActive] = useState(false);
  const [isOpenMicMuted, setIsOpenMicMuted] = useState(false);
  const [isSlideCancel, setIsSlideCancel] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(QUICK_PHRASE_GROUPS[0].category);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [showVoiceSettingsModal, setShowVoiceSettingsModal] = useState(false);
  const [previewingPhrase, setPreviewingPhrase] = useState<string | null>(null);
  const engine = TripleVoiceEngine.getInstance();
  const ttsEngine = TtsBroadcastEngine.getInstance();
  const [ttsConfig, setTtsConfig] = useState<TtsConfig>(() => ttsEngine.getConfig());
  const [voiceStats, setVoiceStats] = useState<VoiceEngineStats>(() => engine.getStats());

  useEffect(() => {
    const unsubTts = ttsEngine.subscribe((cfg) => {
      setTtsConfig(cfg);
    });
    return () => unsubTts();
  }, [ttsEngine]);

  useEffect(() => {
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
  }, [engine]);

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
  const pointerStartTimeRef = useRef<number>(0);
  const isPointerDownRef = useRef<boolean>(false);
  const recordPhaseRef = useRef<'idle' | 'starting' | 'recording' | 'stopping'>('idle');
  const pendingStopRef = useRef<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 2800);
  };

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

  // 1. PTT / Click-to-Talk Voice Record Routine
  const startVoiceRecord = async () => {
    if (recordPhaseRef.current !== 'idle') return;
    recordPhaseRef.current = 'starting';
    pendingStopRef.current = false;
    setIsRecording(true);
    setRecordingSeconds(0);
    setIsSlideCancel(false);

    try {
      playRadioChirpStart();
      triggerHaptic('medium');
      const recorder = new VoiceRecorder();
      recorder.onVolume = (vol) => {
        setCurrentVolume(vol);
      };
      recorderRef.current = recorder;
      await recorder.start();

      // If user tapped to stop while start was in flight
      if (pendingStopRef.current || (recordPhaseRef.current as string) === 'stopping') {
        recordPhaseRef.current = 'recording';
        await stopVoiceRecordAndSend();
        return;
      }

      recordPhaseRef.current = 'recording';
      if (onUserSpeakingChange) onUserSpeakingChange(true);

      if (timerRef.current) clearInterval(timerRef.current);
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
      recordPhaseRef.current = 'idle';
      setIsRecording(false);
      showToast('麦克风初始化提示: 已使用安全模拟语音通道');
    }
  };

  const stopVoiceRecordAndSend = async () => {
    if (recordPhaseRef.current === 'starting') {
      pendingStopRef.current = true;
      return;
    }
    if (recordPhaseRef.current !== 'recording') {
      return;
    }

    recordPhaseRef.current = 'stopping';
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCurrentVolume(0);
    if (onUserSpeakingChange) onUserSpeakingChange(false);

    const activeRecorder = recorderRef.current;
    const shouldCancel = isSlideCancel;

    try {
      if (shouldCancel || !activeRecorder) {
        if (activeRecorder) activeRecorder.cancel();
        triggerHaptic('light');
        return;
      }

      playRadioChirpEnd();
      triggerHaptic('success');
      const result = await activeRecorder.stop();
      const duration = Math.max(1, Math.round(result.duration));

      // Broadcast voice frame across Triple-Tier Architecture (WebRTC P2P / WebSocket / HTTP)
      try {
        if (result.audioBlob && result.audioBlob.size > 0) {
          engine.dispatchVoiceBlob(result.audioBlob, duration);
        }
      } catch (err) {
        console.warn('TripleVoice dispatch error:', err);
      }

      const validUrl = result.audioUrl || (result.audioBlob ? URL.createObjectURL(result.audioBlob) : '');
      if (validUrl) {
        onSendMessage('voice', `[对讲语音 ${duration}秒]`, validUrl, duration);
      }
    } catch (err) {
      console.error('Stop voice error:', err);
    } finally {
      recorderRef.current = null;
      recordPhaseRef.current = 'idle';
      setIsRecording(false);
      setIsSlideCancel(false);
    }
  };

  const cancelVoiceRecord = () => {
    recordPhaseRef.current = 'stopping';
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setCurrentVolume(0);
    setIsSlideCancel(false);
    if (onUserSpeakingChange) onUserSpeakingChange(false);
    triggerHaptic('light');
    if (recorderRef.current) {
      try {
        recorderRef.current.cancel();
      } catch {}
      recorderRef.current = null;
    }
    recordPhaseRef.current = 'idle';
  };

  // Pointer hold-to-talk handlers (for mobile long-press and desktop hold)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (voiceMode !== 'ptt') return;
    if (recordPhaseRef.current === 'idle') {
      isPointerDownRef.current = true;
      pointerStartYRef.current = e.clientY;
      pointerStartTimeRef.current = Date.now();
      startVoiceRecord();
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (recordPhaseRef.current === 'idle') return;
    if (pointerStartYRef.current === 0) {
      pointerStartYRef.current = e.clientY;
    }
    const diffY = pointerStartYRef.current - e.clientY;
    if (diffY > 35) {
      if (!isSlideCancel) {
        setIsSlideCancel(true);
        triggerHaptic('heavy');
      }
    } else {
      if (isSlideCancel) setIsSlideCancel(false);
    }
  };

  const handlePointerUp = () => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    const holdDuration = Date.now() - pointerStartTimeRef.current;
    if (isSlideCancel) {
      cancelVoiceRecord();
      return;
    }
    // If user held the button for >= 350ms: it was Hold-to-Talk -> auto stop and send on release
    if (holdDuration >= 350) {
      stopVoiceRecordAndSend();
    }
    // If it was a short tap (< 350ms), user entered Tap-to-Talk mode -> stays recording until explicit tap on send
  };

  // Window-level gesture tracker during recording so slide-to-cancel & release-to-send are 100% reliable
  useEffect(() => {
    if (!isRecording) return;

    const onWinPointerMove = (e: PointerEvent) => {
      if (pointerStartYRef.current > 0) {
        const diffY = pointerStartYRef.current - e.clientY;
        if (diffY > 35) {
          setIsSlideCancel(true);
        } else {
          setIsSlideCancel(false);
        }
      }
    };

    const onWinPointerUp = () => {
      if (isPointerDownRef.current) {
        isPointerDownRef.current = false;
        const holdDuration = Date.now() - pointerStartTimeRef.current;
        if (isSlideCancel) {
          cancelVoiceRecord();
        } else if (holdDuration >= 350) {
          stopVoiceRecordAndSend();
        }
      }
    };

    window.addEventListener('pointermove', onWinPointerMove);
    window.addEventListener('pointerup', onWinPointerUp);
    return () => {
      window.removeEventListener('pointermove', onWinPointerMove);
      window.removeEventListener('pointerup', onWinPointerUp);
    };
  }, [isRecording, isSlideCancel]);

  // Explicit click handler for Tap-to-Talk mode (Click once to talk, click again to send)
  const handleMicButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const holdDuration = Date.now() - pointerStartTimeRef.current;
    // If it was a hold gesture, handlePointerUp already handled it
    if (holdDuration >= 350) return;

    if (recordPhaseRef.current === 'idle') {
      pointerStartYRef.current = e.clientY;
      startVoiceRecord();
    } else if (recordPhaseRef.current === 'recording' || recordPhaseRef.current === 'starting') {
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
        try {
          fetch(audioUrl).then(res => res.blob()).then(blob => {
            engine.dispatchVoiceBlob(blob, duration);
          });
        } catch {}
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
        showToast('无法访问麦克风，请确认浏览器已授予麦克风权限');
      }
    } else {
      // Switch back to PTT
      if (openMicRef.current) {
        openMicRef.current.stop();
        openMicRef.current = null;
      }
      setIsOpenMicActive(false);
      setVoiceMode('ptt');
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
    // 🚀 三重语音传输架构：向全桌真人玩家高速广播常用语音播报
    engine.sendVoicePhrase(phrase);
    onSendMessage('quick', phrase, audioUrl, 2);
    // 🎙️ 本地立即使用专属音色播报语音
    if (ttsEnabled) {
      ttsEngine.speak(phrase);
    }
  };

  const handlePreviewPhrase = (phrase: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingPhrase === phrase) {
      ttsEngine.stop();
      setPreviewingPhrase(null);
      return;
    }
    setPreviewingPhrase(phrase);
    previewPhraseVoice(phrase, ttsConfig.role, () => {
      setPreviewingPhrase(null);
    });
  };

  const handleSendQuickEmoji = (emoji: string) => {
    triggerHaptic('light');
    setShowQuickEmoji(false);
    onSendMessage('emoji', emoji);
  };

  // Calculate live volume LED bar active count (1 to 5)
  const volumeLevel = Math.min(5, Math.ceil(currentVolume / 18));

  // Get current active group phrases
  const currentGroup = QUICK_PHRASE_GROUPS.find(g => g.category === selectedCategory) || QUICK_PHRASE_GROUPS[0];

  return (
    <div className="relative w-full select-none">
      {/* 📱 微信风格语音录制中浮层 HUD (按住说话 / 松开发送 / 手指上滑取消 / 点击发送) */}
      {isRecording && (
        <div
          onPointerDown={(e) => {
            isPointerDownRef.current = true;
            if (pointerStartYRef.current === 0) {
              pointerStartYRef.current = e.clientY;
            }
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[3px] select-none animate-in fade-in duration-150"
        >
          {/* Top Cancel Guide Pill */}
          <div className="mb-4">
            <div
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg ${
                isSlideCancel
                  ? 'bg-rose-600 text-white scale-110 ring-4 ring-rose-500/40 animate-pulse'
                  : 'bg-slate-900/90 text-slate-300 border border-slate-700'
              }`}
            >
              <X className="w-3.5 h-3.5" />
              <span>{isSlideCancel ? '松开手指，取消发送' : '手指往上滑，取消发送'}</span>
            </div>
          </div>

          {/* Center Card */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (isSlideCancel) {
                cancelVoiceRecord();
              } else {
                stopVoiceRecordAndSend();
              }
            }}
            className={`w-52 h-48 rounded-3xl flex flex-col items-center justify-between p-4 shadow-2xl transition-all duration-200 border cursor-pointer ${
              isSlideCancel
                ? 'bg-rose-950/95 border-rose-500/80 scale-105 shadow-rose-950/80'
                : 'bg-slate-900/95 border-emerald-500/60 shadow-emerald-950/50 hover:border-emerald-400'
            }`}
          >
            {isSlideCancel ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-2 text-rose-300">
                <div className="w-16 h-16 rounded-full bg-rose-600/30 border border-rose-500 flex items-center justify-center text-rose-400 animate-bounce">
                  <X className="w-9 h-9 stroke-[2.5]" />
                </div>
                <div className="text-sm font-black text-rose-200">松开手指，取消发送</div>
                <div className="text-[10px] text-rose-400 font-mono">RELEASE TO CANCEL</div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 gap-2 text-emerald-300">
                {/* Dynamic sound wave & microphone */}
                <div className="relative flex items-center justify-center w-16 h-16">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <Mic className="w-7 h-7 animate-pulse" />
                  </div>
                  {/* Surrounding sound waves */}
                  <div className="absolute -right-3 flex items-end gap-0.5 h-8">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <span
                        key={lvl}
                        className={`w-1 rounded-full transition-all duration-75 ${
                          volumeLevel >= lvl
                            ? 'bg-emerald-400 h-6'
                            : 'bg-emerald-900/60 h-1.5'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-base font-black text-white flex items-center justify-center gap-1.5">
                    <span>录音中</span>
                    <span className="font-mono text-emerald-300 text-lg">{recordingSeconds}"</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">松开或点击卡片立即发送</div>
                </div>
              </div>
            )}

            {/* Bottom Explicit Action Buttons inside Card */}
            <div className="flex items-center gap-2 w-full pt-2 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cancelVoiceRecord();
                }}
                className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/50 border border-slate-700 hover:border-rose-500/60 text-slate-300 hover:text-rose-200 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>取消</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stopVoiceRecordAndSend();
                }}
                className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition flex items-center justify-center gap-1 cursor-pointer shadow-md shadow-emerald-900/40"
              >
                <Send className="w-3 h-3" />
                <span>发送</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 Quick Voice Tactical Phrases Popover */}
      {showQuickVoice && (
        <div className="absolute bottom-full left-0 mb-2 w-[92vw] max-w-md max-h-[50vh] flex flex-col bg-slate-900/98 border-2 border-amber-500/60 rounded-2xl p-2.5 shadow-2xl backdrop-blur-xl z-50 animate-in slide-in-from-bottom-3 fade-in">
          {/* Header */}
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-amber-300">
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>常用战术语音播报</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowVoiceSettingsModal(true)}
                className="h-7 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[11px] font-bold text-amber-300 flex items-center gap-1 transition cursor-pointer"
                title="打开常用语音色与播报设置"
              >
                <Sliders className="w-3 h-3" />
                <span>音色</span>
              </button>
              <button
                onClick={() => setShowQuickVoice(false)}
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Voice Role Pill Switcher */}
          <div className="flex items-center gap-1.5 mb-1.5 px-2 py-1 rounded-xl bg-slate-950/80 border border-slate-800 overflow-x-auto no-scrollbar text-xs shrink-0">
            <span className="text-slate-400 font-bold shrink-0 text-[10px] sm:text-xs">音色:</span>
            {TTS_VOICE_ROLES.map((r) => {
              const isSelected = ttsConfig.role === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => ttsEngine.setRole(r.id)}
                  className={`px-2 py-0.5 rounded-lg whitespace-nowrap font-bold text-[11px] sm:text-xs transition cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-md scale-105'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title={r.tagline}
                >
                  <span>{r.avatar}</span>
                  <span>{r.name}</span>
                </button>
              );
            })}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 mb-1.5 overflow-x-auto no-scrollbar pb-0.5 shrink-0">
            {QUICK_PHRASE_GROUPS.map((group) => (
              <button
                key={group.category}
                onClick={() => setSelectedCategory(group.category)}
                className={`h-7 px-2.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1 border ${
                  selectedCategory === group.category
                    ? 'bg-amber-500/30 text-amber-300 border-amber-500/70 shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border-slate-700/60'
                }`}
              >
                <span>{group.icon}</span>
                <span>{group.category}</span>
              </button>
            ))}
          </div>

          {/* Phrases under selected category */}
          <div className="grid grid-cols-1 gap-1.5 flex-1 overflow-y-auto no-scrollbar min-h-0 pr-0.5">
            {currentGroup.phrases.map((phrase, idx) => {
              const isThisPreviewing = previewingPhrase === phrase;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-855 hover:bg-slate-800 border border-slate-700/80 transition group"
                >
                  {/* 🔊 Preview Voice Button */}
                  <button
                    onClick={(e) => handlePreviewPhrase(phrase, e)}
                    className={`h-7 w-7 rounded-lg shrink-0 transition cursor-pointer flex items-center justify-center ${
                      isThisPreviewing
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-slate-750 text-slate-300 hover:bg-amber-500/20 hover:text-amber-300'
                    }`}
                    title="试听发音"
                  >
                    {isThisPreviewing ? (
                      <Square className="w-3 h-3 fill-current" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Phrase Text (Click to Send) */}
                  <button
                    onClick={() => handleSendQuickVoicePhrase(phrase)}
                    className="flex-1 text-left py-0.5 text-slate-100 hover:text-amber-200 text-xs font-semibold truncate cursor-pointer"
                    title="点击发送全桌并语音播报"
                  >
                    {phrase}
                  </button>

                  {/* Send & Broadcast Badge */}
                  <button
                    onClick={() => handleSendQuickVoicePhrase(phrase)}
                    className="h-7 px-2.5 rounded-lg text-[11px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-black transition shrink-0 cursor-pointer flex items-center gap-0.5 shadow-sm"
                    title="发给全桌牌友"
                  >
                    <span>播报</span>
                    <span className="text-xs font-black">➔</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 😀 Quick Emoji Reaction Popover */}
      {showQuickEmoji && (
        <div className="absolute bottom-full left-0 sm:left-12 mb-2 w-[92vw] max-w-sm max-h-[50vh] flex flex-col bg-slate-900/98 border-2 border-amber-500/60 rounded-2xl p-2.5 shadow-2xl backdrop-blur-xl z-50 animate-in slide-in-from-bottom-3 fade-in">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800 shrink-0">
            {/* Subtabs: Props vs Emojis */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setEmojiSubTab('props')}
                className={`h-7 px-2.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                  emojiSubTab === 'props'
                    ? 'bg-amber-500/30 text-amber-300 border border-amber-500/60 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>牌桌道具</span>
              </button>
              <button
                onClick={() => setEmojiSubTab('emoji')}
                className={`h-7 px-2.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                  emojiSubTab === 'emoji'
                    ? 'bg-amber-500/30 text-amber-300 border border-amber-500/60 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smile className="w-3 h-3 text-amber-400" />
                <span>经典表情</span>
              </button>
            </div>

            <button
              onClick={() => setShowQuickEmoji(false)}
              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {emojiSubTab === 'props' ? (
            <div className="grid grid-cols-4 gap-1.5 flex-1 overflow-y-auto no-scrollbar p-0.5 min-h-0">
              {TABLE_INTERACTION_ITEMS.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    handleSendQuickEmoji(item.emoji);
                    setShowQuickEmoji(false);
                  }}
                  className="p-1.5 rounded-xl bg-slate-800/90 hover:bg-amber-500/20 hover:border-amber-400/60 border border-slate-700/80 flex flex-col items-center justify-center gap-0.5 hover:scale-105 active:scale-95 transition cursor-pointer group shadow-sm"
                  title={item.desc}
                >
                  <span className="text-xl group-hover:scale-125 transition-transform">
                    {item.emoji}
                  </span>
                  <span className="text-[10px] font-bold text-slate-200 group-hover:text-amber-200 truncate w-full text-center">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-1.5 flex-1 overflow-y-auto no-scrollbar p-0.5 min-h-0">
              {CHAT_EMOJIS.slice(0, 24).map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    handleSendQuickEmoji(emoji);
                    setShowQuickEmoji(false);
                  }}
                  className="h-9 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 flex items-center justify-center text-xl hover:scale-125 active:scale-90 transition cursor-pointer shadow-sm"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mic Status & Permission Notice Toast */}
      {toastMessage && (
        <div className="w-full mb-1.5 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/60 text-amber-200 text-xs font-bold flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 shadow-md">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="p-0.5 text-amber-400 hover:text-white cursor-pointer">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Main Redesigned Tactical Bar (Spacious, Ergonomic, Large Touch Targets, Zero Overflow) */}
      <div className="w-full bg-slate-900/95 border-2 border-slate-700/80 rounded-xl p-1 shadow-2xl flex items-center justify-between gap-1 shrink-0 backdrop-blur-xl">
        
        {/* 1. Left Action Deck: Voice Mic & Quick Interaction */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          
          {/* Active PTT Recording Widget */}
          {isRecording ? (
            <div
              onPointerMove={handlePointerMove}
              className="flex items-center gap-1.5 animate-in fade-in select-none"
            >
              <button
                onPointerUp={handlePointerUp}
                onClick={handleMicButtonClick}
                className={`h-9 px-2 rounded-lg text-white font-black text-[10px] flex items-center gap-1 shadow-xl transition active:scale-95 cursor-pointer touch-none ${
                  isSlideCancel
                    ? 'bg-amber-600 ring-2 ring-amber-400'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/70 animate-pulse'
                }`}
                title="点击发送对讲语音，或松开发送"
              >
                <Radio className="w-3 h-3 animate-spin" />
                <span>{isSlideCancel ? '取消' : `${recordingSeconds}s`}</span>

                {/* Real-time Sound Wave Equalizer from Mic Volume */}
                <div className="flex items-end gap-0.5 h-3.5 ml-1">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <span
                      key={lvl}
                      className={`w-0.5 sm:w-1 rounded-full transition-all duration-75 ${
                        volumeLevel >= lvl
                          ? lvl > 3 ? 'bg-amber-300 h-3.5' : 'bg-emerald-300 h-2.5'
                          : 'bg-white/30 h-1'
                      }`}
                    />
                  ))}
                </div>
              </button>

              <button
                onClick={cancelVoiceRecord}
                className="h-10 w-10 flex items-center justify-center text-slate-400 hover:text-rose-300 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs transition cursor-pointer border border-slate-700"
                title="取消录音"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : voiceMode === 'openMic' ? (
            /* 🎙️ Open Mic Mode Active View */
            <div className="flex items-center gap-1">
              <button
                onClick={toggleMuteOpenMic}
                className={`h-10 sm:h-11 px-3 rounded-xl border-2 text-xs sm:text-sm font-black flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-lg ${
                  isOpenMicMuted
                    ? 'bg-rose-950/80 border-rose-500 text-rose-300 shadow-rose-950/40'
                    : 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-emerald-950/40'
                }`}
                title={isOpenMicMuted ? '点击取消麦克风静音' : '自由麦已开启 (点击临时静音)'}
              >
                {isOpenMicMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />}
                <span>{isOpenMicMuted ? '已静音' : '自由麦'}</span>

                {/* Real-time Level Bars */}
                {!isOpenMicMuted && (
                  <div className="flex items-end gap-0.5 h-2.5 ml-0.5">
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
                className="h-10 px-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer border border-slate-700 flex items-center gap-1"
                title="切换回按键对讲 (PTT)"
              >
                <Sliders className="w-3 h-3" />
                <span className="hidden md:inline">按键</span>
              </button>
            </div>
          ) : (
            /* 🎙️ Default PTT Voice Button (Generous Touch Target) */
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onClick={handleMicButtonClick}
                className="h-10 sm:h-11 px-3 sm:px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 transition active:scale-95 shadow-lg shadow-indigo-950/60 ring-1 ring-white/20 cursor-pointer select-none touch-none"
                title="点击或按住对讲说话"
              >
                <Mic className="w-4 h-4 text-emerald-200 animate-pulse" />
                <span>按住对讲</span>
              </button>

              {/* Toggle to Open Mic (自由麦) */}
              <button
                onClick={toggleOpenMicMode}
                className="h-10 px-2 sm:px-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-emerald-300 text-xs font-bold transition active:scale-95 cursor-pointer shadow-md flex items-center gap-1"
                title="开启自由麦 (免按键说话)"
              >
                <Headphones className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline">自由麦</span>
              </button>

              {/* ⚡ Quick Voice Tactical Phrases Button */}
              <button
                onClick={() => {
                  setShowQuickVoice(!showQuickVoice);
                  setShowQuickEmoji(false);
                }}
                className={`h-10 px-2.5 sm:px-3 rounded-xl border-2 text-xs font-black flex items-center gap-1 transition active:scale-95 shadow-md cursor-pointer ${
                  showQuickVoice
                    ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-amber-950/50'
                    : 'bg-slate-800 hover:bg-slate-750 border-amber-500/50 text-amber-300 hover:text-amber-200'
                }`}
                title="快捷战术语音播报"
              >
                <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="hidden xs:inline">常用语</span>
              </button>

              {/* 😀 Quick Emoji Button */}
              <button
                onClick={() => {
                  setShowQuickEmoji(!showQuickEmoji);
                  setShowQuickVoice(false);
                }}
                className={`h-10 px-2.5 sm:px-3 rounded-xl border-2 text-xs font-black flex items-center gap-1 transition active:scale-95 shadow-md cursor-pointer ${
                  showQuickEmoji
                    ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-amber-950/50'
                    : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-amber-400 hover:text-amber-300'
                }`}
                title="表情与牌桌互动道具"
              >
                <Smile className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">表情</span>
              </button>
            </div>
          )}

          {/* TTS Toggle & Voice Settings */}
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleTts}
              className={`h-10 w-9 sm:w-auto sm:px-2 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                ttsEnabled
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}
              title={ttsEnabled ? '常用语播报已开启 (点击静音)' : '常用语播报已静音 (点击开启)'}
            >
              {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setShowVoiceSettingsModal(true)}
              className="h-10 w-9 sm:w-auto sm:px-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-amber-300 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1"
              title="设置常用语播报音色与语速"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2. Middle Area: Active Voice Speaker Ripple Banner OR Text Input */}
        {activeSpeaker ? (
          <div
            onClick={onOpenFullChat}
            className="flex-1 h-10 sm:h-11 flex items-center gap-2 px-2.5 rounded-xl bg-emerald-950/80 border-2 border-emerald-500/60 text-emerald-300 min-w-0 cursor-pointer animate-in fade-in transition hover:bg-emerald-950 shadow-lg shadow-emerald-950/50"
            title="点击查看消息记录"
          >
            {/* 🌟 Pulsing Ripple Avatar */}
            <div className="relative flex items-center justify-center w-6 h-6 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="absolute -inset-0.5 rounded-full border-2 border-emerald-400 animate-pulse ring-2 ring-emerald-500/40" />
              <span className="relative z-10 text-sm">{activeSpeaker.avatar}</span>
            </div>

            {/* Speaker identity & content */}
            <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 truncate">
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
                <span className="text-xs font-black text-amber-300 truncate max-w-[65px]">
                  {activeSpeaker.name}
                </span>
                <span className="text-xs text-emerald-200 font-medium truncate">
                  {activeSpeaker.text}
                </span>
              </div>

              {/* Equalizer Bars */}
              <div className="flex items-end gap-0.5 h-3 shrink-0 mr-0.5">
                <span className="w-0.5 h-1.5 bg-emerald-400 animate-pulse rounded-full" />
                <span className="w-0.5 h-3 bg-emerald-300 animate-bounce rounded-full" />
                <span className="w-0.5 h-1.5 bg-emerald-400 animate-pulse rounded-full" />
                <span className="w-0.5 h-2.5 bg-emerald-300 animate-bounce rounded-full" />
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
              className="w-full h-10 sm:h-11 bg-slate-950 border-2 border-slate-700/80 rounded-xl px-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition shadow-inner"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="h-10 sm:h-11 px-3 sm:px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-black text-xs sm:text-sm flex items-center gap-1 transition active:scale-95 cursor-pointer shrink-0 shadow-md shadow-indigo-950/50"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">发送</span>
            </button>
          </form>
        )}

        {/* 3. Right Action Deck: Chat Drawer Button & Triple-Tier Voice Diagnostic */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Triple-Voice Transmission Status Pill */}
          <button
            id="btn-voice-tier-indicator"
            onClick={() => setShowDiagnosticsModal(true)}
            className={`h-10 px-2 sm:px-2.5 rounded-xl border-2 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-md active:scale-95 ${
              voiceStats.activeTier === 'webrtc'
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900/80'
                : voiceStats.activeTier === 'websocket'
                ? 'bg-blue-950/80 border-blue-500/60 text-blue-300 hover:bg-blue-900/80'
                : 'bg-amber-950/80 border-amber-500/60 text-amber-300 hover:bg-amber-900/80'
            }`}
            title="三重语音传输架构：WebRTC P2P + WebSocket高速广播 + HTTP轮询保底 (点击查看实时诊断与链路测试)"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                voiceStats.activeTier === 'webrtc'
                  ? 'bg-emerald-400 animate-pulse'
                  : voiceStats.activeTier === 'websocket'
                  ? 'bg-blue-400 animate-pulse'
                  : 'bg-amber-400'
              }`}
            />
            <span className="hidden lg:inline">
              {voiceStats.activeTier === 'webrtc'
                ? 'P2P直连'
                : voiceStats.activeTier === 'websocket'
                ? 'WS广播'
                : 'HTTP保底'}
            </span>
            <span className="font-mono text-[10px] sm:text-[11px] opacity-90">{voiceStats.latencyMs}ms</span>
          </button>

          {/* Full Chat Drawer Trigger */}
          <button
            onClick={onOpenFullChat}
            className="relative h-10 sm:h-11 px-3 sm:px-3.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border-2 border-indigo-500/60 text-xs sm:text-sm font-black transition flex items-center gap-1 active:scale-95 cursor-pointer shadow-md shadow-indigo-950/50"
            title="打开完整对讲抽屉与聊天记录"
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-300" />
            <span className="hidden sm:inline">聊天</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 min-w-[16px] text-center rounded-full bg-rose-500 text-white text-[9px] font-black absolute -top-1 -right-1 shadow-lg ring-2 ring-slate-900 animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Triple Voice Diagnostics & Settings Modal */}
      <TripleVoiceDiagnosticsModal
        isOpen={showDiagnosticsModal}
        onClose={() => setShowDiagnosticsModal(false)}
      />

      {/* TTS Voice Broadcast Settings Modal */}
      <TtsVoiceSettingsModal
        isOpen={showVoiceSettingsModal}
        onClose={() => setShowVoiceSettingsModal(false)}
      />
    </div>
  );
}

