import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api';
import { RoomState } from '../types';
import { Users, Copy, Check, Play, RefreshCw, LogOut, ShieldAlert } from 'lucide-react';

interface MultiplayerRoomProps {
  roomCode: string;
  currentPlayerName: string;
  onStartRoomGame: (room: RoomState) => void;
  onExit: () => void;
}

export function MultiplayerRoom({
  roomCode,
  currentPlayerName,
  onStartRoomGame,
  onExit
}: MultiplayerRoomProps) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Poll room every 2.5 seconds
  useEffect(() => {
    let timer: any;
    const fetchRoom = async () => {
      const res = await ApiClient.pollRoom(roomCode);
      if (res.ok && res.room) {
        setRoom(res.room);
        if (res.room.status === 'arranging' || res.room.status === 'revealing') {
          onStartRoomGame(res.room);
        }
      }
    };

    fetchRoom();
    timer = setInterval(fetchRoom, 2500);
    return () => clearInterval(timer);
  }, [roomCode]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = async () => {
    setIsStarting(true);
    try {
      await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', roomCode })
      });
      const res = await ApiClient.pollRoom(roomCode);
      if (res.ok && res.room) {
        onStartRoomGame(res.room);
      }
    } catch {
      // ignore
    }
    setIsStarting(false);
  };

  const isHost = room?.hostName === currentPlayerName;

  return (
    <div className="max-w-xl w-full mx-auto bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center font-black text-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white">在线联机房间</h3>
            <p className="text-xs text-slate-500">基于 Cloudflare D1 全球数据库同步</p>
          </div>
        </div>
        <button
          onClick={onExit}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 text-xs font-bold flex items-center gap-1"
        >
          <LogOut className="w-3.5 h-3.5" /> 退出
        </button>
      </div>

      {/* Room Code Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between shadow-md">
        <div>
          <div className="text-xs text-blue-100 font-medium">房间邀请码 (Room Code)</div>
          <div className="text-3xl font-mono font-black tracking-wider mt-0.5">{roomCode}</div>
        </div>
        <button
          onClick={handleCopyCode}
          className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
          {copied ? '已复制' : '复制房号'}
        </button>
      </div>

      {/* Players List */}
      <div>
        <div className="flex items-center justify-between mb-3 text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-300">
            当前玩家 ({room?.players?.length || 1} / {room?.maxPlayers || 4})
          </span>
          <span className="text-slate-400">房主可随时发牌开始</span>
        </div>

        <div className="space-y-2">
          {room?.players?.map((p, index) => {
            const isMe = p.name === currentPlayerName;
            const isRoomHost = p.name === room.hostName;
            return (
              <div
                key={p.id || index}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-xl flex items-center justify-center">
                    {p.avatar || '🎲'}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                      {p.name}
                      {isMe && (
                        <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-bold">
                          你
                        </span>
                      )}
                      {isRoomHost && (
                        <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-bold">
                          房主
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">已就绪 · 等待开始</div>
                  </div>
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex flex-col gap-2">
        {isHost ? (
          <button
            onClick={handleStartGame}
            disabled={isStarting || (room?.players?.length || 0) < 1}
            className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <Play className="w-5 h-5 fill-current" />
            {isStarting ? '正在发牌...' : '立即发牌开始对局'}
          </button>
        ) : (
          <div className="text-center py-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-xs text-slate-500 font-medium">
            等待房主 <strong className="text-slate-800 dark:text-slate-200">{room?.hostName}</strong> 发牌中...
          </div>
        )}
      </div>
    </div>
  );
}
