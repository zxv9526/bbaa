/**
 * 🎙️ 十三水常用语语音播报引擎 (TtsBroadcastEngine)
 * 专为对局常用语、战术催促、出牌交锋设计的多角色语音合成与对讲电台播报系统
 * 
 * 核心特性：
 * 1. 多角色特色音色（甜美女官、霸气大佬、战术电台、极速战术、悠闲茶客）
 * 2. 针对 WebKit / Chromium (Chrome, iOS Safari, Android) 语音被 GC 中途截断 Bug 的防丢机制
 * 3. 语音合成锁与防卡死 Watchdog 守护进程
 * 4. 步话机开合罗杰哔声 (Radio Chirp / Roger Beep) 音效混音
 * 5. Web Audio API 离线泛音频谱保底，无语音包或受限沙箱亦能清晰发出节奏提示
 * 6. 常用语试听 (Preview) 与全桌广播双向解耦
 * 7. LocalStorage 持久化存储与实时响应监听器
 */

import { getSharedAudioContext, playRadioChirpStart, playRadioChirpEnd } from './chatManager';

export type TtsVoiceRole = 
  | 'female_sweet'    // 💃 甜美女荷官 (温柔知性、清晰甜美)
  | 'male_boss'       // 🎩 霸气大佬 (磁性沉稳、胜券在握)
  | 'radio_tactical'  // 📻 战术电台 (无线电通讯混音、罗杰开合音)
  | 'fast_speed'      // ⚡ 极速战术 (短促干脆、节奏飞快)
  | 'casual_tea';     // 🍵 悠闲茶客 (从容不迫、谈笑风生)

export interface VoiceRoleMeta {
  id: TtsVoiceRole;
  name: string;
  avatar: string;
  tagline: string;
  defaultPitch: number;
  defaultRate: number;
  gender: 'female' | 'male' | 'radio';
}

export const TTS_VOICE_ROLES: VoiceRoleMeta[] = [
  {
    id: 'female_sweet',
    name: '甜美女官',
    avatar: '💃',
    tagline: '温柔知性，清晰动听',
    defaultPitch: 1.16,
    defaultRate: 1.05,
    gender: 'female'
  },
  {
    id: 'male_boss',
    name: '霸气大佬',
    avatar: '🎩',
    tagline: '沉稳磁性，威严果断',
    defaultPitch: 0.82,
    defaultRate: 0.98,
    gender: 'male'
  },
  {
    id: 'radio_tactical',
    name: '战术电台',
    avatar: '📻',
    tagline: '车载对讲，电台风味',
    defaultPitch: 1.04,
    defaultRate: 1.12,
    gender: 'radio'
  },
  {
    id: 'fast_speed',
    name: '极速战术',
    avatar: '⚡',
    tagline: '快节奏，速战速决',
    defaultPitch: 1.02,
    defaultRate: 1.28,
    gender: 'female'
  },
  {
    id: 'casual_tea',
    name: '悠闲茶客',
    avatar: '🍵',
    tagline: '谈笑风生，从容不迫',
    defaultPitch: 0.92,
    defaultRate: 0.92,
    gender: 'male'
  }
];

export interface TtsConfig {
  enabled: boolean;
  role: TtsVoiceRole;
  rate: number;         // 0.8 ~ 1.5
  pitch: number;        // 0.7 ~ 1.4
  volume: number;       // 0.0 ~ 1.0
  playRadioChirp: boolean; // 是否在播报前后发出无线电哔哔声
  preferredVoiceURI?: string;
}

const STORAGE_KEY = 'thirteen_water_tts_config_v2';

const DEFAULT_CONFIG: TtsConfig = {
  enabled: true,
  role: 'female_sweet',
  rate: 1.06,
  pitch: 1.12,
  volume: 1.0,
  playRadioChirp: true,
  preferredVoiceURI: undefined
};

// 内存中保持当前 Utterance 强引用，彻底解决 Chromium/WebKit 浏览器的 GC 中途杀掉语音 bug
let activeUtterance: SpeechSynthesisUtterance | null = null;
let watchdogTimeoutId: ReturnType<typeof setTimeout> | null = null;

export class TtsBroadcastEngine {
  private static instance: TtsBroadcastEngine | null = null;
  private config: TtsConfig;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private isInitialized: boolean = false;
  private listeners: Set<(config: TtsConfig) => void> = new Set();
  private speakingStatusListeners: Set<(isSpeaking: boolean) => void> = new Set();
  private isCurrentlySpeaking: boolean = false;

  private constructor() {
    this.config = this.loadConfig();
    this.initVoices();
  }

  public static getInstance(): TtsBroadcastEngine {
    if (!TtsBroadcastEngine.instance) {
      TtsBroadcastEngine.instance = new TtsBroadcastEngine();
    }
    return TtsBroadcastEngine.instance;
  }

  private loadConfig(): TtsConfig {
    if (typeof window === 'undefined') return { ...DEFAULT_CONFIG };
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch {}
    return { ...DEFAULT_CONFIG };
  }

  public saveConfig(newConfig: Partial<TtsConfig>) {
    this.config = { ...this.config, ...newConfig };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      } catch {}
    }
    this.notifyListeners();
  }

  public getConfig(): TtsConfig {
    return { ...this.config };
  }

  public setEnabled(enabled: boolean) {
    this.saveConfig({ enabled });
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public setRole(role: TtsVoiceRole) {
    const meta = TTS_VOICE_ROLES.find(r => r.id === role);
    if (meta) {
      this.saveConfig({
        role,
        pitch: meta.defaultPitch,
        rate: meta.defaultRate
      });
    } else {
      this.saveConfig({ role });
    }
  }

  public subscribe(listener: (config: TtsConfig) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public subscribeSpeaking(listener: (isSpeaking: boolean) => void): () => void {
    this.speakingStatusListeners.add(listener);
    return () => this.speakingStatusListeners.delete(listener);
  }

  private notifyListeners() {
    for (const l of this.listeners) {
      try { l(this.getConfig()); } catch {}
    }
  }

  private notifySpeaking(speaking: boolean) {
    this.isCurrentlySpeaking = speaking;
    for (const l of this.speakingStatusListeners) {
      try { l(speaking); } catch {}
    }
  }

  public isSpeaking(): boolean {
    return this.isCurrentlySpeaking;
  }

  private initVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const refresh = () => {
      try {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          this.cachedVoices = voices;
          this.isInitialized = true;
        }
      } catch {}
    };

    refresh();
    try {
      window.speechSynthesis.onvoiceschanged = () => {
        refresh();
      };
    } catch {}
  }

  /**
   * 获取当前系统可用的中文语音包列表
   */
  public getChineseVoices(): SpeechSynthesisVoice[] {
    if (!this.cachedVoices.length && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        this.cachedVoices = window.speechSynthesis.getVoices();
      } catch {}
    }

    return this.cachedVoices.filter(v => {
      const l = (v.lang || '').toLowerCase();
      return l.startsWith('zh') || l.includes('cmn') || l.includes('chinese');
    });
  }

  /**
   * 根据当前音色角色智能匹配最佳 SpeechSynthesisVoice
   */
  public matchBestVoice(role: TtsVoiceRole = this.config.role): SpeechSynthesisVoice | null {
    const chineseVoices = this.getChineseVoices();
    if (!chineseVoices.length) return null;

    // 如果用户显式选择了某个 VoiceURI
    if (this.config.preferredVoiceURI) {
      const found = chineseVoices.find(v => v.voiceURI === this.config.preferredVoiceURI);
      if (found) return found;
    }

    const roleMeta = TTS_VOICE_ROLES.find(r => r.id === role);
    const targetGender = roleMeta ? roleMeta.gender : 'female';

    if (targetGender === 'female') {
      // 优先匹配女声关键词
      const femaleKeywords = ['xiaoxiao', 'tingting', 'sinji', 'meijia', 'huihui', 'yaoyao', 'female', '女', 'google 普通话'];
      for (const kw of femaleKeywords) {
        const match = chineseVoices.find(v => (v.name + ' ' + v.voiceURI).toLowerCase().includes(kw));
        if (match) return match;
      }
    } else if (targetGender === 'male') {
      // 优先匹配男声关键词
      const maleKeywords = ['yunxi', 'kangkang', 'danny', 'yunyang', 'male', '男', 'zhiwei'];
      for (const kw of maleKeywords) {
        const match = chineseVoices.find(v => (v.name + ' ' + v.voiceURI).toLowerCase().includes(kw));
        if (match) return match;
      }
    }

    // 默认选用第一个中文语音
    return chineseVoices[0] || null;
  }

  /**
   * 离线多频段人声节奏回响保底 (当浏览器未安装中文包或处于受限沙箱时)
   */
  private playAcousticFallbackTone(text: string) {
    try {
      const ctx = getSharedAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const syllables = Math.min(8, Math.max(3, Math.floor(text.length * 0.7)));
      const baseFreq = this.config.role === 'male_boss' ? 180 : 340;

      for (let i = 0; i < syllables; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + i * 0.12;
        const dur = 0.09;
        
        osc.type = this.config.role === 'radio_tactical' ? 'sawtooth' : 'sine';
        // 词调起伏
        const inflection = Math.sin((i / syllables) * Math.PI) * 60;
        osc.frequency.setValueAtTime(baseFreq + inflection, start);
        osc.frequency.exponentialRampToValueAtTime(baseFreq + inflection * 0.8, start + dur);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.08 * this.config.volume, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
      }
    } catch {}
  }

  /**
   * 核心常用语播报执行入口
   * @param text 要朗读的文本
   * @param options 临时覆盖参数
   */
  public speak(
    text: string, 
    options?: {
      overrideRole?: TtsVoiceRole;
      isLocalPreview?: boolean;
      onEnd?: () => void;
    }
  ): void {
    if (!text || !text.trim()) return;
    const cleanText = text.replace(/\[.*?\]/g, '').trim(); // 过滤类似 "[实时语音 2秒]"
    if (!cleanText) return;

    // 若非本地试听，且设置了关闭语音，则直接跳过
    if (!options?.isLocalPreview && !this.config.enabled) {
      return;
    }

    const currentRole = options?.overrideRole || this.config.role;
    const roleMeta = TTS_VOICE_ROLES.find(r => r.id === currentRole) || TTS_VOICE_ROLES[0];

    // 1. 无线电开合提示音 (若开启)
    if (this.config.playRadioChirp) {
      try {
        playRadioChirpStart();
      } catch {}
    }

    // 2. 检测 Web Speech API 支持情况
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.playAcousticFallbackTone(cleanText);
      if (options?.onEnd) options.onEnd();
      return;
    }

    try {
      // 唤醒处于暂停挂起状态的语音合成
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      // 清理前一次残留
      if (watchdogTimeoutId) {
        clearTimeout(watchdogTimeoutId);
        watchdogTimeoutId = null;
      }
      window.speechSynthesis.cancel();

      // 创建合成对象
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'zh-CN';

      // 音调与语速计算
      let pitch = this.config.pitch;
      let rate = this.config.rate;

      // 若指定了临时角色覆盖，按角色默认参数微调
      if (options?.overrideRole) {
        pitch = roleMeta.defaultPitch;
        rate = roleMeta.defaultRate;
      }

      utterance.pitch = Math.max(0.6, Math.min(1.8, pitch));
      utterance.rate = Math.max(0.7, Math.min(1.8, rate));
      utterance.volume = Math.max(0, Math.min(1, this.config.volume));

      // 匹配最佳发音人
      const bestVoice = this.matchBestVoice(currentRole);
      if (bestVoice) {
        utterance.voice = bestVoice;
      }

      // 防止 GC 回收并设立守护状态
      activeUtterance = utterance;
      this.notifySpeaking(true);

      const finishSpeech = () => {
        if (watchdogTimeoutId) {
          clearTimeout(watchdogTimeoutId);
          watchdogTimeoutId = null;
        }
        activeUtterance = null;
        this.notifySpeaking(false);
        if (this.config.playRadioChirp && currentRole === 'radio_tactical') {
          try { playRadioChirpEnd(); } catch {}
        }
        if (options?.onEnd) {
          try { options.onEnd(); } catch {}
        }
      };

      utterance.onend = () => {
        finishSpeech();
      };

      utterance.onerror = (e) => {
        console.warn('TTS playback error, fallback to acoustic tone:', e);
        this.playAcousticFallbackTone(cleanText);
        finishSpeech();
      };

      // 守护超时（根据文字长度动态计算，最长不超过 8 秒）
      const safeDurationMs = Math.max(3000, cleanText.length * 450 + 2000);
      watchdogTimeoutId = setTimeout(() => {
        if (activeUtterance) {
          try {
            window.speechSynthesis.cancel();
          } catch {}
          finishSpeech();
        }
      }, safeDurationMs);

      // 小延时调用避免移动端 Chrome 的连续 cancel-speak 锁死
      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utterance);
        } catch (err) {
          this.playAcousticFallbackTone(cleanText);
          finishSpeech();
        }
      }, 30);

    } catch (err) {
      console.warn('SpeechSynthesis exception:', err);
      this.playAcousticFallbackTone(cleanText);
      this.notifySpeaking(false);
      if (options?.onEnd) options.onEnd();
    }
  }

  /**
   * 本地试听常用语播报效果（不发送、不受全局静音阻断）
   */
  public previewPhrase(phrase: string, role?: TtsVoiceRole, onEnd?: () => void): void {
    this.speak(phrase, {
      overrideRole: role,
      isLocalPreview: true,
      onEnd
    });
  }

  /**
   * 停止当前所有正在播报的语音
   */
  public stop(): void {
    if (watchdogTimeoutId) {
      clearTimeout(watchdogTimeoutId);
      watchdogTimeoutId = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    activeUtterance = null;
    this.notifySpeaking(false);
  }
}
