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
  '👍', '🙏', '🎉', '😈'
];

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

/**
 * Simple Audio Recorder for Voice Messages
 */
export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('当前浏览器不支持录音功能');
    }

    this.audioChunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Determine supported mime type
    let mimeType = 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4';
    } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
      mimeType = 'audio/ogg';
    }

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.startTime = Date.now();
    this.mediaRecorder.start(100);
  }

  stop(): Promise<{ audioBlob: Blob; audioUrl: string; duration: number }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('未在录音中'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const duration = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));
        const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Stop all audio tracks
        if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop());
          this.stream = null;
        }

        resolve({ audioBlob, audioUrl, duration });
      };

      try {
        this.mediaRecorder.stop();
      } catch (err) {
        reject(err);
      }
    });
  }

  cancel(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.audioChunks = [];
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
