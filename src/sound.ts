// Web Audio API Synthesizer for Thirteen Water game sound effects

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Lazy init
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // 发牌音效
  public playDeal() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  // 选牌 / 放牌音效
  public playCardPick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(580, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(720, this.ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  // 一键理牌成功
  public playAutoArrange() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.05);

      gain.gain.setValueAtTime(0.12, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.12);
    });
  }

  // 倒水 / 错误提示音
  public playError() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, this.ctx.currentTime);
    osc.frequency.setValueAtTime(120, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  // 打枪音效 (Gun Shot)
  public playGunShot() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.25);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
  }

  // 翻牌音效
  public playCardFlip() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  // 墩位互换
  public playSwap() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(650, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  // 单墩获胜
  public playDunWin() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, this.ctx.currentTime); // E5
    osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.06); // A5

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  // 全垒打宏大号角
  public playHomeRun() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const chords = [
      [523.25, 659.25, 783.99],
      [587.33, 739.99, 880.00],
      [659.25, 830.61, 987.77],
      [1046.50, 1318.51, 1567.98]
    ];

    let t = this.ctx.currentTime;
    chords.forEach((chord, step) => {
      const dur = step === 3 ? 0.6 : 0.15;
      chord.forEach(freq => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(t);
        osc.stop(t + dur);
      });
      t += dur * 0.9;
    });
  }

  // 胜利号角
  public playVictory() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const notes = [
      { freq: 523.25, duration: 0.12 }, // C5
      { freq: 659.25, duration: 0.12 }, // E5
      { freq: 783.99, duration: 0.15 }, // G5
      { freq: 1046.5, duration: 0.35 }  // C6
    ];

    let t = this.ctx.currentTime;
    notes.forEach(n => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.freq, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + n.duration);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(t);
      osc.stop(t + n.duration);
      t += n.duration * 0.9;
    });
  }

  // 逼真洗牌音效 (High-Fidelity Riffle Shuffle)
  public playShuffle() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // 1. Riffle clicks - more dynamic frequency and pitch variation
    const numClicks = 32;
    for (let i = 0; i < numClicks; i++) {
      // Accelerate towards the middle, slow down at the end
      const clickTime = now + (i * 0.02) + (Math.sin(i * 0.1) * 0.005);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Sharp percussive transient
      osc.type = 'square';
      osc.frequency.setValueAtTime(800 + Math.random() * 300, clickTime);
      osc.frequency.exponentialRampToValueAtTime(150, clickTime + 0.015);

      gain.gain.setValueAtTime(0.08, clickTime);
      gain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.015);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(clickTime);
      osc.stop(clickTime + 0.015);
    }

    // 2. Friction noise during the riffle
    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.6);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1);
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2500, now);
      filter.frequency.linearRampToValueAtTime(1200, now + 0.6);
      filter.Q.setValueAtTime(1.5, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(0.06, now + 0.2);
      noiseGain.gain.linearRampToValueAtTime(0.06, now + 0.5);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.65);
    } catch {
      // Audio buffer fallback
    }

    // 3. Bridge Snap (Cards pushing together)
    const snapTime = now + 0.75;
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    
    snapOsc.type = 'sawtooth';
    snapOsc.frequency.setValueAtTime(300, snapTime);
    snapOsc.frequency.exponentialRampToValueAtTime(80, snapTime + 0.15);
    
    snapGain.gain.setValueAtTime(0.18, snapTime);
    snapGain.gain.exponentialRampToValueAtTime(0.001, snapTime + 0.15);
    
    snapOsc.connect(snapGain);
    snapGain.connect(this.ctx.destination);
    snapOsc.start(snapTime);
    snapOsc.stop(snapTime + 0.15);
  }

  // 逼真切牌音效 (Cut Deck - Split + Slide + Table Thud)
  public playCut() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // 1. Lift and Slide (Packet lift friction)
    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.15);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
      
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1200, now);
      
      const gainSlide = this.ctx.createGain();
      gainSlide.gain.setValueAtTime(0.05, now);
      gainSlide.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      
      noise.connect(filter);
      filter.connect(gainSlide);
      gainSlide.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.15);
    } catch {
      // fallback
    }

    // 2. Table Thud (Heavy low frequency impact)
    const thudTime = now + 0.2;
    const oscThud = this.ctx.createOscillator();
    const gainThud = this.ctx.createGain();
    
    oscThud.type = 'sine';
    oscThud.frequency.setValueAtTime(140, thudTime);
    oscThud.frequency.exponentialRampToValueAtTime(40, thudTime + 0.1);
    
    gainThud.gain.setValueAtTime(0.4, thudTime);
    gainThud.gain.exponentialRampToValueAtTime(0.001, thudTime + 0.15);
    
    oscThud.connect(gainThud);
    gainThud.connect(this.ctx.destination);
    oscThud.start(thudTime);
    oscThud.stop(thudTime + 0.15);

    // 3. Deck Snap (Top packet hits the bottom packet)
    const snapTime = now + 0.35;
    const oscSnap = this.ctx.createOscillator();
    const gainSnap = this.ctx.createGain();
    
    oscSnap.type = 'triangle';
    oscSnap.frequency.setValueAtTime(800, snapTime);
    oscSnap.frequency.exponentialRampToValueAtTime(150, snapTime + 0.08);
    
    gainSnap.gain.setValueAtTime(0.2, snapTime);
    gainSnap.gain.exponentialRampToValueAtTime(0.001, snapTime + 0.08);
    
    oscSnap.connect(gainSnap);
    gainSnap.connect(this.ctx.destination);
    oscSnap.start(snapTime);
    oscSnap.stop(snapTime + 0.08);
  }

  // 连续发牌飞牌声 (Rapid Dealing Sequence)
  public playDealSequence(count = 4) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        this.playDeal();
      }, i * 65);
    }
  }
}

export const sounds = new SoundManager();
