import React, { useState, useEffect } from 'react';
import {
  Radio,
  Wifi,
  Activity,
  Zap,
  ShieldCheck,
  RefreshCw,
  Sliders,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  X,
  Layers,
  ArrowRight,
  Info
} from 'lucide-react';
import {
  TripleVoiceEngine,
  VoiceEngineStats,
  PeerVoiceState,
  TransmissionTier,
  TierPreference
} from '../lib/tripleVoiceEngine';
import { QUICK_PHRASE_GROUPS } from '../lib/chatManager';

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
  const [selectedPref, setSelectedPref] = useState<TierPreference>(() => engine.getStats().tierPreference);
  const [testPhrase, setTestPhrase] = useState('快点吧，等得花儿都谢了！');
  const [testSuccess, setTestSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setStats(engine.getStats());
    setPeers(engine.getPeers());

    const handleStats = (newStats: VoiceEngineStats) => {
      setStats(newStats);
      setSelectedPref(newStats.tierPreference);
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
    };
  }, [isOpen, engine]);

  if (!isOpen) return null;

  const handleSelectPreference = (pref: TierPreference) => {
    setSelectedPref(pref);
    engine.setTierPreference(pref);
  };

  const handleSendTestPhrase = () => {
    engine.sendVoicePhrase(testPhrase, '诊断测试', '⚡');
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950/90 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-blue-500/20 border border-emerald-500/40 text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>三重语音传输架构诊断控制台</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  v3.0 Multi-Tier
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                WebRTC P2P 直连 · WebSocket 高速广播 · HTTP 轮询保底
              </p>
            </div>
          </div>
          <button
            id="btn-close-voice-diagnostics"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
          {/* Current Active Mode Overview */}
          <div className={`p-4 rounded-xl border ${tierColors[stats.activeTier].border} ${tierColors[stats.activeTier].bg} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">当前活跃传输通道:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${tierColors[stats.activeTier].badge}`}>
                  {stats.activeTier === 'webrtc'
                    ? '🟢 WebRTC P2P 直连'
                    : stats.activeTier === 'websocket'
                    ? '🔵 WebSocket 高速广播'
                    : '🟠 HTTP 轮询保底'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {stats.activeTier === 'webrtc'
                  ? '端到端加密点对点直连，绕过服务器中继，适合局域网与开放公网。'
                  : stats.activeTier === 'websocket'
                  ? '毫秒级全双工音频帧广播，音质无损，适合各种云端容器与沙箱环境。'
                  : '全防火墙穿透长轮询保底传输，零阻塞，确保极端受限网络绝对畅通。'}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className="text-[10px] text-slate-400 font-medium">当前延迟</div>
                <div className="text-lg font-black font-mono text-emerald-400">{stats.latencyMs} ms</div>
              </div>
              <div className="text-right border-l border-slate-700/60 pl-3">
                <div className="text-[10px] text-slate-400 font-medium">收发数据包</div>
                <div className="text-xs font-bold font-mono text-slate-200">
                  ↑{stats.packetsSent} / ↓{stats.packetsReceived}
                </div>
              </div>
            </div>
          </div>

          {/* 3-Tier Architecture Visualization */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Tier 1: WebRTC */}
            <div className={`p-3.5 rounded-xl border transition ${
              stats.activeTier === 'webrtc'
                ? 'border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500/40'
                : 'border-slate-800 bg-slate-950/60 opacity-80'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Tier 1 · WebRTC</span>
                </span>
                <span className={`w-2 h-2 rounded-full ${stats.webrtcPeersCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              </div>
              <div className="text-[11px] text-slate-400 mb-2">P2P 直连网格</div>
              <div className="text-xs font-mono text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">P2P 对端:</span>
                  <span className="font-bold text-emerald-300">{stats.webrtcPeersCount} 人</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">STUN 服务器:</span>
                  <span className="text-slate-300">Google STUN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">典型延迟:</span>
                  <span className="text-emerald-400">&lt; 50ms</span>
                </div>
              </div>
            </div>

            {/* Tier 2: WebSocket */}
            <div className={`p-3.5 rounded-xl border transition ${
              stats.activeTier === 'websocket'
                ? 'border-blue-500 bg-blue-950/30 ring-1 ring-blue-500/40'
                : 'border-slate-800 bg-slate-950/60 opacity-80'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-blue-400" />
                  <span>Tier 2 · WebSocket</span>
                </span>
                <span className={`w-2 h-2 rounded-full ${stats.wsConnected ? 'bg-blue-400 animate-pulse' : 'bg-rose-500'}`} />
              </div>
              <div className="text-[11px] text-slate-400 mb-2">高速音频帧广播</div>
              <div className="text-xs font-mono text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">连接状态:</span>
                  <span className={stats.wsConnected ? 'text-blue-300 font-bold' : 'text-rose-400 font-bold'}>
                    {stats.wsConnected ? '已连接 (Port 3000)' : '离线重连中'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">帧切片:</span>
                  <span className="text-slate-300">Opus/WebM 150ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">典型延迟:</span>
                  <span className="text-blue-400">100-150ms</span>
                </div>
              </div>
            </div>

            {/* Tier 3: HTTP Polling */}
            <div className={`p-3.5 rounded-xl border transition ${
              stats.activeTier === 'http'
                ? 'border-amber-500 bg-amber-950/30 ring-1 ring-amber-500/40'
                : 'border-slate-800 bg-slate-950/60 opacity-80'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tier 3 · HTTP 轮询</span>
                </span>
                <span className="w-2 h-2 rounded-full bg-amber-400" />
              </div>
              <div className="text-[11px] text-slate-400 mb-2">强穿透保底通道</div>
              <div className="text-xs font-mono text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">保底机制:</span>
                  <span className="text-amber-300 font-bold">就绪 / 自动介入</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">轮询周期:</span>
                  <span className="text-slate-300">850ms 增量拉取</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">穿透率:</span>
                  <span className="text-amber-400">100% 穿透</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>传输通道测试与选择模式</span>
              </span>
              <span className="text-[11px] text-slate-500">可强制指定某通道验证穿透效果</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                id="btn-tier-pref-auto"
                onClick={() => handleSelectPreference('auto')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 border ${
                  selectedPref === 'auto'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>⚡ 智能自适应</span>
                <span className="text-[10px] font-normal text-slate-500">P2P优先，自动降级</span>
              </button>

              <button
                id="btn-tier-pref-webrtc"
                onClick={() => handleSelectPreference('webrtc')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 border ${
                  selectedPref === 'webrtc'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>🟢 强制 WebRTC</span>
                <span className="text-[10px] font-normal text-slate-500">端到端直连测试</span>
              </button>

              <button
                id="btn-tier-pref-websocket"
                onClick={() => handleSelectPreference('websocket')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 border ${
                  selectedPref === 'websocket'
                    ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>🔵 强制 WebSocket</span>
                <span className="text-[10px] font-normal text-slate-500">服务中继广播测试</span>
              </button>

              <button
                id="btn-tier-pref-http"
                onClick={() => handleSelectPreference('http')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 border ${
                  selectedPref === 'http'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>🟠 强制 HTTP 轮询</span>
                <span className="text-[10px] font-normal text-slate-500">极限穿墙保底测试</span>
              </button>
            </div>
          </div>

          {/* Quick Voice Phrase Broadcast Test */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>常用战术语音播报快速测试</span>
              </span>
              <span className="text-[11px] text-emerald-400">全桌同步语音播放</span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {[
                '快点吧，等得花儿都谢了！',
                '三清同花顺，免摆直接起飞！',
                '倒水可就直接全赔了哦，谨慎摆牌！',
                '这把庄家发得好牌，准备看枪！',
                '承让承让，运气好而已！'
              ].map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setTestPhrase(p)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                    testPhrase === p
                      ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={testPhrase}
                onChange={(e) => setTestPhrase(e.target.value)}
                placeholder="输入要测试广播的常用语音..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                id="btn-send-test-phrase"
                onClick={handleSendTestPhrase}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95 transition"
              >
                {testSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                <span>{testSuccess ? '广播成功' : '即时播报'}</span>
              </button>
            </div>
          </div>

          {/* Connected Table Peers Status */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <span>当前牌桌同座玩家语音链路</span>
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                在线同伴: {peers.length} 人
              </span>
            </div>

            {peers.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500">
                牌桌暂无其他在座玩家，等待其他玩家进入同房间入座后即可自动建立三重语音链路！
              </div>
            ) : (
              <div className="space-y-2">
                {peers.map((p) => (
                  <div
                    key={p.userId}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <span className="text-xl">{p.avatar}</span>
                        {p.isSpeaking && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{p.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                            {p.seatIndex + 1}号位
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>WebRTC: {p.webrtcState}</span>
                          <span>·</span>
                          <span>收包: {p.packetsReceived}</span>
                        </div>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${tierColors[p.tier].badge}`}>
                      {p.tier}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            <span>架构自动在沙箱/代理/公网间平滑无感切换</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
