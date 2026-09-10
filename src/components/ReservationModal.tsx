import React, { useState } from 'react';
import { Calendar, Clock, Lock, Users, Shield, ArrowRight, X, VolumeX, CheckCircle2 } from 'lucide-react';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartReservationMatch: (roomTitle: string) => void;
  userPoints: number;
}

export function ReservationModal({
  isOpen,
  onClose,
  onStartReservationMatch,
  userPoints
}: ReservationModalProps) {
  if (!isOpen) return null;

  const reservationRooms = [
    {
      id: 'res_101',
      title: '黄金八人预约专场',
      timeSlot: '20:00 - 21:00 黄金时段',
      type: '官方定场',
      playersCount: '7/8 已预约',
      cost: '1,000 积分',
      desc: '标准双副104张十三水，严格倒水校验，纯静无打扰。',
      status: '即刻可开局'
    },
    {
      id: 'res_102',
      title: '至尊大师静音挑战赛',
      timeSlot: '21:30 - 22:30 高阶场',
      type: '高阶沉浸',
      playersCount: '6/8 已预约',
      cost: '2,000 积分',
      desc: '高手对决，屏蔽所有聊天与语音干扰，全凭牌力说话。',
      status: '即刻可开局'
    },
    {
      id: 'res_103',
      title: '私密好友预约牌桌',
      timeSlot: '自定义时间段',
      type: '私密房',
      playersCount: '1/8 等待中',
      cost: '500 积分',
      desc: '专属于你的静心牌桌，打造不受外界喧嚣打扰的十三水体验。',
      status: '创建/进入'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center text-xl font-black shadow-inner">
              📅
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white tracking-wide">十三水 · 预约场</h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                  定时/私密定场
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">预定赛事席位 · 静心沉浸竞技</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quiet Mode Banner */}
        <div className="bg-slate-950/80 border-b border-slate-800/80 px-5 py-2.5 flex items-center justify-between text-xs text-amber-300 font-bold shrink-0">
          <div className="flex items-center gap-2">
            <VolumeX className="w-4 h-4 text-amber-400 shrink-0" />
            <span>【预约场规则 Notice】预约场为无干扰纯净对局，禁用语音与文本聊天功能。</span>
          </div>
        </div>

        {/* Room List Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1 no-scrollbar">
          {reservationRooms.map((room) => (
            <div
              key={room.id}
              onClick={() => onStartReservationMatch(room.title)}
              className="bg-slate-950/60 border border-slate-800/90 hover:border-blue-500/50 hover:bg-slate-800/50 rounded-2xl p-4 transition-all cursor-pointer group flex flex-col gap-2.5 shadow-sm hover:shadow-md"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm sm:text-base text-white group-hover:text-blue-300 transition">
                    {room.title}
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                    {room.type}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {room.playersCount}
                  </span>
                  <span className="text-amber-400 font-bold">
                    {room.cost}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {room.desc}
              </p>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-slate-500 font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{room.timeSlot}</span>
                </div>
                <div className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1 transition group-hover:scale-105">
                  <span>立即入座发牌</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>预约成功后自动锁定席位，断线可随时恢复。</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
          >
            取消
          </button>
        </div>

      </div>
    </div>
  );
}
