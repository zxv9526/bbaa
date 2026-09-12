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
    
    // 1. 模拟扑克两叠交错弹拨 (Riffle clicks)
    const numClicks = 28;
    for (let i = 0; i < numClicks; i++) {
      const clickTime = now + (i * 0.022) + (Math.random() * 0.005);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320 + Math.random() * 450, clickTime);
      osc.frequency.exponentialRampToValueAtTime(120, clickTime + 0.028);

      gain.gain.setValueAtTime(0.14, clickTime);
      gain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.028);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(clickTime);
      osc.stop(clickTime + 0.028);
    }

    // 2. 模拟洗牌摩擦沙沙声 (Noise Friction)
    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.65);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.35;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.linearRampToValueAtTime(800, now + 0.65);
      filter.Q.setValueAtTime(3.0, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.08, now);
      noiseGain.gain.linearRampToValueAtTime(0.18, now + 0.3);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.65);
    } catch {
      // Audio buffer fallback
    }

    // 3. 桥式合拢收牌声 (Bridge Snap)
    const snapTime = now + 0.68;
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(480, snapTime);
    snapOsc.frequency.exponentialRampToValueAtTime(90, snapTime + 0.12);
    snapGain.gain.setValueAtTime(0.22, snapTime);
    snapGain.gain.exponentialRampToValueAtTime(0.001, snapTime + 0.12);
    snapOsc.connect(snapGain);
    snapGain.connect(this.ctx.destination);
    snapOsc.start(snapTime);
    snapOsc.stop(snapTime + 0.12);
  }

  // 逼真切牌音效 (Cut Deck - Split + Slide + Table Thud)
  public playCut() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // 1. 拔起牌叠摩擦划音 (Packet lift slide)
    const oscSlide = this.ctx.createOscillator();
    const gainSlide = this.ctx.createGain();
    oscSlide.type = 'triangle';
    oscSlide.frequency.setValueAtTime(350, now);
    oscSlide.frequency.exponentialRampToValueAtTime(850, now + 0.08);

    gainSlide.gain.setValueAtTime(0.18, now);
    gainSlide.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    oscSlide.connect(gainSlide);
    gainSlide.connect(this.ctx.destination);
    oscSlide.start(now);
    oscSlide.stop(now + 0.08);

    // 2. 切牌落地桌板闷响 (Table impact thud)
    const thudTime = now + 0.09;
    const oscThud = this.ctx.createOscillator();
    const gainThud = this.ctx.createGain();
    oscThud.type = 'sine';
    oscThud.frequency.setValueAtTime(180, thudTime);
    oscThud.frequency.exponentialRampToValueAtTime(45, thudTime + 0.14);

    gainThud.gain.setValueAtTime(0.3, thudTime);
    gainThud.gain.exponentialRampToValueAtTime(0.001, thudTime + 0.14);

    oscThud.connect(gainThud);
    gainThud.connect(this.ctx.destination);
    oscThud.start(thudTime);
    oscThud.stop(thudTime + 0.14);

    // 3. 牌叠贴合清脆敲击 (Deck tap snap)
    const snapTime = now + 0.11;
    const oscSnap = this.ctx.createOscillator();
    const gainSnap = this.ctx.createGain();
    oscSnap.type = 'triangle';
    oscSnap.frequency.setValueAtTime(620, snapTime);
    oscSnap.frequency.exponentialRampToValueAtTime(200, snapTime + 0.05);

    gainSnap.gain.setValueAtTime(0.15, snapTime);
    gainSnap.gain.exponentialRampToValueAtTime(0.001, snapTime + 0.05);

    oscSnap.connect(gainSnap);
    gainSnap.connect(this.ctx.destination);
    oscSnap.start(snapTime);
    oscSnap.stop(snapTime + 0.05);
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
