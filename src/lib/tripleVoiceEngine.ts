/**
 * Triple Voice Transmission Architecture (三重语音传输架构)
 * Tier 1: WebRTC P2P 直连 (超低延迟 <50ms)
 * Tier 2: WebSocket 高速音频帧广播 (稳定毫秒级 ~100-150ms)
 * Tier 3: HTTP 轮询保底 (强穿透穿墙，沙箱/代理保底)
 */

import {
  playRadioChirpStart,
  playRadioChirpEnd,
  speakTextMessage,
  setRadioChirpSoundEnabled
} from './chatManager';
import { ChatMessage } from '../types';

export type TransmissionTier = 'webrtc' | 'websocket' | 'http';
export type TierPreference = 'auto' | 'webrtc' | 'websocket' | 'http';
export type VadSensitivity = 'low' | 'medium' | 'high';

export interface PeerVoiceState {
  userId: string;
  seatIndex: number;
  name: string;
  avatar: string;
  tier: TransmissionTier;
  isSpeaking: boolean;
  volume: number; // 0-100
  webrtcState: 'disconnected' | 'connecting' | 'connected' | 'failed';
  packetsReceived: number;
  lastActive: number;
}

export interface VoiceEngineStats {
  activeTier: TransmissionTier;
  tierPreference: TierPreference;
  latencyMs: number;
  packetsSent: number;
  packetsReceived: number;
  bytesSent: number;
  bytesReceived: number;
  wsConnected: boolean;
  httpPollingActive: boolean;
  webrtcPeersCount: number;
  totalPeersCount: number;
  isMicActive: boolean;
  isMuted: boolean;
  // Master Audio Preferences
  outputVolume: number; // 0.0 - 1.0 (default 1.0)
  isDeafened: boolean; // 静音所有接收语音 (default false)
  autoPlayVoice: boolean; // 收到对讲语音自动播放 (default true)
  radioChirpEnabled: boolean; // 对讲机无线电提示音 (default true)
  vadSensitivity: VadSensitivity; // 自由麦拾音灵敏度 (default 'medium')
}

export interface QuickVoicePhrase {
  phrase: string;
  category: string;
  icon: string;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export class TripleVoiceEngine {
  private static instance: TripleVoiceEngine | null = null;

  // Configuration
  private roomId: string = 'realtime_table_default';
  private userId: string = '';
  private userName: string = '玩家';
  private userAvatar: string = '😎';
  private userSeatIndex: number = 0;

  // State
  private tierPreference: TierPreference = 'auto';
  private activeTier: TransmissionTier = 'websocket';
  private isMicActive: boolean = false;
  private isMuted: boolean = false;
  private isSpeaking: boolean = false;
  private localVolume: number = 0;

  // Stats
  private latencyMs: number = 42;
  private packetsSent: number = 0;
  private packetsReceived: number = 0;
  private bytesSent: number = 0;
  private bytesReceived: number = 0;

  // WebRTC Peer Connections
  private peerConnections = new Map<string, RTCPeerConnection>();
  private remoteAudioElements = new Map<string, HTMLAudioElement>();
  private dataChannels = new Map<string, RTCDataChannel>();

  // WebSocket connection
  private ws: WebSocket | null = null;
  private wsConnected: boolean = false;
  private wsReconnectTimer: any = null;
  private pingIntervalTimer: any = null;

  // HTTP Polling fallback
  private httpPollingTimer: any = null;
  private lastPollTimestamp: number = Date.now();
  private isHttpPolling: boolean = false;
  private receivedChatIds = new Set<string>();

  // Audio Context & Recording
  private localStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vuAnimFrameId: number | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private vadSilenceTimeout: any = null;

  // Peer states
  private peers = new Map<string, PeerVoiceState>();

  // Master Audio Preferences (Persisted)
  private outputVolume: number = 1.0;
  private isDeafened: boolean = false;
  private autoPlayVoice: boolean = true;
  private radioChirpEnabled: boolean = true;
  private vadSensitivity: VadSensitivity = 'medium';

  // Event Callbacks
  public onStatsChange?: (stats: VoiceEngineStats) => void;
  public onPeersChange?: (peers: PeerVoiceState[]) => void;
  public onLocalVolumeChange?: (volume: number) => void;
  public onSpeakingChange?: (isSpeaking: boolean) => void;
  public onIncomingVoice?: (data: {
    id?: string;
    senderId: string;
    senderName: string;
    senderAvatar: string;
    seatIndex?: number;
    phrase?: string;
    audioUrl?: string;
    duration?: number;
    timestamp?: number;
    tier: TransmissionTier;
  }) => void;
  public onIncomingChatMessage?: (message: ChatMessage) => void;

  constructor() {
    this.loadSettings();
  }

  private loadSettings() {
    try {
      if (typeof window === 'undefined') return;
      const raw = localStorage.getItem('triple_voice_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.outputVolume === 'number') this.outputVolume = Math.max(0, Math.min(1, parsed.outputVolume));
        if (typeof parsed.isDeafened === 'boolean') this.isDeafened = parsed.isDeafened;
        if (typeof parsed.autoPlayVoice === 'boolean') this.autoPlayVoice = parsed.autoPlayVoice;
        if (typeof parsed.radioChirpEnabled === 'boolean') {
          this.radioChirpEnabled = parsed.radioChirpEnabled;
          setRadioChirpSoundEnabled(parsed.radioChirpEnabled);
        }
        if (parsed.vadSensitivity === 'low' || parsed.vadSensitivity === 'medium' || parsed.vadSensitivity === 'high') {
          this.vadSensitivity = parsed.vadSensitivity;
        }
        if (parsed.tierPreference) {
          this.tierPreference = parsed.tierPreference;
        }
      }
    } catch {}
  }

  private saveSettings() {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem('triple_voice_settings', JSON.stringify({
        outputVolume: this.outputVolume,
        isDeafened: this.isDeafened,
        autoPlayVoice: this.autoPlayVoice,
        radioChirpEnabled: this.radioChirpEnabled,
        vadSensitivity: this.vadSensitivity,
        tierPreference: this.tierPreference
      }));
    } catch {}
  }

  public static getInstance(): TripleVoiceEngine {
    if (!TripleVoiceEngine.instance) {
      TripleVoiceEngine.instance = new TripleVoiceEngine();
    }
    return TripleVoiceEngine.instance;
  }

  // Gracefully leave the voice room and clean up all connections
  public leave() {
    this.stopMicrophone();
    if (this.httpPollingTimer) {
      clearTimeout(this.httpPollingTimer);
      this.httpPollingTimer = null;
    }
    this.isHttpPolling = false;

    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'LEAVE_ROOM',
            roomId: this.roomId,
            userId: this.userId
          }));
        }
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.wsConnected = false;

    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }

    if (this.pingIntervalTimer) {
      clearInterval(this.pingIntervalTimer);
      this.pingIntervalTimer = null;
    }

    // Close WebRTC connections
    for (const pc of this.peerConnections.values()) {
      try {
        pc.close();
      } catch {}
    }
    this.peerConnections.clear();
    this.remoteAudioElements.clear();
    this.dataChannels.clear();
    this.peers.clear();

    this.isSpeaking = false;
    this.isMicActive = false;
    this.localVolume = 0;
    this.notifyStats();
  }

  // 1. Initialize Engine
  public init(config: {
    roomId: string;
    userId: string;
    name: string;
    avatar: string;
    seatIndex: number;
  }) {
    this.roomId = config.roomId || 'realtime_table_default';
    this.userId = config.userId;
    this.userName = config.name;
    this.userAvatar = config.avatar;
    this.userSeatIndex = config.seatIndex;

    // Connect WebSocket
    this.connectWebSocket();

    // Start HTTP polling safeguard (auto-engages if WS drops)
    this.startHttpPolling();

    this.notifyStats();
  }

  // 2. Set transmission tier preference
  public setTierPreference(pref: TierPreference) {
    this.tierPreference = pref;
    this.evaluateActiveTier();
    this.notifyStats();
  }

  public getStats(): VoiceEngineStats {
    return {
      activeTier: this.activeTier,
      tierPreference: this.tierPreference,
      latencyMs: this.latencyMs,
      packetsSent: this.packetsSent,
      packetsReceived: this.packetsReceived,
      bytesSent: this.bytesSent,
      bytesReceived: this.bytesReceived,
      wsConnected: this.wsConnected,
      httpPollingActive: this.isHttpPolling,
      webrtcPeersCount: Array.from(this.peerConnections.values()).filter(
        pc => pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed'
      ).length,
      totalPeersCount: this.peers.size,
      isMicActive: this.isMicActive,
      isMuted: this.isMuted,
      outputVolume: this.outputVolume,
      isDeafened: this.isDeafened,
      autoPlayVoice: this.autoPlayVoice,
      radioChirpEnabled: this.radioChirpEnabled,
      vadSensitivity: this.vadSensitivity
    };
  }

  public getPeers(): PeerVoiceState[] {
    return Array.from(this.peers.values());
  }

  // -------------------------------------------------------------
  // Master Voice Audio Output & Privacy Controls
  // -------------------------------------------------------------

  public setOutputVolume(vol: number) {
    this.outputVolume = Math.max(0, Math.min(1, vol));
    this.saveSettings();
    this.notifyStats();
  }

  public getOutputVolume(): number {
    return this.outputVolume;
  }

  public setDeafened(deafened: boolean) {
    this.isDeafened = deafened;
    this.saveSettings();
    this.notifyStats();
  }

  public isUserDeafened(): boolean {
    return this.isDeafened;
  }

  public toggleDeafened(): boolean {
    this.isDeafened = !this.isDeafened;
    this.saveSettings();
    this.notifyStats();
    return this.isDeafened;
  }

  public setAutoPlayVoice(autoPlay: boolean) {
    this.autoPlayVoice = autoPlay;
    this.saveSettings();
    this.notifyStats();
  }

  public getAutoPlayVoice(): boolean {
    return this.autoPlayVoice;
  }

  public setRadioChirpEnabled(enabled: boolean) {
    this.radioChirpEnabled = enabled;
    setRadioChirpSoundEnabled(enabled);
    this.saveSettings();
    this.notifyStats();
  }

  public getRadioChirpEnabled(): boolean {
    return this.radioChirpEnabled;
  }

  public setVadSensitivity(sens: VadSensitivity) {
    this.vadSensitivity = sens;
    this.saveSettings();
    this.notifyStats();
  }

  public getVadSensitivity(): VadSensitivity {
    return this.vadSensitivity;
  }

  // -------------------------------------------------------------
  // Microphone & Audio Capture
  // -------------------------------------------------------------

  public async startMicrophone(): Promise<boolean> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return false;
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.isMicActive = true;
      this.isMuted = false;

      // Attach audio track to all active WebRTC peer connections
      this.attachLocalStreamToPeers();

      // Initialize AudioContext & Analyser for VU Meter and VAD
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
        const source = this.audioCtx.createMediaStreamSource(this.localStream);
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);
        this.startVUMonitor();
      }

      this.notifyStats();
      return true;
    } catch (err) {
      console.warn('[TripleVoice] Mic access error:', err);
      this.isMicActive = false;
      this.notifyStats();
      return false;
    }
  }

  public stopMicrophone() {
    this.isMicActive = false;
    this.isSpeaking = false;
    if (this.onSpeakingChange) this.onSpeakingChange(false);
    this.broadcastVoiceActivity(false, 0);

    if (this.vuAnimFrameId) {
      cancelAnimationFrame(this.vuAnimFrameId);
      this.vuAnimFrameId = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }

    this.notifyStats();
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => {
        t.enabled = !this.isMuted;
      });
    }

    if (this.isMuted && this.isSpeaking) {
      this.isSpeaking = false;
      if (this.onSpeakingChange) this.onSpeakingChange(false);
      this.broadcastVoiceActivity(false, 0);
    }

    this.notifyStats();
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => {
        t.enabled = !muted;
      });
    }
    if (muted && this.isSpeaking) {
      this.isSpeaking = false;
      if (this.onSpeakingChange) this.onSpeakingChange(false);
      this.broadcastVoiceActivity(false, 0);
    }
    this.notifyStats();
  }

  // Real-time VU Monitor & VAD
  private startVUMonitor() {
    const check = () => {
      if (!this.analyser || !this.isMicActive || this.isMuted) {
        this.vuAnimFrameId = requestAnimationFrame(check);
        return;
      }

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const vol = Math.min(100, Math.round((avg / 128) * 100));
      this.localVolume = vol;

      if (this.onLocalVolumeChange) {
        this.onLocalVolumeChange(vol);
      }

      // Voice Activity Detection (VAD)
      const thresholdMap: Record<VadSensitivity, number> = {
        low: 26,
        medium: 15,
        high: 8
      };
      const SPEECH_THRESHOLD = thresholdMap[this.vadSensitivity] || 15;
      if (vol >= SPEECH_THRESHOLD) {
        if (!this.isSpeaking) {
          this.isSpeaking = true;
          if (this.onSpeakingChange) this.onSpeakingChange(true);
          this.broadcastVoiceActivity(true, vol);
          this.startChunkRecording();
        }
        if (this.vadSilenceTimeout) {
          clearTimeout(this.vadSilenceTimeout);
          this.vadSilenceTimeout = null;
        }
      } else if (this.isSpeaking && !this.vadSilenceTimeout) {
        this.vadSilenceTimeout = setTimeout(() => {
          this.isSpeaking = false;
          if (this.onSpeakingChange) this.onSpeakingChange(false);
          this.broadcastVoiceActivity(false, 0);
          this.stopChunkRecordingAndSend();
          this.vadSilenceTimeout = null;
        }, 800);
      }

      this.vuAnimFrameId = requestAnimationFrame(check);
    };

    this.vuAnimFrameId = requestAnimationFrame(check);
  }

  // -------------------------------------------------------------
  // Audio Chunk Slicing for Tier 2 (WebSocket) & Tier 3 (HTTP)
  // -------------------------------------------------------------

  private startChunkRecording() {
    if (!this.localStream) return;
    this.recordedChunks = [];
    try {
      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
        this.mediaRecorder = new MediaRecorder(this.localStream, { mimeType });
        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            this.recordedChunks.push(e.data);
          }
        };
        this.mediaRecorder.start(150); // 150ms slices
      }
    } catch (e) {
      console.warn('[TripleVoice] MediaRecorder start note:', e);
    }
  }

  private stopChunkRecordingAndSend() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return;
    try {
      this.mediaRecorder.onstop = async () => {
        if (this.recordedChunks.length === 0) return;
        const blob = new Blob(this.recordedChunks, {
          type: this.mediaRecorder?.mimeType || 'audio/webm'
        });
        this.recordedChunks = [];
        await this.dispatchVoiceBlob(blob);
      };
      this.mediaRecorder.stop();
    } catch {}
  }

  /**
   * Dispatch voice recording through current active tier (Tier 1 DataChannel / Tier 2 WS / Tier 3 HTTP)
   */
  public async dispatchVoiceBlob(blob: Blob, durationSec: number = 1.5) {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      if (!base64Data) return;

      this.bytesSent += blob.size;
      this.packetsSent += 1;

      // Tier 1: Try WebRTC DataChannels if connected
      let sentViaP2P = false;
      if (this.activeTier === 'webrtc') {
        const payload = JSON.stringify({
          type: 'VOICE_FRAME',
          senderId: this.userId,
          senderName: this.userName,
          senderAvatar: this.userAvatar,
          seatIndex: this.userSeatIndex,
          audioData: base64Data,
          duration: durationSec
        });

        this.dataChannels.forEach(dc => {
          if (dc.readyState === 'open') {
            try {
              dc.send(payload);
              sentViaP2P = true;
            } catch {}
          }
        });
      }

      // Tier 2: WebSocket High-Speed Audio Broadcast
      if ((!sentViaP2P && this.wsConnected) || this.activeTier === 'websocket') {
        this.sendWsMessage({
          type: 'VOICE_FRAME',
          audioData: base64Data,
          duration: durationSec,
          mimeType: blob.type
        });
      } else if (!sentViaP2P && !this.wsConnected) {
        // Tier 3: HTTP Polling Fallback
        this.sendViaHttpFallback({
          type: 'voice_frame',
          audioData: base64Data,
          duration: durationSec
        });
      }

      this.notifyStats();
    };
    reader.readAsDataURL(blob);
  }

  // -------------------------------------------------------------
  // 常用语音播报 (Quick Tactical Voice Broadcasts)
  // -------------------------------------------------------------

  public sendVoicePhrase(phrase: string, category: string = '战术播报', icon: string = '📢') {
    if (this.radioChirpEnabled) {
      playRadioChirpStart();
    }
    this.packetsSent += 1;

    // Local trigger
    if (this.onIncomingVoice) {
      this.onIncomingVoice({
        senderId: this.userId,
        senderName: this.userName,
        senderAvatar: this.userAvatar,
        seatIndex: this.userSeatIndex,
        phrase,
        tier: this.activeTier
      });
    }

    // 1. Send via WebRTC DataChannels if P2P active
    let sentP2P = false;
    if (this.activeTier === 'webrtc') {
      const payload = JSON.stringify({
        type: 'VOICE_PHRASE',
        senderId: this.userId,
        senderName: this.userName,
        senderAvatar: this.userAvatar,
        seatIndex: this.userSeatIndex,
        phrase,
        category,
        icon
      });
      this.dataChannels.forEach(dc => {
        if (dc.readyState === 'open') {
          try {
            dc.send(payload);
            sentP2P = true;
          } catch {}
        }
      });
    }

    // 2. Send via WebSocket if connected
    if (this.wsConnected) {
      this.sendWsMessage({
        type: 'VOICE_PHRASE',
        phrase,
        category,
        icon
      });
    } else if (!sentP2P) {
      // 3. Send via HTTP Polling fallback
      this.sendViaHttpFallback({
        type: 'phrase',
        phrase
      });
    }

    this.notifyStats();
  }

  public sendChatMessage(msg: ChatMessage) {
    this.packetsSent += 1;

    // 1. Send via WebRTC DataChannels if P2P active
    let sentP2P = false;
    if (this.activeTier === 'webrtc') {
      const payload = JSON.stringify({
        type: 'CHAT_MESSAGE',
        message: msg
      });
      this.dataChannels.forEach(dc => {
        if (dc.readyState === 'open') {
          try {
            dc.send(payload);
            sentP2P = true;
          } catch {}
        }
      });
    }

    // 2. Send via WebSocket if connected
    if (this.wsConnected) {
      this.sendWsMessage({
        type: 'CHAT_MESSAGE',
        message: msg
      });
    }

    // 3. Guarantee via HTTP backend
    try {
      fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: this.roomId,
          message: msg
        })
      }).catch(() => {});
    } catch {}

    this.notifyStats();
  }

  // -------------------------------------------------------------
  // Tier 1: WebRTC P2P Mesh Implementation
  // -------------------------------------------------------------

  private createPeerConnection(peerId: string): RTCPeerConnection {
    if (this.peerConnections.has(peerId)) {
      return this.peerConnections.get(peerId)!;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnections.set(peerId, pc);

    // Attach local stream if available
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Remote audio track received
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        let audioEl = this.remoteAudioElements.get(peerId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          this.remoteAudioElements.set(peerId, audioEl);
        }
        audioEl.srcObject = event.streams[0];
        audioEl.play().catch(() => {});

        // Update peer tier to WebRTC
        const p = this.peers.get(peerId);
        if (p) {
          p.tier = 'webrtc';
          p.webrtcState = 'connected';
          this.notifyPeers();
        }
        this.evaluateActiveTier();
      }
    };

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(peerId, 'ice', event.candidate);
      }
    };

    // Connection state changes
    pc.oniceconnectionstatechange = () => {
      const p = this.peers.get(peerId);
      if (p) {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          p.webrtcState = 'connected';
          p.tier = 'webrtc';
        } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          p.webrtcState = 'failed';
          p.tier = this.wsConnected ? 'websocket' : 'http';
        } else {
          p.webrtcState = 'connecting';
        }
        this.notifyPeers();
      }
      this.evaluateActiveTier();
    };

    // Create DataChannel for fast binary & text voice frames
    try {
      const dc = pc.createDataChannel('voice_channel');
      this.setupDataChannel(peerId, dc);
    } catch {}

    pc.ondatachannel = (e) => {
      this.setupDataChannel(peerId, e.channel);
    };

    return pc;
  }

  private setupDataChannel(peerId: string, dc: RTCDataChannel) {
    this.dataChannels.set(peerId, dc);

    dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'VOICE_FRAME' && msg.audioData) {
          this.playReceivedAudio(msg.audioData);
          this.packetsReceived += 1;
          const p = this.peers.get(peerId);
          if (p) {
            p.packetsReceived += 1;
            p.lastActive = Date.now();
          }
          if (this.onIncomingVoice) {
            this.onIncomingVoice({
              senderId: msg.senderId || peerId,
              senderName: msg.senderName || '牌友',
              senderAvatar: msg.senderAvatar || '😎',
              seatIndex: msg.seatIndex,
              audioUrl: msg.audioData,
              tier: 'webrtc'
            });
          }
        } else if (msg.type === 'VOICE_PHRASE' && msg.phrase) {
          this.handleIncomingPhrase(msg, 'webrtc');
        } else if (msg.type === 'CHAT_MESSAGE' && msg.message) {
          this.handleIncomingChatMessage(msg.message, 'webrtc');
        }
      } catch {}
    };

    dc.onopen = () => {
      this.evaluateActiveTier();
    };
  }

  private attachLocalStreamToPeers() {
    if (!this.localStream) return;
    this.peerConnections.forEach((pc) => {
      const senders = pc.getSenders();
      this.localStream!.getAudioTracks().forEach(track => {
        const existing = senders.find(s => s.track?.kind === 'audio');
        if (existing) {
          existing.replaceTrack(track);
        } else {
          pc.addTrack(track, this.localStream!);
        }
      });
    });
  }

  private async initiateWebRtcOffer(peerId: string) {
    try {
      const pc = this.createPeerConnection(peerId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true
      });
      await pc.setLocalDescription(offer);
      this.sendSignal(peerId, 'offer', offer);
    } catch (e) {
      console.warn('[TripleVoice] WebRTC offer failed:', e);
    }
  }

  private async handleWebRtcSignal(signal: any) {
    const { senderId, signalType, data } = signal;
    if (!senderId || senderId === this.userId) return;

    let pc = this.peerConnections.get(senderId);
    if (!pc) {
      pc = this.createPeerConnection(senderId);
    }

    try {
      if (signalType === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendSignal(senderId, 'answer', answer);
      } else if (signalType === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
      } else if (signalType === 'ice' && data) {
        await pc.addIceCandidate(new RTCIceCandidate(data));
      }
    } catch (err) {
      console.warn('[TripleVoice] Signal handling error:', err);
    }
  }

  private sendSignal(targetId: string, signalType: 'offer' | 'answer' | 'ice', data: any) {
    if (this.wsConnected) {
      this.sendWsMessage({
        type: 'WEBRTC_SIGNAL',
        targetUserId: targetId,
        signalType,
        data
      });
    } else {
      // Fallback: Send signal via HTTP
      fetch('/api/voice/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: this.roomId,
          senderId: this.userId,
          targetId,
          signalType,
          data
        })
      }).catch(() => {});
    }
  }

  // -------------------------------------------------------------
  // Tier 2: WebSocket High-Speed Audio Broadcast
  // -------------------------------------------------------------

  private connectWebSocket() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.wsConnected = true;
        this.evaluateActiveTier();
        this.notifyStats();

        // Register in voice room
        this.sendWsMessage({
          type: 'JOIN_ROOM',
          roomId: this.roomId,
          userId: this.userId,
          name: this.userName,
          avatar: this.userAvatar,
          seatIndex: this.userSeatIndex
        });

        // Start ping heartbeat
        this.startPingHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleWsMessage(msg);
        } catch {}
      };

      this.ws.onclose = () => {
        this.wsConnected = false;
        this.evaluateActiveTier();
        this.notifyStats();
        this.scheduleWsReconnect();
      };

      this.ws.onerror = () => {
        this.wsConnected = false;
        this.evaluateActiveTier();
        this.notifyStats();
      };
    } catch {
      this.wsConnected = false;
      this.evaluateActiveTier();
      this.scheduleWsReconnect();
    }
  }

  private scheduleWsReconnect() {
    if (this.wsReconnectTimer) return;
    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectTimer = null;
      this.connectWebSocket();
    }, 2500);
  }

  private startPingHeartbeat() {
    if (this.pingIntervalTimer) clearInterval(this.pingIntervalTimer);
    this.pingIntervalTimer = setInterval(() => {
      if (this.wsConnected) {
        this.sendWsMessage({ type: 'PING', timestamp: Date.now() });
      }
    }, 3000);
  }

  private sendWsMessage(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch {}
    }
  }

  private handleWsMessage(msg: any) {
    switch (msg.type) {
      case 'ROOM_JOINED': {
        if (Array.isArray(msg.peers)) {
          msg.peers.forEach((p: any) => {
            this.addOrUpdatePeer(p);
            // Initiate WebRTC connection to existing peers
            setTimeout(() => {
              this.initiateWebRtcOffer(p.userId);
            }, 300);
          });
        }
        break;
      }

      case 'PEER_JOINED': {
        if (msg.peer) {
          this.addOrUpdatePeer(msg.peer);
        }
        break;
      }

      case 'PEER_LEFT': {
        this.removePeer(msg.userId);
        break;
      }

      case 'WEBRTC_SIGNAL': {
        if (msg.signal) {
          this.handleWebRtcSignal(msg.signal);
        }
        break;
      }

      case 'VOICE_FRAME_INCOMING': {
        const rec = msg.record;
        if (rec && rec.senderId !== this.userId && rec.audioData) {
          this.packetsReceived += 1;
          this.playReceivedAudio(rec.audioData);

          const p = this.peers.get(rec.senderId);
          if (p) {
            p.packetsReceived += 1;
            p.lastActive = Date.now();
            p.isSpeaking = true;
            this.notifyPeers();
            setTimeout(() => {
              p.isSpeaking = false;
              this.notifyPeers();
            }, (rec.duration || 1.5) * 1000);
          }

          if (this.onIncomingVoice) {
            this.onIncomingVoice({
              id: rec.id || ('voice_ws_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
              senderId: rec.senderId,
              senderName: rec.senderName || '牌友',
              senderAvatar: rec.senderAvatar || '😎',
              seatIndex: rec.seatIndex,
              audioUrl: rec.audioData,
              duration: rec.duration || 2,
              timestamp: rec.timestamp || Date.now(),
              tier: 'websocket'
            });
          }
        }
        break;
      }

      case 'VOICE_PHRASE_INCOMING': {
        this.handleIncomingPhrase(msg, 'websocket');
        break;
      }

      case 'CHAT_MESSAGE_INCOMING': {
        if (msg.message) {
          this.handleIncomingChatMessage(msg.message, 'websocket');
        }
        break;
      }

      case 'PEER_VOICE_ACTIVITY': {
        const { userId, isSpeaking, volume, activeTier } = msg;
        const p = this.peers.get(userId);
        if (p) {
          p.isSpeaking = isSpeaking;
          p.volume = volume;
          if (activeTier) p.tier = activeTier;
          this.notifyPeers();
        }
        break;
      }

      case 'PONG': {
        if (msg.clientTimestamp) {
          this.latencyMs = Math.max(12, Math.round(Date.now() - msg.clientTimestamp));
          this.notifyStats();
        }
        break;
      }
    }
  }

  private broadcastVoiceActivity(isSpeaking: boolean, volume: number) {
    if (this.wsConnected) {
      this.sendWsMessage({
        type: 'VOICE_ACTIVITY',
        isSpeaking,
        volume,
        activeTier: this.activeTier
      });
    }
  }

  // -------------------------------------------------------------
  // Tier 3: HTTP Polling Fallback Implementation
  // -------------------------------------------------------------

  private startHttpPolling() {
    if (this.httpPollingTimer) return;
    this.isHttpPolling = true;

    const poll = async () => {
      // Only poll when WebSocket is down or when testing HTTP mode
      if (!this.wsConnected || this.tierPreference === 'http') {
        try {
          const res = await fetch(
            `/api/voice/poll?roomId=${encodeURIComponent(this.roomId)}&userId=${encodeURIComponent(this.userId)}&since=${this.lastPollTimestamp}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.ok && Array.isArray(data.frames)) {
              this.lastPollTimestamp = data.timestamp || Date.now();
              data.frames.forEach((f: any) => {
                if (f.senderId !== this.userId) {
                  if (f.type === 'voice_frame' && f.audioData) {
                    this.playReceivedAudio(f.audioData);
                    if (this.onIncomingVoice) {
                      this.onIncomingVoice({
                        id: f.id || ('voice_http_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
                        senderId: f.senderId,
                        senderName: f.senderName,
                        senderAvatar: f.senderAvatar,
                        seatIndex: f.seatIndex,
                        audioUrl: f.audioData,
                        duration: f.duration || 2,
                        timestamp: f.timestamp || Date.now(),
                        tier: 'http'
                      });
                    }
                  } else if (f.type === 'phrase' && f.phrase) {
                    this.handleIncomingPhrase(f, 'http');
                  }
                }
              });
            }
          }
        } catch {}

        // Poll for pending WebRTC signals
        try {
          const sigRes = await fetch(
            `/api/voice/signal/poll?roomId=${encodeURIComponent(this.roomId)}&userId=${encodeURIComponent(this.userId)}&since=${this.lastPollTimestamp - 5000}`
          );
          if (sigRes.ok) {
            const sigData = await sigRes.json();
            if (sigData.ok && Array.isArray(sigData.signals)) {
              sigData.signals.forEach((s: any) => {
                this.handleWebRtcSignal(s);
              });
            }
          }
        } catch {}

        // Poll for real-time chat messages (Tier 3 HTTP fallback)
        try {
          const chatRes = await fetch(
            `/api/chat/poll?roomId=${encodeURIComponent(this.roomId)}&userId=${encodeURIComponent(this.userId)}&since=${this.lastPollTimestamp - 5000}`
          );
          if (chatRes.ok) {
            const chatData = await chatRes.json();
            if (chatData.ok && Array.isArray(chatData.messages)) {
              chatData.messages.forEach((m: any) => {
                this.handleIncomingChatMessage(m, 'http');
              });
            }
          }
        } catch {}
      }

      this.httpPollingTimer = setTimeout(poll, 850);
    };

    this.httpPollingTimer = setTimeout(poll, 1000);
  }

  private async sendViaHttpFallback(payload: any) {
    try {
      await fetch('/api/voice/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: this.roomId,
          senderId: this.userId,
          senderName: this.userName,
          senderAvatar: this.userAvatar,
          seatIndex: this.userSeatIndex,
          ...payload
        })
      });
    } catch (e) {
      console.warn('[TripleVoice] HTTP send error:', e);
    }
  }

  // -------------------------------------------------------------
  // Helpers & Audio Output
  // -------------------------------------------------------------

  private handleIncomingPhrase(msg: any, tier: TransmissionTier) {
    const phrase = msg.phrase || msg.record?.phrase;
    const senderName = msg.senderName || msg.record?.senderName || '牌友';
    const senderAvatar = msg.senderAvatar || msg.record?.senderAvatar || '😎';
    const seatIndex = msg.seatIndex || msg.record?.seatIndex;
    const senderId = msg.senderId || msg.record?.senderId;

    if (!phrase) return;

    if (!this.isDeafened) {
      speakTextMessage(phrase);
    }

    const p = this.peers.get(senderId);
    if (p) {
      p.isSpeaking = true;
      p.tier = tier;
      this.notifyPeers();
      setTimeout(() => {
        p.isSpeaking = false;
        this.notifyPeers();
      }, 2000);
    }

    if (this.onIncomingVoice) {
      this.onIncomingVoice({
        id: msg.id || ('phrase_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
        senderId,
        senderName,
        senderAvatar,
        seatIndex,
        phrase,
        duration: 2,
        timestamp: Date.now(),
        tier
      });
    }
  }

  private handleIncomingChatMessage(msg: any, tier: TransmissionTier) {
    if (!msg || msg.senderId === this.userId) return;

    const msgId = msg.id || ('chat_' + (msg.timestamp || Date.now()) + '_' + msg.senderId);
    if (this.receivedChatIds.has(msgId)) return;
    this.receivedChatIds.add(msgId);
    if (this.receivedChatIds.size > 200) {
      const first = this.receivedChatIds.values().next().value;
      if (first) this.receivedChatIds.delete(first);
    }

    const senderId = msg.senderId;
    const seatIndex = msg.seatIndex;

    // Trigger peer visual presence
    const p = this.peers.get(senderId);
    if (p) {
      p.isSpeaking = true;
      p.tier = tier;
      this.notifyPeers();
      setTimeout(() => {
        p.isSpeaking = false;
        this.notifyPeers();
      }, msg.type === 'voice' ? Math.max(1500, (msg.audioDuration || 2) * 1000) : 2500);
    }

    // Audio playback for voice or speech for quick tactical phrase
    if (!this.isDeafened) {
      if (msg.type === 'voice' && msg.audioUrl) {
        this.playReceivedAudio(msg.audioUrl);
      } else if (msg.type === 'quick' && msg.content) {
        if (this.radioChirpEnabled) playRadioChirpStart();
        speakTextMessage(msg.content);
        if (this.radioChirpEnabled) setTimeout(() => playRadioChirpEnd(), 1400);
      }
    }

    const normalizedMsg: ChatMessage = {
      id: msgId,
      senderId: msg.senderId,
      senderName: msg.senderName || '牌友',
      senderAvatar: msg.senderAvatar || '😎',
      isUser: msg.senderId === this.userId,
      type: msg.type || 'text',
      content: msg.content || '',
      audioUrl: msg.audioUrl,
      audioDuration: msg.audioDuration,
      timestamp: msg.timestamp || Date.now(),
      seatIndex: msg.seatIndex,
      isDealer: msg.isDealer
    };

    if (this.onIncomingChatMessage) {
      this.onIncomingChatMessage(normalizedMsg);
    }

    // Backward compatibility for existing onIncomingVoice listeners
    if (this.onIncomingVoice && (msg.type === 'voice' || msg.type === 'quick')) {
      this.onIncomingVoice({
        id: normalizedMsg.id,
        senderId: normalizedMsg.senderId,
        senderName: normalizedMsg.senderName,
        senderAvatar: normalizedMsg.senderAvatar,
        seatIndex: normalizedMsg.seatIndex,
        phrase: msg.type === 'quick' ? normalizedMsg.content : undefined,
        audioUrl: normalizedMsg.audioUrl,
        duration: normalizedMsg.audioDuration || 2,
        timestamp: normalizedMsg.timestamp,
        tier
      });
    }
  }

  private playReceivedAudio(audioSrc: string) {
    if (this.isDeafened) return;
    if (!this.autoPlayVoice) return;
    try {
      const audio = new Audio(audioSrc);
      audio.volume = Math.max(0, Math.min(1, this.outputVolume));
      audio.play().catch(() => {});
    } catch {}
  }

  private addOrUpdatePeer(peerInfo: any) {
    if (peerInfo.userId === this.userId) return;

    const existing = this.peers.get(peerInfo.userId);
    if (existing) {
      existing.name = peerInfo.name || existing.name;
      existing.avatar = peerInfo.avatar || existing.avatar;
      existing.seatIndex = peerInfo.seatIndex ?? existing.seatIndex;
    } else {
      this.peers.set(peerInfo.userId, {
        userId: peerInfo.userId,
        seatIndex: peerInfo.seatIndex ?? 0,
        name: peerInfo.name || '牌友',
        avatar: peerInfo.avatar || '😎',
        tier: this.wsConnected ? 'websocket' : 'http',
        isSpeaking: false,
        volume: 0,
        webrtcState: 'disconnected',
        packetsReceived: 0,
        lastActive: Date.now()
      });
    }

    this.notifyPeers();
    this.evaluateActiveTier();
  }

  private removePeer(peerId: string) {
    this.peers.delete(peerId);
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    this.dataChannels.delete(peerId);
    const audioEl = this.remoteAudioElements.get(peerId);
    if (audioEl) {
      audioEl.pause();
      audioEl.srcObject = null;
      this.remoteAudioElements.delete(peerId);
    }
    this.notifyPeers();
    this.evaluateActiveTier();
  }

  private evaluateActiveTier() {
    if (this.tierPreference !== 'auto') {
      this.activeTier = this.tierPreference;
      return;
    }

    // Auto-selection rule:
    // 1. If any WebRTC peer connection is established -> WebRTC P2P
    const hasWebRtc = Array.from(this.peerConnections.values()).some(
      pc => pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed'
    );
    if (hasWebRtc) {
      this.activeTier = 'webrtc';
      return;
    }

    // 2. If WebSocket is connected -> WebSocket High-Speed Broadcast
    if (this.wsConnected) {
      this.activeTier = 'websocket';
      return;
    }

    // 3. Otherwise -> HTTP Polling Fallback
    this.activeTier = 'http';
  }

  private notifyStats() {
    if (this.onStatsChange) {
      this.onStatsChange(this.getStats());
    }
  }

  private notifyPeers() {
    if (this.onPeersChange) {
      this.onPeersChange(this.getPeers());
    }
  }

  // Cleanup on unmount
  public destroy() {
    this.stopMicrophone();
    if (this.pingIntervalTimer) clearInterval(this.pingIntervalTimer);
    if (this.wsReconnectTimer) clearTimeout(this.wsReconnectTimer);
    if (this.httpPollingTimer) clearTimeout(this.httpPollingTimer);

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    this.dataChannels.clear();
    this.remoteAudioElements.clear();
    this.peers.clear();
  }
}
