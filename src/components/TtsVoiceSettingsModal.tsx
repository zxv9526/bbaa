import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Radio,
  Sparkles,
  Sliders,
  Check,
  RotateCcw,
  X,
  Play,
  Square,
  Zap,
  Info
} from 'lucide-react';
import {
  TtsBroadcastEngine,
  TTS_VOICE_ROLES,
  TtsVoiceRole,
  TtsConfig
} from '../lib/ttsEngine';

interface TtsVoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TtsVoiceSettingsModal({ isOpen, onClose }: TtsVoiceSettingsModalProps) {
  const engine = TtsBroadcastEngine.getInstance();
  const [config, setConfig] = useState<TtsConfig>(() => engine.getConfig());
  const [chineseVoices, setChineseVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [previewingRole, setPreviewingRole] = useState<TtsVoiceRole | null>(null);
  const [isSpeakingSample, setIsSpeakingSample] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setConfig(engine.getConfig());
    setChineseVoices(engine.getChineseVoices());

    const unsubConfig = engine.subscribe((newCfg) => {
      setConfig(newCfg);
    });

    const unsubSpeaking = engine.subscribeSpeaking((speaking) => {
      setIsSpeakingSample(speaking);
      if (!speaking) {
        setPreviewingRole(null);
      }
    });

    return () => {
      unsubConfig();
      unsubSpeaking();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleEnabled = () => {
    const next = !config.enabled;
    engine.setEnabled(next);
  };

  const handleSelectRole = (role: TtsVoiceRole) => {
    engine.setRole(role);
  };

  const handlePreviewRole = (role: TtsVoiceRole, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingRole === role && isSpeakingSample) {
      engine.stop();
      setPreviewingRole(null);
      return;
    }

    setPreviewingRole(role);
    const samplePhrases: Record<TtsVoiceRole, string> = {
      female_sweet: '欢迎来到十三水牌桌，请各位牌友精心摆牌！',
      male_boss: '手风正顺，看我这一把通杀全场，承让了！',
      radio_tactical: '车载对讲机已连通，战术常用语准备播报！',
      fast_speed: '时间不等人，抓紧出牌咯！',
      casual_tea: '青山不改绿水长流，大哥大姐手下留情，小弟倒茶了。'
    };

    engine.previewPhrase(samplePhrases[role], role, () => {
      setPreviewingRole(null);
    });
  };

  const handleTestCurrent = () => {
    if (isSpeakingSample) {
      engine.stop();
      return;
    }
    const phrase = '三清同花顺，免摆直接起飞！常用语语音播报调试正常。';
    engine.previewPhrase(phrase, config.role, () => {
      setIsSpeakingSample(false);
    });
  };

  const handleResetDefaults = () => {
    engine.saveConfig({
      enabled: true,
      role: 'female_sweet',
      rate: 1.06,
      pitch: 1.12,
      volume: 1.0,
      playRadioChirp: true,
      preferredVoiceURI: undefined
    });
  };

  const bestVoice = engine.matchBestVoice(config.role);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-sm">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-white flex items-center gap-2">
                <span>常用语语音播报设置</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                  实时生效
                </span>
              </div>
              <div className="text-[11px] text-slate-400">个性化定制十三水常用语发音角色、语速与对讲音效</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 no-scrollbar text-xs">
          {/* Main TTS Switch */}
          <div className="p-4 rounded-2xl bg-slate-850/90 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                config.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
              }`}>
                {config.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </div>
              <div>
                <div className="font-black text-slate-200 text-xs">常用语语音播报总开关</div>
                <div className="text-[10px] text-slate-400">
                  {config.enabled ? '已开启：收到牌友常用语时自动使用专属语音朗读' : '已静音：仅显示文字气泡，不播放语音合成'}
                </div>
              </div>
            </div>
            <button
              onClick={handleToggleEnabled}
              className={`w-12 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                config.enabled ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  config.enabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 5 Voice Character Roles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>播报角色音色 (点击选择，右侧试听)</span>
              </span>
              <span className="text-[10px] text-amber-400/80 font-mono">5大特色声线</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TTS_VOICE_ROLES.map((r) => {
                const isSelected = config.role === r.id;
                const isThisPreviewing = previewingRole === r.id && isSpeakingSample;

                return (
                  <div
                    key={r.id}
                    onClick={() => handleSelectRole(r.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/60 shadow-md shadow-amber-500/10'
                        : 'bg-slate-800/70 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`text-2xl w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-amber-400/20' : 'bg-slate-700/50'
                      }`}>
                        {r.avatar}
                      </div>
                      <div className="truncate">
                        <div className="font-black text-xs text-white flex items-center gap-1.5">
                          <span>{r.name}</span>
                          {isSelected && <Check className="w-3 h-3 text-amber-400" />}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{r.tagline}</div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handlePreviewRole(r.id, e)}
                      className={`px-2 py-1 rounded-xl text-[10px] font-bold shrink-0 flex items-center gap-1 transition cursor-pointer ${
                        isThisPreviewing
                          ? 'bg-rose-500 text-white animate-pulse'
                          : isSelected
                          ? 'bg-amber-500/30 text-amber-200 hover:bg-amber-500/50 border border-amber-400/40'
                          : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700 border border-slate-600/40'
                      }`}
                      title="点击试听此角色的发音"
                    >
                      {isThisPreviewing ? (
                        <>
                          <Square className="w-3 h-3 fill-current" />
                          <span>停止</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current" />
                          <span>试听</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sliders: Rate, Pitch, Volume */}
          <div className="p-4 rounded-2xl bg-slate-850/90 border border-slate-800 space-y-3.5">
            <div className="font-bold text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>声学微调参数</span>
            </div>

            {/* Rate Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>语速调节 (当前: {config.rate.toFixed(2)}x)</span>
                <span>{config.rate < 1.0 ? '慢速从容' : config.rate > 1.15 ? '紧凑飞速' : '自然标准'}</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.4"
                step="0.05"
                value={config.rate}
                onChange={(e) => engine.saveConfig({ rate: parseFloat(e.target.value) })}
                className="w-full accent-amber-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            {/* Pitch Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>音调微调 (当前: {config.pitch.toFixed(2)})</span>
                <span>{config.pitch < 0.95 ? '低沉磁性' : config.pitch > 1.15 ? '清脆高昂' : '标准音高'}</span>
              </div>
              <input
                type="range"
                min="0.75"
                max="1.35"
                step="0.05"
                value={config.pitch}
                onChange={(e) => engine.saveConfig({ pitch: parseFloat(e.target.value) })}
                className="w-full accent-amber-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            {/* Volume Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>播报音量 (当前: {Math.round(config.volume * 100)}%)</span>
                <span>{config.volume === 0 ? '静音' : config.volume === 1 ? '最大音量' : '适中'}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.volume}
                onChange={(e) => engine.saveConfig({ volume: parseFloat(e.target.value) })}
                className="w-full accent-amber-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Radio Chirp FX Toggle */}
          <div className="p-3.5 rounded-2xl bg-slate-850/90 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <div className="font-black text-slate-200 text-xs">车载对讲开闭哔声 (Chirp Beep)</div>
                <div className="text-[10px] text-slate-400">在常用语播报前后模拟真实无线电步话机呼叫提示音</div>
              </div>
            </div>
            <button
              onClick={() => engine.saveConfig({ playRadioChirp: !config.playRadioChirp })}
              className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                config.playRadioChirp ? 'bg-amber-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  config.playRadioChirp ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* System TTS Voice Status */}
          <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center gap-2 text-slate-400">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="text-[10px] leading-relaxed">
              <span>系统检测：已加载 </span>
              <span className="font-bold text-slate-200">{chineseVoices.length}</span>
              <span> 个中文发音引擎。当前匹配音源：</span>
              <span className="font-bold text-amber-300 font-mono">
                {bestVoice ? `${bestVoice.name}` : '浏览器内置中文引擎 (或智能多频声效保底)'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={handleResetDefaults}
            className="px-3 py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>恢复默认</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTestCurrent}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-lg cursor-pointer ${
                isSpeakingSample
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              {isSpeakingSample ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isSpeakingSample ? '停止试听' : '试听当前效果'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
