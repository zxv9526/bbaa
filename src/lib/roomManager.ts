import { Card, RoomPlayer, RoomState, PlayerArrangement, PlayerScoreDetail } from '../types';
import { createDeck, createDoubleDeck, shuffle, cutDeck, calculateMatchScores, aiArrangeCards, sortCards } from '../gameLogic';

const ROOM_STORAGE_PREFIX = 'thirteen_water_room_';
const ROOM_LIST_KEY = 'thirteen_water_room_list';
const ROOM_BROADCAST_CHANNEL = 'thirteen_water_room_events';

// BroadcastChannel for instant cross-tab sync in browser
let roomChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    roomChannel = new BroadcastChannel(ROOM_BROADCAST_CHANNEL);
  } catch (e) {
    console.warn('BroadcastChannel not supported:', e);
  }
}

function broadcastRoomChange(room: RoomState) {
  if (roomChannel) {
    try {
      roomChannel.postMessage({ type: 'ROOM_UPDATED', roomCode: room.roomCode, room });
    } catch (e) {
      // ignore
    }
  }
}

export function subscribeRoomUpdates(roomCode: string, onUpdate: (room: RoomState) => void): () => void {
  if (!roomChannel) return () => {};
  const handler = (e: MessageEvent) => {
    if (e.data && e.data.roomCode === roomCode.toUpperCase() && e.data.room) {
      onUpdate(e.data.room);
    }
  };
  roomChannel.addEventListener('message', handler);
  return () => {
    roomChannel?.removeEventListener('message', handler);
  };
}

// Local storage helpers
export function getLocalRoom(roomCode: string): RoomState | null {
  try {
    const raw = localStorage.getItem(ROOM_STORAGE_PREFIX + roomCode.toUpperCase());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLocalRoom(room: RoomState): void {
  try {
    room.updatedAt = new Date().toISOString();
    localStorage.setItem(ROOM_STORAGE_PREFIX + room.roomCode.toUpperCase(), JSON.stringify(room));
    
    // Maintain active room list
    const listRaw = localStorage.getItem(ROOM_LIST_KEY);
    const list: string[] = listRaw ? JSON.parse(listRaw) : [];
    if (!list.includes(room.roomCode.toUpperCase())) {
      list.push(room.roomCode.toUpperCase());
      localStorage.setItem(ROOM_LIST_KEY, JSON.stringify(list.slice(-20)));
    }
    broadcastRoomChange(room);
  } catch (e) {
    console.error('Failed to save local room:', e);
  }
}

export const RoomManager = {
  // 1. 创建房间
  createRoom(hostName: string, avatar = '😎', maxPlayers: 4 | 8 = 4, customCode?: string): RoomState {
    const code = (customCode || Math.floor(100000 + Math.random() * 900000).toString()).toUpperCase();
    const hostPlayer: RoomPlayer = {
      id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: hostName || '房主',
      avatar: avatar || '😎',
      isReady: true,
      hasSubmitted: false,
      isAi: false
    };

    const room: RoomState = {
      roomCode: code,
      hostName: hostPlayer.name,
      maxPlayers,
      status: 'waiting',
      roundIndex: 1,
      dealerIndex: 0, // 初始第1位玩家为庄家发牌手
      shuffleCount: 0,
      cutPosition: undefined,
      cutCard: null,
      lastActionText: `房间创建成功，等待好友加入`,
      players: [hostPlayer],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    saveLocalRoom(room);
    return room;
  },

  // 2. 加入房间
  joinRoom(roomCode: string, playerName: string, avatar = '🀄'): { ok: boolean; room?: RoomState; message?: string } {
    const code = roomCode.trim().toUpperCase();
    const room = getLocalRoom(code);
    if (!room) {
      return { ok: false, message: '房间不存在或已解散' };
    }

    const existingIdx = room.players.findIndex(p => p.name === playerName);
    if (existingIdx !== -1) {
      // 已经存在，更新状态
      room.players[existingIdx].avatar = avatar;
      saveLocalRoom(room);
      return { ok: true, room };
    }

    if (room.players.length >= room.maxPlayers) {
      return { ok: false, message: '该房间已满员' };
    }

    const newPlayer: RoomPlayer = {
      id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: playerName,
      avatar,
      isReady: true,
      hasSubmitted: false,
      isAi: false
    };

    room.players.push(newPlayer);
    room.lastActionText = `玩家【${playerName}】加入了房间`;
    saveLocalRoom(room);
    return { ok: true, room };
  },

  // 3. 添加 AI 陪练好友填满空位
  addBotPlayer(roomCode: string): RoomState | null {
    const room = getLocalRoom(roomCode);
    if (!room) return null;
    if (room.players.length >= room.maxPlayers) return room;

    const botNames = [
      { name: '智多星', avatar: '🤖' },
      { name: '百胜侯', avatar: '🦊' },
      { name: '十三叔', avatar: '🐼' },
      { name: '猛虎客', avatar: '🐯' },
      { name: '龙行天下', avatar: '🐉' },
      { name: '东方不败', avatar: '🦁' },
      { name: '幻影客', avatar: '🥷' }
    ];

    const currentNames = new Set(room.players.map(p => p.name));
    const available = botNames.find(b => !currentNames.has(b.name)) || {
      name: `陪练${room.players.length + 1}号`,
      avatar: '🤖'
    };

    const bot: RoomPlayer = {
      id: `bot_${Date.now()}_${room.players.length}`,
      name: `${available.name} (好友AI)`,
      avatar: available.avatar,
      isReady: true,
      hasSubmitted: false,
      isAi: true
    };

    room.players.push(bot);
    room.lastActionText = `已添加【${bot.name}】进入房间陪练`;
    saveLocalRoom(room);
    return room;
  },

  // 4. 移除指定玩家或 AI
  removePlayer(roomCode: string, playerId: string): RoomState | null {
    const room = getLocalRoom(roomCode);
    if (!room) return null;
    const removed = room.players.find(p => p.id === playerId);
    room.players = room.players.filter(p => p.id !== playerId);
    if (room.dealerIndex >= room.players.length) {
      room.dealerIndex = 0;
    }
    if (removed) {
      room.lastActionText = `【${removed.name}】离开了房间`;
    }
    saveLocalRoom(room);
    return room;
  },

  // 5. 进入洗牌切牌阶段
  startShuffleCutStage(roomCode: string): RoomState | null {
    const room = getLocalRoom(roomCode);
    if (!room) return null;

    room.status = 'shuffling_cutting';
    room.shuffleCount = 0;
    room.cutPosition = undefined;
    room.cutCard = null;

    // 当前发牌庄家
    const dealer = room.players[room.dealerIndex % room.players.length];
    room.lastActionText = `第 ${room.roundIndex} 局开始！由庄家【${dealer?.name || '庄家'}】负责洗牌切牌`;
    
    // 重置提交状态
    room.players = room.players.map(p => ({
      ...p,
      hasSubmitted: false,
      arrangement: undefined,
      cards: undefined
    }));

    saveLocalRoom(room);
    return room;
  },

  // 6. 庄家执行洗牌 (可多次)
  performShuffle(roomCode: string): RoomState | null {
    const room = getLocalRoom(roomCode);
    if (!room) return null;

    room.shuffleCount += 1;
    const dealer = room.players[room.dealerIndex % room.players.length];
    room.lastActionText = `庄家【${dealer?.name}】进行了第 ${room.shuffleCount} 次洗牌`;
    saveLocalRoom(room);
    return room;
  },

  // 7. 庄家执行切牌
  performCut(roomCode: string, cutPosition: number, cutCard: Card): RoomState | null {
    const room = getLocalRoom(roomCode);
    if (!room) return null;

    room.cutPosition = cutPosition;
    room.cutCard = cutCard;
    const dealer = room.players[room.dealerIndex % room.players.length];
    room.lastActionText = `庄家【${dealer?.name}】完成了切牌 (切点: 第${cutPosition}张)`;
    saveLocalRoom(room);
    return room;
  },

  // 8. 确认发牌：根据牌堆将13张手牌分配给每个玩家，进入理牌阶段
  dealCardsToPlayers(roomCode: string, cutDeckCards?: Card[]): RoomState | null {
    const room = getLocalRoom(roomCode);
    if (!room) return null;

    const totalNeeded = room.players.length * 13;
    let deck = cutDeckCards && cutDeckCards.length >= totalNeeded
      ? [...cutDeckCards]
      : room.maxPlayers === 8
      ? shuffle(createDoubleDeck())
      : shuffle(createDeck());

    // 分牌：从庄家开始顺时针各发13张
    const numPlayers = room.players.length;
    const startDealer = room.dealerIndex % numPlayers;

    for (let i = 0; i < numPlayers; i++) {
      const seat = (startDealer + i) % numPlayers;
      const hand = deck.slice(i * 13, (i + 1) * 13);
      room.players[seat].cards = sortCards(hand);
      room.players[seat].hasSubmitted = false;
      room.players[seat].arrangement = undefined;

      // 如果是 AI 玩家，预先自动完成理牌
      if (room.players[seat].isAi) {
        const aiArr = aiArrangeCards(hand);
        room.players[seat].arrangement = aiArr;
        room.players[seat].hasSubmitted = true;
      }
    }

    room.status = 'arranging';
    const dealer = room.players[startDealer];
    room.lastActionText = `发牌完毕！庄家【${dealer.name}】已完成发牌，请各位玩家抓紧理牌`;
    saveLocalRoom(room);
    return room;
  },

  // 9. 玩家提交理牌
  submitPlayerArrangement(roomCode: string, playerId: string, arrangement: PlayerArrangement, cards?: Card[]): RoomState | null {
    const room = getLocalRoom(roomCode);
    if (!room) return null;

    const p = room.players.find(x => x.id === playerId);
    if (p) {
      p.hasSubmitted = true;
      p.arrangement = arrangement;
      if (cards) p.cards = cards;
    }

    // 检查是否所有玩家都已提交
    const allSubmitted = room.players.every(x => x.hasSubmitted && x.arrangement);
    if (allSubmitted && room.players.length >= 2) {
      // 触发比牌结算
      room.status = 'revealing';
      
      const formattedPlayers = room.players.map(pl => ({
        id: pl.id,
        name: pl.name,
        isAi: !!pl.isAi,
        avatar: pl.avatar,
        cards: pl.cards || [],
        arrangement: pl.arrangement!
      }));

      const results = calculateMatchScores(formattedPlayers);
      room.players.forEach(pl => {
        const r = results.find(res => res.playerId === pl.id);
        if (r) {
          pl.scoreResult = r;
          pl.waterPoints = (pl.waterPoints || 0) + r.finalPoints;
        }
      });

      room.lastActionText = `所有玩家提交完毕，正在比牌亮牌！`;
    }

    saveLocalRoom(room);
    return room;
  },

  // 10. 下一局：轮流转庄发牌 (用户轮流发牌核心逻辑)
  nextRoundAndRotateDealer(roomCode: string): RoomState | null {
    const room = getLocalRoom(roomCode);
    if (!room) return null;

    const numPlayers = room.players.length;
    if (numPlayers === 0) return null;

    // 轮转到下一个座次作为庄家
    const prevDealer = room.players[room.dealerIndex % numPlayers];
    room.dealerIndex = (room.dealerIndex + 1) % numPlayers;
    room.roundIndex += 1;
    const newDealer = room.players[room.dealerIndex];

    room.status = 'shuffling_cutting';
    room.shuffleCount = 0;
    room.cutPosition = undefined;
    room.cutCard = null;

    // 清理上一局手牌与提交
    room.players = room.players.map(p => ({
      ...p,
      hasSubmitted: false,
      arrangement: undefined,
      cards: undefined
    }));

    room.lastActionText = `上一局庄家【${prevDealer?.name}】交接！第 ${room.roundIndex} 局轮到【${newDealer?.name}】担任发牌官并洗牌切牌！`;
    saveLocalRoom(room);
    return room;
  }
};
