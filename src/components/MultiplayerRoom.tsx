import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api';
import { RoomState } from '../types';
import { RoomManager, subscribeRoomUpdates } from '../lib/roomManager';
import { Users, Copy, Check, Play, RefreshCw, LogOut, Crown, UserPlus, Trash2, ArrowRight, ShieldCheck } from 'lucide-react';

interface MultiplayerRoomProps {
  roomCode: string;
  currentPlayerName: string;
  currentPlayerAvatar?: string;
  onSetRoomCode: (code: string) => void;
  onStartRoomGame: (room: RoomState) => void;
  onExit: () => void;
}

export function MultiplayerRoom({
  roomCode,
  currentPlayerName,
  currentPlayerAvatar = '😎',
  onSetRoomCode,
  onStartRoomGame,
  onExit
}: MultiplayerRoomProps) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [copied, setCopied] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState('');
  const [creatingMaxPlayers, setCreatingMaxPlayers] = useState<4 | 8>(4);
  const [isProcessing, setIsProcessing] = useState(false);

  // Poll & subscribe to room updates if roomCode is set
  useEffect(() => {
    if (!roomCode) {
      setRoom(null);
      return;
    }

    const fetchRoom = async () => {
      const res = await ApiClient.pollRoom(roomCode);
      if (res.ok && res.room) {
        setRoom(res.room);
        if (res.room.status === 'shuffling_cutting' || res.room.status === 'arranging' || res.room.status === 'revealing') {
          onStartRoomGame(res.room);
        }
      }
    };

    fetchRoom();
    const unsub = subscribeRoomUpdates(roomCode, updatedRoom => {
      setRoom(updatedRoom);
      if (updatedRoom.status === 'shuffling_cutting' || updatedRoom.status === 'arranging' || updatedRoom.status === 'revealing') {
        onStartRoomGame(updatedRoom);
      }
    });

    const timer = setInterval(fetchRoom, 2000);
    return () => {
      clearInterval(timer);
      unsub();
    };
  }, [roomCode]);

  // Create room
  const handleCreate = async () => {
    setIsProcessing(true);
    setError('');
    const res = await ApiClient.createRoom(currentPlayerName, creatingMaxPlayers, undefined, currentPlayerAvatar);
    if (res.ok && res.roomCode) {
      onSetRoomCode(res.roomCode);
      if (res.room) setRoom(res.room);
    } else {
      setError('创建房间失败，请重试');
    }
    setIsProcessing(false);
  };

  // Join room
  const handleJoin = async () => {
    if (!inputCode.trim()) {
      setError('请输入6位房间邀请码');
      return;
    }
    setIsProcessing(true);
    setError('');
    const code = inputCode.trim().toUpperCase();
    const res = await ApiClient.joinRoom(code, currentPlayerName, currentPlayerAvatar);
    if (res.ok && res.room) {
      onSetRoomCode(code);
      setRoom(res.room);
    } else {
      setError(res.message || '未找到该房间，请检查房号');
    }
    setIsProcessing(false);
  };

  // Copy room code
  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Add AI bot to fill seat
  const handleAddBot = () => {
    if (!roomCode) return;
    const updated = RoomManager.addBotPlayer(roomCode);
    if (updated) setRoom(updated);
  };

  // Kick / remove player
  const handleRemovePlayer = (pId: string) => {
    if (!roomCode) return;
    const updated = RoomManager.removePlayer(roomCode, pId);
    if (updated) setRoom(updated);
  };

  // Host starts game (enters shuffle & cut)
  const handleStartGame = () => {
    if (!roomCode || !room) return;
    const updated = RoomManager.startShuffleCutStage(roomCode);
    if (updated) {
      setRoom(updated);
      onStartRoomGame(updated);
    }
  };

  // 1. If not in a room yet: Show Room Creation / Joining Hub
  if (!roomCode || !room) {
    return (
      <div className="max-w-xl w-full mx-auto bg-slate-900/95 rounded-3xl shadow-2xl border border-purple-500/40 p-6 sm:p-8 flex flex-col gap-6 text-white backdrop-blur">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-purple-600/30">
              👥
            </div>
            <div>
              <h3 className="text-xl font-black text-white">好友联机开黑场</h3>
              <p className="text-xs text-purple-300">轮流发牌 · 洗牌切牌 · 实时同屏对决</p>
            </div>
          </div>
          <button
            onClick={onExit}
            className="px-3.5 py-1.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-bold flex items-center gap-1 transition"
          >
            <LogOut className="w-3.5 h-3.5" /> 返回大厅
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-2 py-1">
          <div className="p-2.5 rounded-2xl bg-purple-950/40 border border-purple-500/30 text-center">
            <div className="text-base mb-0.5">👑</div>
            <div className="text-[11px] font-black text-purple-300">轮流做庄发牌</div>
            <div className="text-[10px] text-slate-400 mt-0.5">每局自动轮换发牌官</div>
          </div>
          <div className="p-2.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-center">
            <div className="text-base mb-0.5">🎴</div>
            <div className="text-[11px] font-black text-indigo-300">洗牌切牌互动</div>
            <div className="text-[10px] text-slate-400 mt-0.5">拟真洗牌与切牌点对调</div>
          </div>
          <div className="p-2.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-center">
            <div className="text-base mb-0.5">🎙️</div>
            <div className="text-[11px] font-black text-emerald-300">实时对讲聊天</div>
            <div className="text-[10px] text-slate-400 mt-0.5">语音与战术快捷语</div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-500/60 text-rose-300 text-xs text-center font-bold">
            {error}
          </div>
        )}

        {/* Two Options: Create or Join */}
        <div className="flex flex-col gap-5">
          {/* Box 1: Create Room */}
          <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex flex-col gap-3">
            <div className="text-sm font-black text-slate-200 flex items-center justify-between">
              <span>创建开黑房间</span>
              <span className="text-[11px] text-purple-400 font-normal">房主可指定场次人数</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setCreatingMaxPlayers(4)}
                className={`py-3 px-3 rounded-xl border text-xs font-black flex flex-col items-center gap-1 transition ${
                  creatingMaxPlayers === 4
                    ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-600/30'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="text-sm">4人经典场</span>
                <span className="text-[10px] opacity-80 font-normal">单副扑克 52张 · 每人13张</span>
              </button>

              <button
                type="button"
                onClick={() => setCreatingMaxPlayers(8)}
                className={`py-3 px-3 rounded-xl border text-xs font-black flex flex-col items-center gap-1 transition ${
                  creatingMaxPlayers === 8
                    ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-600/30'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="text-sm">8人巅峰场</span>
                <span className="text-[10px] opacity-80 font-normal">双副扑克 104张 · 8人同台</span>
              </button>
            </div>

            <button
              onClick={handleCreate}
              disabled={isProcessing}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm shadow-lg shadow-purple-950/50 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>立即创建房间</span>
            </button>
          </div>

          {/* Box 2: Join Room by Code */}
          <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex flex-col gap-3">
            <div className="text-sm font-black text-slate-200">输入房间号加入</div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={6}
                value={inputCode}
                onChange={e => setInputCode(e.target.value.toUpperCase())}
                placeholder="输入6位房间号 (如 888888)"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono font-bold tracking-widest text-center text-sm focus:outline-none focus:border-purple-500 transition"
              />
              <button
                onClick={handleJoin}
                disabled={isProcessing}
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm transition active:scale-95 cursor-pointer whitespace-nowrap"
              >
                加入房间
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. If inside a room: Show Seated Table, Rotating Dealer Preview & Action Buttons
  const isHost = room.hostName === currentPlayerName;
  const currentDealer = room.players[room.dealerIndex % room.players.length];
  const nextDealer = room.players[(room.dealerIndex + 1) % room.players.length];

  return (
    <div className="max-w-xl w-full mx-auto bg-slate-900/95 rounded-3xl shadow-2xl border border-purple-500/40 p-5 sm:p-7 flex flex-col gap-5 text-white backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">联机开黑房间</h3>
            <p className="text-[11px] text-purple-300">
              {room.maxPlayers === 8 ? '八人对决 (双副104牌)' : '四人对决 (单副52牌)'} · 第 {room.roundIndex} 局
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            onSetRoomCode('');
            setRoom(null);
          }}
          className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-bold flex items-center gap-1 transition"
        >
          <LogOut className="w-3.5 h-3.5" /> 退出房间
        </button>
      </div>

      {/* Room Code Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-700 to-indigo-700 text-white flex items-center justify-between shadow-lg shadow-purple-950/40">
        <div>
          <div className="text-[11px] text-purple-200 font-medium">房间邀请码 (Room Code)</div>
          <div className="text-3xl font-mono font-black tracking-widest mt-0.5">{roomCode}</div>
        </div>
        <button
          onClick={handleCopyCode}
          className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? '已复制' : '复制房号'}</span>
        </button>
      </div>

      {/* Rotating Dealer Status Banner (用户轮流发牌机制) */}
      <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black">
            <Crown className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-black text-amber-300">
              本局发牌官：{currentDealer?.name || '待定'}
              {currentDealer?.name === currentPlayerName && ' (你)'}
            </div>
            <div className="text-[10px] text-slate-400">
              下局轮庄发牌: {nextDealer?.name || '下一位'} (轮流做庄)
            </div>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
          轮流发牌制
        </span>
      </div>

      {/* Players List */}
      <div>
        <div className="flex items-center justify-between mb-2.5 text-xs">
          <span className="font-bold text-slate-300">
            桌上玩家 ({room.players.length} / {room.maxPlayers})
          </span>
          {room.players.length < room.maxPlayers && (
            <button
              onClick={handleAddBot}
              className="text-[11px] text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 bg-purple-950/40 px-2.5 py-1 rounded-lg border border-purple-500/30 transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>召唤陪练好友 (AI)</span>
            </button>
          )}
        </div>

        <div className="space-y-2">
          {room.players.map((p, idx) => {
            const isMe = p.name === currentPlayerName;
            const isDealer = idx === room.dealerIndex % room.players.length;
            const isRoomHost = p.name === room.hostName;

            return (
              <div
                key={p.id || idx}
                className={`p-3 rounded-2xl border flex items-center justify-between transition ${
                  isDealer
                    ? 'bg-amber-950/30 border-amber-500/50'
                    : 'bg-slate-800/60 border-slate-700/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl">
                    {p.avatar || '🎲'}
                    {isDealer && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[10px]">
                        👑
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-200 text-sm flex items-center gap-2">
                      <span>{p.name}</span>
                      {isMe && (
                        <span className="bg-blue-500/20 text-blue-300 text-[10px] px-1.5 py-0.2 rounded border border-blue-500/30 font-bold">
                          你
                        </span>
                      )}
                      {isDealer && (
                        <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.2 rounded border border-amber-500/30 font-bold">
                          本局发牌官
                        </span>
                      )}
                      {isRoomHost && !isDealer && (
                        <span className="bg-purple-500/20 text-purple-300 text-[10px] px-1.5 py-0.2 rounded border border-purple-500/30 font-bold">
                          房主
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isDealer ? '负责本局洗牌切牌与发牌' : '已就位 · 准备就绪'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  {isHost && p.name !== currentPlayerName && (
                    <button
                      onClick={() => handleRemovePlayer(p.id)}
                      className="p-1 rounded-lg text-slate-500 hover:text-rose-400 transition"
                      title="请出房间"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Area */}
      <div className="pt-2 flex flex-col gap-2">
        {isHost || room.players.length >= 2 ? (
          <button
            onClick={handleStartGame}
            disabled={room.players.length < 2}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 hover:from-amber-400 hover:to-red-500 text-slate-950 font-black text-base shadow-xl shadow-red-600/30 transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>开始对局 · 进入洗牌切牌 (Round {room.roundIndex})</span>
          </button>
        ) : (
          <div className="text-center py-3 bg-slate-800/40 rounded-2xl text-xs text-slate-400 font-medium">
            至少需要 2 名玩家方可开局，可点击上方「召唤陪练好友(AI)」或邀请好友！
          </div>
        )}
      </div>
    </div>
  );
}
