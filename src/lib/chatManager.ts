import { ChatMessage } from '../types';

export interface QuickPhraseCategory {
  category: string;
  icon: string;
  phrases: string[];
}

export const QUICK_PHRASE_GROUPS: QuickPhraseCategory[] = [
  {
    category: '战术催促',
    icon: '⏳',
    phrases: [
      '快点吧，等得花儿都谢了！',
      '别墨迹啦，赶快摆牌！',
      '时间不等人，抓紧上牌咯！',
      '都好了没？我已经准备好通杀了！'
    ]
  },
  {
    category: '出牌交锋',
    icon: '🃏',
    phrases: [
      '三清同花顺，免摆直接起飞！',
      '这把庄家发得好牌，准备看枪！',
      '倒水可就直接全赔了哦，谨慎摆牌！',
      '乌龙就别硬撑了，速速投降！',
      '全垒打通杀八方，承让了！'
    ]
  },
  {
    category: '气势攻心',
    icon: '🔥',
    phrases: [
      '这把我牌面很大，你们小心点！',
      '看我这一把通杀全场，打枪翻倍！',
      '搏一搏，单车变摩托！',
      '手风正顺，谁敢与我一战！',
      '特殊牌型在手，免摆直接起飞！'
    ]
  },
  {
    category: '自嘲求饶',
    icon: '🍵',
    phrases: [
      '手气太背了，全是散牌，手下留情！',
      '大哥大姐手下留情，小弟给您倒茶了！',
      '哎呀又倒水了，这把难顶啊！',
      '求轻虐，积分不够输啦！'
    ]
  },
  {
    category: '赞赏风度',
    icon: '🤝',
    phrases: [
      '打得漂亮，这把甘拜下风！',
      '青山不改绿水长流，下把再战！',
      '承让承让，运气好而已！',
      '厉害厉害，高手在民间啊！'
    ]
  }
];

export const CHAT_EMOJIS = [
  '😆', '😎', '🤣', '😭', 
  '😡', '😱', '🔥', '👏', 
  '💣', '🍗', '🍻', '💯', 
  '👍', '🙏', '🎉', '😈',
  '🤡', '🤑', '🤐', '👀',
  '🃏', '👑', '🍵', '⚡'
];

export const AI_NAMES_POOL = [
  { name: '智多星', avatar: '🤖' },
  { name: '百胜侯', avatar: '🦊' },
  { name: '十三叔', avatar: '🐼' },
  { name: '猛虎客', avatar: '🐯' },
  { name: '龙行天下', avatar: '🐉' },
  { name: '幻影刺客', avatar: '🥷' },
  { name: '东方不败', avatar: '🦁' },
  { name: '财神到', avatar: '🎩' }
];

/**
 * Generate a simulated voice note audio WAV blob & URL without exhausting AudioContext hardware limits
 * Ensures voice messages can be previewed/played even without mic permissions or in sandboxes
 */
export function createSimulatedVoiceAudioBlob(durationSec: number = 2, pitchFreq: number = 320): { blob: Blob; url: string } {
  try {
    const sampleRate = 22050;
    const totalSamples = Math.floor(sampleRate * Math.min(10, Math.max(1, durationSec)));
    const data = new Float32Array(totalSamples);

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      // Synthesize walkie-talkie / voice radio wave harmonics
      const mainFreq = pitchFreq + Math.sin(t * 18) * 50;
      const subFreq = mainFreq * 1.5;
      const envelope = Math.sin((i / totalSamples) * Math.PI);
      const voiceWave = Math.sin(2 * Math.PI * mainFreq * t) * 0.6 + Math.sin(2 * Math.PI * subFreq * t) * 0.3;
      data[i] = voiceWave * envelope * 0.4;
    }

    // Convert Float32Array directly to WAV Blob
    const wavBlob = float32ArrayToWavBlob(data, sampleRate);
    const url = URL.createObjectURL(wavBlob);
    return { blob: wavBlob, url };
  } catch (err) {
    console.warn('Failed to synthesize voice audio:', err);
    const emptyBlob = new Blob([], { type: 'audio/wav' });
    return { blob: emptyBlob, url: '' };
  }
}

export function createSimulatedVoiceAudioUrl(durationSec: number = 2, pitchFreq: number = 320): string {
  return createSimulatedVoiceAudioBlob(durationSec, pitchFreq).url;
}

/**
 * Helper to encode float32 audio samples directly into a playable PCM WAV Blob
 */
function float32ArrayToWavBlob(channelData: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bufferLength = channelData.length;
  const wavBuffer = new ArrayBuffer(44 + bufferLength * 2);
  const view = new DataView(wavBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  /* RIFF identifier */
  writeString(0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + bufferLength * 2, true);
  /* RIFF type */
  writeString(8, 'WAVE');
  /* format chunk identifier */
  writeString(12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numChannels * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numChannels * 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(36, 'data');
  /* data chunk length */
  view.setUint32(40, bufferLength * 2, true);

  /* float to 16-bit PCM conversion */
  let offset = 44;
  for (let i = 0; i < bufferLength; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

/**
 * Shared AudioContext singleton for walkie-talkie and notification chirps
 * Avoids browser hardware context exhaustion (max 6-32 AudioContexts)
 */
let sharedAudioCtx: AudioContext | null = null;
function getSharedAudioContext(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtxClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

let radioChirpSoundEnabled = true;

export function setRadioChirpSoundEnabled(enabled: boolean) {
  radioChirpSoundEnabled = enabled;
}

export function getRadioChirpSoundEnabled(): boolean {
  return radioChirpSoundEnabled;
}

/**
 * Walkie-talkie radio beep sound effects
 */
export function playRadioChirpStart() {
  if (!radioChirpSoundEnabled) return;
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(1050, now + 0.06);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } catch {}
}

export function playRadioChirpEnd() {
  if (!radioChirpSoundEnabled) return;
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.setValueAtTime(720, now + 0.04);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } catch {}
}

export function playIncomingRadioBeep() {
  if (!radioChirpSoundEnabled) return;
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(750, now);
    osc.frequency.setValueAtTime(1100, now + 0.05);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  } catch {}
}

/**
 * Browser-native Web Speech Synthesis (TTS)
 */
export function speakTextMessage(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.08;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis not available:', err);
  }
}

export interface VoiceRecordResult {
  audioBlob: Blob;
  audioUrl: string;
  duration: number;
}

/**
 * Audio Recorder for Voice Messages with Simulated Fallback & Real-time Volume Meter
 * Hardened against rapid clicks, repeated stop calls, and browser audio context limits
 */
export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private stream: MediaStream | null = null;
  private isSimulated: boolean = false;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private isStopping: boolean = false;
  private isStopped: boolean = false;
  private stopPromise: Promise<VoiceRecordResult> | null = null;
  public onVolume?: (vol: number) => void;

  async start(): Promise<void> {
    this.audioChunks = [];
    this.startTime = Date.now();
    this.isSimulated = false;
    this.isStopping = false;
    this.isStopped = false;
    this.stopPromise = null;

    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        // Initialize AudioContext Analyser for real-time VU meter
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            this.audioCtx = new AudioContextClass();
            const source = this.audioCtx.createMediaStreamSource(this.stream);
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);
            this.monitorVolume();
          }
        } catch (e) {
          console.warn('Volume meter initialization note:', e);
        }

        let mimeType: string | undefined = undefined;
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
          } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
            mimeType = 'audio/ogg';
          }
        }

        this.mediaRecorder = mimeType ? new MediaRecorder(this.stream, { mimeType }) : new MediaRecorder(this.stream);
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };
        this.mediaRecorder.start(100);
        return;
      } catch (err) {
        console.warn('Microphone permission denied/unavailable, switching to simulated voice mode:', err);
      }
    }

    // Fallback to simulated microphone recording
    this.isSimulated = true;
    this.simulateVolumePulse();
  }

  private monitorVolume() {
    if (!this.analyser) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    const check = () => {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const normalizedVol = Math.min(100, Math.round((avg / 128) * 100));
      if (this.onVolume) {
        this.onVolume(normalizedVol);
      }
      this.animFrameId = requestAnimationFrame(check);
    };
    this.animFrameId = requestAnimationFrame(check);
  }

  private simulateVolumePulse() {
    const pulse = () => {
      if (!this.isSimulated || this.isStopped) return;
      const simVol = Math.floor(Math.random() * 40) + 20;
      if (this.onVolume) {
        this.onVolume(simVol);
      }
      this.animFrameId = requestAnimationFrame(pulse);
    };
    this.animFrameId = requestAnimationFrame(pulse);
  }

  private cleanupAudioCtx() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
    this.analyser = null;
  }

  stop(): Promise<VoiceRecordResult> {
    if (this.stopPromise) {
      return this.stopPromise;
    }

    this.isStopping = true;
    this.cleanupAudioCtx();

    this.stopPromise = new Promise<VoiceRecordResult>((resolve) => {
      const duration = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));

      const finalizeSimulated = () => {
        this.isStopped = true;
        this.isStopping = false;
        const sim = createSimulatedVoiceAudioBlob(duration, 380);
        resolve({ audioBlob: sim.blob, audioUrl: sim.url, duration });
      };

      if (this.isSimulated || !this.mediaRecorder) {
        finalizeSimulated();
        return;
      }

      let isResolved = false;
      const handleDone = () => {
        if (isResolved) return;
        isResolved = true;
        this.isStopped = true;
        this.isStopping = false;

        if (this.stream) {
          try {
            this.stream.getTracks().forEach((track) => track.stop());
          } catch {}
          this.stream = null;
        }

        if (this.audioChunks.length > 0) {
          try {
            const mime = this.mediaRecorder?.mimeType || 'audio/webm';
            const audioBlob = new Blob(this.audioChunks, { type: mime });
            const audioUrl = URL.createObjectURL(audioBlob);
            resolve({ audioBlob, audioUrl, duration });
            return;
          } catch (e) {
            console.warn('Error creating audio blob from chunks:', e);
          }
        }
        finalizeSimulated();
      };

      // Fallback timer: ensure resolve is always triggered even if onstop hangs
      const timeoutId = setTimeout(handleDone, 700);

      this.mediaRecorder.onstop = () => {
        clearTimeout(timeoutId);
        handleDone();
      };

      this.mediaRecorder.onerror = () => {
        clearTimeout(timeoutId);
        handleDone();
      };

      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        } else {
          clearTimeout(timeoutId);
          handleDone();
        }
      } catch (err) {
        clearTimeout(timeoutId);
        handleDone();
      }
    });

    return this.stopPromise;
  }

  cancel(): void {
    this.isStopping = true;
    this.isStopped = true;
    this.cleanupAudioCtx();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    if (this.stream) {
      try {
        this.stream.getTracks().forEach((track) => track.stop());
      } catch {}
      this.stream = null;
    }
    this.audioChunks = [];
  }
}

/**
 * Real-time Open Mic (自由麦) Controller with Live Voice Activity Detection (VAD)
 */
export class OpenMicListener {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private isMuted: boolean = false;
  private isSpeaking: boolean = false;
  private silenceTimeout: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingStartTime: number = 0;

  public onVolume?: (vol: number) => void;
  public onSpeakingChange?: (speaking: boolean) => void;
  public onVoiceSnippet?: (audioUrl: string, duration: number) => void;

  async start(): Promise<boolean> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return false;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        const source = this.audioCtx.createMediaStreamSource(this.stream);
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);
        this.loop();
      }
      return true;
    } catch (err) {
      console.warn('OpenMic permission or device error:', err);
      return false;
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.stream) {
      this.stream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
    if (muted && this.isSpeaking) {
      this.isSpeaking = false;
      if (this.onSpeakingChange) this.onSpeakingChange(false);
    }
  }

  private loop() {
    if (!this.analyser || this.isMuted) {
      this.animFrameId = requestAnimationFrame(() => this.loop());
      return;
    }

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / dataArray.length;
    const normalizedVol = Math.min(100, Math.round((avg / 128) * 100));

    if (this.onVolume) {
      this.onVolume(normalizedVol);
    }

    // Voice Activity Detection (VAD) Threshold
    const SPEECH_THRESHOLD = 14;

    if (normalizedVol >= SPEECH_THRESHOLD) {
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        if (this.onSpeakingChange) this.onSpeakingChange(true);
        this.startSnippetRecord();
      }
      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = null;
      }
    } else if (this.isSpeaking && !this.silenceTimeout) {
      // 1.2 seconds of silence before finishing speech
      this.silenceTimeout = setTimeout(() => {
        this.isSpeaking = false;
        if (this.onSpeakingChange) this.onSpeakingChange(false);
        this.finishSnippetRecord();
        this.silenceTimeout = null;
      }, 1200);
    }

    this.animFrameId = requestAnimationFrame(() => this.loop());
  }

  private startSnippetRecord() {
    if (!this.stream) return;
    this.recordedChunks = [];
    this.recordingStartTime = Date.now();
    try {
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      }
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.recordedChunks.push(e.data);
      };
      this.mediaRecorder.start(100);
    } catch {}
  }

  private finishSnippetRecord() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return;
    try {
      this.mediaRecorder.onstop = () => {
        const duration = Math.max(1, Math.round((Date.now() - this.recordingStartTime) / 1000));
        if (duration >= 1 && this.recordedChunks.length > 0) {
          const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
          const url = URL.createObjectURL(blob);
          if (this.onVoiceSnippet) {
            this.onVoiceSnippet(url, duration);
          }
        }
      };
      this.mediaRecorder.stop();
    } catch {}
  }

  stop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
    this.isSpeaking = false;
  }
}

/**
 * Intelligent AI Opponent Chat Simulator
 * Gives computer players life by responding to user messages or game events!
 */
export function getAiReplyForMessage(
  userMsg: string,
  userMsgType: string,
  opponents: { id: string; name: string; avatar: string }[]
): { opponent: { id: string; name: string; avatar: string }; replyContent: string; replyType: 'quick' | 'text' | 'emoji' } | null {
  if (!opponents || opponents.length === 0) return null;

  // Pick a random opponent
  const opp = opponents[Math.floor(Math.random() * opponents.length)];

  if (userMsgType === 'emoji') {
    const matchingEmojis = ['😆', '🤣', '🔥', '👏', '🍻', '👍'];
    return {
      opponent: opp,
      replyContent: matchingEmojis[Math.floor(Math.random() * matchingEmojis.length)],
      replyType: 'emoji'
    };
  }

  if (userMsgType === 'voice') {
    const voiceResponses = [
      '收到！声音挺洪亮嘛~',
      '听见了，放马过来吧！',
      '大声点听不清哈哈，牌桌见分晓！',
      '好嘞，这把看我的！'
    ];
    return {
      opponent: opp,
      replyContent: voiceResponses[Math.floor(Math.random() * voiceResponses.length)],
      replyType: 'quick'
    };
  }

  // Contextual reply based on keywords
  if (userMsg.includes('快点') || userMsg.includes('墨迹') || userMsg.includes('时间')) {
    const replies = [
      '正在精雕细琢，马上就好！',
      '急啥嘛，好牌都要多想想~',
      '催什么催，心急吃不了热豆腐！',
      '来啦来啦，马上提交！'
    ];
    return { opponent: opp, replyContent: replies[Math.floor(replies.length * Math.random())], replyType: 'quick' };
  }

  if (userMsg.includes('牌面很大') || userMsg.includes('特殊牌型') || userMsg.includes('通杀')) {
    const replies = [
      '吹牛吧，看谁抓谁！',
      '别吓唬人，我这把也不小！',
      '天呐，难道真是大牌？有点慌！',
      '谁通杀还不一定呢，等会见真章！'
    ];
    return { opponent: opp, replyContent: replies[Math.floor(replies.length * Math.random())], replyType: 'quick' };
  }

  if (userMsg.includes('散牌') || userMsg.includes('手下留情') || userMsg.includes('手气太背')) {
    const replies = [
      '哈哈，虚虚实实，我才不上当！',
      '既然这样，那我可就不客气咯！',
      '我也一般般，同是天涯散牌人~',
      '别装了，肯定憋着大招呢！'
    ];
    return { opponent: opp, replyContent: replies[Math.floor(replies.length * Math.random())], replyType: 'quick' };
  }

  // Generic replies
  const genericReplies = [
    '这把鹿死谁手还不一定呢！',
    '来啊，正面硬碰硬！',
    '搏一搏，单车变摩托！',
    '打完看战报，看谁笑到最后！',
    '🍻 牌品如人品，开开心心玩！'
  ];

  return {
    opponent: opp,
    replyContent: genericReplies[Math.floor(genericReplies.length * Math.random())],
    replyType: 'quick'
  };
}
