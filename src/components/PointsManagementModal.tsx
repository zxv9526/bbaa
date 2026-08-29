import React, { useState, useEffect } from 'react';
import { UserAccount, PointsTransaction } from '../types';
import {
  searchUserByPhone,
  transferPoints,
  getPointsTransactions
} from '../lib/accountManager';
import { sounds } from '../sound';
import {
  X,
  Search,
  Send,
  History,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  Coins,
  UserCheck
} from 'lucide-react';

interface PointsManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAccount: UserAccount;
  onAccountUpdated: (account: UserAccount) => void;
}

export function PointsManagementModal({
  isOpen,
  onClose,
  currentAccount,
  onAccountUpdated
}: PointsManagementModalProps) {
  const [activeTab, setActiveTab] = useState<'transfer' | 'history'>('transfer');
  const [searchPhone, setSearchPhone] = useState('');
  const [targetUser, setTargetUser] = useState<{
    phone: string;
    nickname: string;
    avatar: string;
    points: number;
  } | null>(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTransactions(getPointsTransactions(currentAccount.phone));
      setMessage(null);
    }
  }, [isOpen, currentAccount.phone]);

  if (!isOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setTargetUser(null);

    const cleanPhone = searchPhone.trim();
    if (!cleanPhone) {
      setMessage({ type: 'error', text: '请输入要搜索的手机号' });
      return;
    }

    if (cleanPhone === currentAccount.phone) {
      setMessage({ type: 'error', text: '这是您当前的手机号，无法向自己赠送积分' });
      return;
    }

    const res = searchUserByPhone(cleanPhone);
    if (res.success && res.user) {
      setTargetUser(res.user);
      setMessage({ type: 'success', text: `已找到玩家：${res.user.nickname}` });
    } else {
      setMessage({ type: 'error', text: res.message || '未找到该手机号对应的玩家' });
    }
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;

    setMessage(null);
    const amountNum = parseInt(transferAmount, 10);
    if (isNaN(amountNum) || amountNum <= 0) {
      setMessage({ type: 'error', text: '请输入大于 0 的有效积分数量' });
      return;
    }

    if (amountNum > currentAccount.points) {
      setMessage({ type: 'error', text: `您的积分不足（当前仅有 ${currentAccount.points.toLocaleString()} 积分）` });
      return;
    }

    const res = transferPoints(targetUser.phone, amountNum);
    if (res.success && res.senderAccount) {
      sounds.playVictory();
      setMessage({ type: 'success', text: res.message });
      onAccountUpdated(res.senderAccount);
      setTransferAmount('');
      setTransactions(getPointsTransactions(res.senderAccount.phone));
      // Refresh target user points
      const updatedTarget = searchUserByPhone(targetUser.phone);
      if (updatedTarget.user) {
        setTargetUser(updatedTarget.user);
      }
    } else {
      setMessage({ type: 'error', text: res.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        id="points-modal-card"
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">积分管理</h2>
              <p className="text-xs text-slate-400">搜索玩家手机号相互赠送积分与收支明细</p>
            </div>
          </div>

          <button
            id="close-points-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current User Asset Info */}
        <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">我的账号 (手机号)</div>
            <div className="text-sm font-bold text-white font-mono mt-0.5">{currentAccount.phone}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-amber-300 font-medium">可用积分余额</div>
            <div className="text-xl font-black text-amber-400">
              {currentAccount.points.toLocaleString()} <span className="text-xs font-normal text-slate-400">分</span>
            </div>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 p-1.5 gap-1.5">
          <button
            id="tab-transfer-btn"
            onClick={() => {
              setActiveTab('transfer');
              setMessage(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'transfer'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Send className="w-3.5 h-3.5" /> 赠送积分
          </button>
          <button
            id="tab-history-btn"
            onClick={() => {
              setActiveTab('history');
              setMessage(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'history'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <History className="w-3.5 h-3.5" /> 积分明细
          </button>
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`mx-5 mt-3 p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Tab Contents */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'transfer' && (
            <div className="space-y-4">
              {/* Search Form */}
              <form onSubmit={handleSearch} className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  搜索对方手机号
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="search-phone-input"
                      type="text"
                      required
                      value={searchPhone}
                      onChange={e => setSearchPhone(e.target.value)}
                      placeholder="输入对方手机号..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <button
                    id="submit-search-user-btn"
                    type="submit"
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-2xl border border-slate-700 transition"
                  >
                    搜索
                  </button>
                </div>
              </form>

              {/* Target User Found Card */}
              {targetUser && (
                <div className="bg-slate-950 border border-amber-500/40 rounded-2xl p-4 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl">
                        {targetUser.avatar}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm flex items-center gap-1.5">
                          <span>{targetUser.nickname}</span>
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          手机号: {targetUser.phone}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400">对方当前积分</div>
                      <div className="text-sm font-bold text-slate-200">
                        {targetUser.points.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Transfer Form */}
                  <form onSubmit={handleTransfer} className="pt-2 border-t border-slate-800 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">
                        赠送积分数量
                      </label>
                      <div className="relative">
                        <input
                          id="transfer-amount-input"
                          type="number"
                          min="1"
                          max={currentAccount.points}
                          required
                          value={transferAmount}
                          onChange={e => setTransferAmount(e.target.value)}
                          placeholder={`最多可赠送 ${currentAccount.points.toLocaleString()} 积分`}
                          className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setTransferAmount(currentAccount.points.toString())}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400 hover:text-amber-300"
                        >
                          全部
                        </button>
                      </div>
                    </div>

                    <button
                      id="confirm-transfer-btn"
                      type="submit"
                      disabled={currentAccount.points <= 0}
                      className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" /> 确认赠送积分
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-2">
              {transactions.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  暂无积分流水记录
                </div>
              ) : (
                transactions.map(tx => {
                  const isPositive = tx.amount >= 0;
                  return (
                    <div
                      key={tx.id}
                      className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                            isPositive
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-white">{tx.title}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {new Date(tx.timestamp).toLocaleString('zh-CN', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`font-black text-sm ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isPositive ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          余额: {tx.balanceAfter.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
