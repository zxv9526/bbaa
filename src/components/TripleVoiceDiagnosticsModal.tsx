import React, { useState, useEffect } from 'react';
import {
  Mic,
  Volume2,
  VolumeX,
  Play,
  Square,
  Activity,
  Zap,
  Sliders,
  X,
  CheckCircle2,
  Check,
  Radio,
  Wifi,
  ShieldCheck
} from 'lucide-react';
import {
  TripleVoiceEngine,
  VoiceEngineStats,
  PeerVoiceState,
  TransmissionTier,
  TierPreference,
  VadSensitivity
} from '../lib/tripleVoiceEngine';
import { VoiceRecorder } from '../lib/chatManager';

interface TripleVoiceDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TripleVoiceDiagnosticsModal({
  isOpen,
  onClose
}: TripleVoiceDiagnosticsModalProps) {
  const engine = TripleVoiceEngine.getInstance();
  const [stats, setStats] = useState<VoiceEngineStats>(() => engine.getStats());
  const [peers, setPeers] = useState<PeerVoiceState[]>(() => engine.getPeers());
  const [testPhrase, setTestPhrase] = useState('快点吧，等得花儿都谢了！');
  const [testSuccess, setTestSuccess] = useState(false);

  // Hardware Mic Test state
  const [micTesting, setMicTesting] = useState(false);
  const [micTestVolume, setMicTestVolume] = useState(0);
  const testRecorderRef = React.useRef<VoiceRecorder | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (testRecorderRef.current) {
        testRecorderRef.current.cancel();
        testRecorderRef.current = null;
      }
      setMicTesting(false);
      return;
    }

    setStats(engine.getStats());
    setPeers(engine.getPeers());

    const handleStats = (newStats: VoiceEngineStats) => {
      setStats(newStats);
    };
    const handlePeers = (newPeers: PeerVoiceState[]) => {
      setPeers(newPeers);
    };

    engine.onStatsChange = handleStats;
    engine.onPeersChange = handlePeers;

    const timer = setInterval(() => {
      setStats(engine.getStats());
      setPeers(engine.getPeers());
    }, 1000);

    return () => {
      clearInterval(timer);
      if (testRecorderRef.current) {
        testRecorderRef.current.cancel();
        testRecorderRef.current = null;
      }
    };
  }, [isOpen, engine]);

  if (!isOpen) return null;

  const handleToggleMicTest = async () => {
    if (micTesting) {
      if (testRecorderRef.current) {
        testRecorderRef.current.cancel();
        testRecorderRef.current = null;
      }
      setMicTesting(false);
      setMicTestVolume(0);
    } else {
      try {
        const recorder = new VoiceRecorder();
        recorder.onVolume = (vol) => {
          setMicTestVolume(vol);
        };
        await recorder.start();
        testRecorderRef.current = recorder;
        setMicTesting(true);
      } catch {
        setMicTesting(false);
      }
    }
  };

  const handleSendTestPhrase = () => {
    engine.sendVoicePhrase(testPhrase, '快捷测试', '⚡');
    setTestSuccess(true);
    setTimeout(() => setTestSuccess(false), 2000);
  };

  const tierColors: Record<TransmissionTier, { border: string; bg: string; text: string; badge: string }> = {
    webrtc: {
      border: 'border-emerald-500/50',
      bg: 'bg-emerald-950/40',
      text: 'text-emerald-300',
      badge: 'bg-emerald-500 text-slate-950'
    },
    websocket: {
      border: 'border-blue-500/50',
      bg: 'bg-blue-950/40',
      text: 'text-blue-300',
      badge: 'bg-blue-500 text-white'
    },
    http: {
      border: 'border-amber-500/50',
      bg: 'bg-amber-950/40',
      text: 'text-amber-300',
      badge: 'bg-amber-500 text-slate-950'
    }
  };

  return (
    <div
      id="modal-triple-voice-diagnostics"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950/90 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-blue-500/20 border border-emerald-500/40 text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>实时语音音效与麦克风设置</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  stats.wsConnected
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                    : 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                }`}>
                  {stats.wsConnected ? '对讲就绪' : '连接维护中'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                实时调节麦克风输入、灵敏度、放音音量与经典对讲提示音
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 max-h-[calc(85vh-130px)]">
          
          {/* Section 1: Microphone Hardware Test */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-200 text-xs flex items-center gap-2">
                <Mic className="w-4 h-4 text-emerald-400" />
                <span>麦克风实时输入硬件电平测试</span>
              </div>
              <button
                onClick={handleToggleMicTest}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  micTesting
                    ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {micTesting ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{micTesting ? '停止试麦' : '开始试麦'}</span>
              </button>
            </div>

            {/* 20-segment LED VU Meter */}
            <div className="flex items-center gap-1 h-3.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
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
              <span>静音 (-40dB)</span>
              <span>清晰人声 (-18dB)</span>
              <span>爆音 (0dB)</span>
            </div>
          </div>

          {/* Section 2: Audio Preferences */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Output Volume */}
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-indigo-400" />
                  <span>语音播放音量</span>
                </span>
                <span className="font-mono text-indigo-300">
                  {Math.round(stats.outputVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={stats.outputVolume}
                onChange={(e) => {
                  engine.setOutputVolume(parseFloat(e.target.value));
                  setStats(engine.getStats());
                }}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Radio Chirp Toggle */}
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-amber-400" />
                  <span>经典对讲机提示音</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  按下与松开时发出电台对讲咔哒声
                </div>
              </div>
              <button
                onClick={() => {
                  const next = !engine.getRadioChirpEnabled();
                  engine.setRadioChirpEnabled(next);
                  setStats(engine.getStats());
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

          {/* Section 3: VAD Sensitivity */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>自由麦拾音灵敏度</span>
              </span>
              <span className="text-[10px] text-slate-400">
                当前: {engine.getVadSensitivity() === 'low' ? '低灵敏' : engine.getVadSensitivity() === 'high' ? '高灵敏' : '标准日常'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'low' as VadSensitivity, label: '低灵敏', desc: '吵闹环境 / 防误触' },
                { id: 'medium' as VadSensitivity, label: '标准日常', desc: '推荐日常交流' },
                { id: 'high' as VadSensitivity, label: '高灵敏', desc: '安静夜间 / 轻语' }
              ].map((item) => {
                const isSelected = engine.getVadSensitivity() === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      engine.setVadSensitivity(item.id);
                      setStats(engine.getStats());
                    }}
                    className={`p-2 rounded-xl text-left transition border cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
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

          {/* Section 4: Table Players Voice Status */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-blue-400" />
                <span>当前牌桌同座玩家对讲状态</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                在线: {peers.length} 人
              </span>
            </div>

            {peers.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-500">
                当前牌桌暂无其他在座玩家，其他玩家入座后将自动开启对讲
              </div>
            ) : (
              <div className="space-y-1.5">
                {peers.map((p) => (
                  <div
                    key={p.userId}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{p.avatar}</span>
                      <span className="font-bold text-white">{p.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                        {p.seatIndex + 1}号位
                      </span>
                    </div>
                    <span className="text-[11px] text-emerald-400 font-medium">
                      {p.isSpeaking ? '正在发言...' : '已就绪'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>游戏对局由 Cloudflare 强力保障，网络稳定顺畅</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
