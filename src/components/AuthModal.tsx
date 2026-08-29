import React, { useState } from 'react';
import { UserAccount, PlayerStats } from '../types';
import {
  AVAILABLE_AVATARS,
  loginAccount,
  registerAccount,
  updateProfile
} from '../lib/accountManager';
import {
  X,
  User,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  LogOut,
  UserCheck,
  UserPlus,
  Edit3,
  Phone
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAccount: UserAccount;
  myStats?: PlayerStats | null;
  onAccountChange: (account: UserAccount) => void;
}

export function AuthModal({
  isOpen,
  onClose,
  currentAccount,
  myStats,
  onAccountChange
}: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'login' | 'register'>('profile');

  // Form states
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regNickname, setRegNickname] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regAvatar, setRegAvatar] = useState(AVAILABLE_AVATARS[0]);

  // Profile edit states
  const [editNickname, setEditNickname] = useState(currentAccount.nickname);
  const [editAvatar, setEditAvatar] = useState(currentAccount.avatar);
  const [isEditing, setIsEditing] = useState(false);

  // Status message
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (loginPassword.length !== 6) {
      setMessage({ type: 'error', text: '密码必须为 6 位数' });
      return;
    }

    const res = loginAccount(loginPhone, loginPassword);
    if (res.success && res.account) {
      setMessage({ type: 'success', text: res.message });
      onAccountChange(res.account);
      setTimeout(() => {
        setActiveTab('profile');
        setMessage(null);
      }, 800);
    } else {
      setMessage({ type: 'error', text: res.message });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!regPhone.trim()) {
      setMessage({ type: 'error', text: '请输入手机号' });
      return;
    }

    if (!regNickname.trim()) {
      setMessage({ type: 'error', text: '请输入玩家昵称' });
      return;
    }

    if (regPassword.length !== 6) {
      setMessage({ type: 'error', text: '密码必须严格为 6 位数（可包含字母、数字及字符）' });
      return;
    }

    const res = await registerAccount(regPhone, regNickname, regPassword, regAvatar);
    if (res.success && res.account) {
      setMessage({ type: 'success', text: res.message });
      onAccountChange(res.account);
      setTimeout(() => {
        setActiveTab('profile');
        setMessage(null);
      }, 800);
    } else {
      setMessage({ type: 'error', text: res.message });
    }
  };

  const handleSaveProfile = () => {
    const updated = updateProfile(editNickname, editAvatar);
    onAccountChange(updated);
    setIsEditing(false);
    setMessage({ type: 'success', text: '个人资料已更新！' });
    setTimeout(() => setMessage(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        id="auth-modal-card"
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                账号与个人中心
              </h2>
              <p className="text-xs text-slate-400">手机号注册登录与资料管理</p>
            </div>
          </div>

          <button
            id="close-auth-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 p-1.5 gap-1.5">
          <button
            id="tab-profile-btn"
            onClick={() => {
              setActiveTab('profile');
              setMessage(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'profile'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" /> 个人资料
          </button>
          <button
            id="tab-login-btn"
            onClick={() => {
              setActiveTab('login');
              setMessage(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'login'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" /> 手机登录
          </button>
          <button
            id="tab-register-btn"
            onClick={() => {
              setActiveTab('register');
              setMessage(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'register'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" /> 手机注册
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

        {/* Content Body */}
        <div className="p-5 overflow-y-auto max-h-[70vh]">
          {/* 1. PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="flex flex-col gap-4">
              {/* User Identity Card */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-2xl">
                      {isEditing ? editAvatar : currentAccount.avatar}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-white">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editNickname}
                              onChange={e => setEditNickname(e.target.value)}
                              className="bg-slate-800 border border-indigo-500 px-2 py-0.5 rounded-lg text-white font-bold text-xs w-32 focus:outline-none"
                              placeholder="输入昵称..."
                            />
                          ) : (
                            currentAccount.nickname
                          )}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 font-mono">
                        手机号: {currentAccount.phone}
                      </div>
                    </div>
                  </div>

                  {!isEditing ? (
                    <button
                      id="edit-profile-btn"
                      onClick={() => {
                        setEditNickname(currentAccount.nickname);
                        setEditAvatar(currentAccount.avatar);
                        setIsEditing(true);
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-bold flex items-center gap-1 transition"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-indigo-400" /> 编辑
                    </button>
                  ) : (
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleSaveProfile}
                        className="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs text-white font-bold transition"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-400 font-bold transition"
                      >
                        取消
                      </button>
                    </div>
                  )}
                </div>

                {/* Avatar Picker when editing */}
                {isEditing && (
                  <div className="pt-2 border-t border-slate-800">
                    <div className="text-[11px] text-slate-400 font-bold mb-1.5">选择头像：</div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {AVAILABLE_AVATARS.map(av => (
                        <button
                          key={av}
                          onClick={() => setEditAvatar(av)}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition ${
                            editAvatar === av
                              ? 'bg-indigo-600 ring-2 ring-indigo-400 scale-105'
                              : 'bg-slate-800 hover:bg-slate-700'
                          }`}
                        >
                          {av}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl text-center">
                  <div className="text-[10px] text-slate-400">当前积分</div>
                  <div className="text-sm font-black text-amber-400 mt-0.5">
                    {currentAccount.points.toLocaleString()}
                  </div>
                </div>
                <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl text-center">
                  <div className="text-[10px] text-slate-400">胜率</div>
                  <div className="text-sm font-black text-blue-400 mt-0.5">
                    {myStats && myStats.totalGames > 0
                      ? `${Math.round((myStats.wins / myStats.totalGames) * 100)}%`
                      : '0%'}
                  </div>
                </div>
                <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl text-center">
                  <div className="text-[10px] text-slate-400">总对局</div>
                  <div className="text-sm font-black text-slate-200 mt-0.5">
                    {myStats?.totalGames || 0} 场
                  </div>
                </div>
              </div>

              {/* Account Switch */}
              <button
                id="switch-account-btn"
                onClick={() => setActiveTab('login')}
                className="w-full py-2.5 rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" /> 切换其他手机账号
              </button>
            </div>
          )}

          {/* 2. LOGIN TAB */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">手机号码</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-phone-input"
                    type="text"
                    required
                    value={loginPhone}
                    onChange={e => setLoginPhone(e.target.value)}
                    placeholder="请输入注册手机号..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">
                  登录密码 <span className="text-[10px] text-slate-400 font-normal">(6位数密码)</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-password-input"
                    type="password"
                    maxLength={6}
                    required
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="输入 6 位数密码..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-1 flex flex-col gap-2">
                <button
                  id="submit-login-btn"
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" /> 确认登录
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('register')}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition"
                  >
                    没有账号？使用手机号快速注册 &gt;
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* 3. REGISTER TAB */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="flex flex-col gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-800/60 text-[11px] text-indigo-300 leading-relaxed">
                💡 <b>注册提示</b>：仅限 <b>Bot 管理员已授权</b> 的手机号方可注册。如未授权请先联系管理员或在 Bot 管理中心授权。
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">手机号码</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="reg-phone-input"
                    type="text"
                    required
                    value={regPhone}
                    onChange={e => setRegPhone(e.target.value)}
                    placeholder="请输入手机号..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">玩家昵称</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="reg-nickname-input"
                    type="text"
                    required
                    value={regNickname}
                    onChange={e => setRegNickname(e.target.value)}
                    placeholder="输入牌桌昵称..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">
                  设置密码 <span className="text-[10px] text-amber-400 font-normal">(严格 6 位数，不限大小写字母/字符)</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="reg-password-input"
                    type="password"
                    maxLength={6}
                    required
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="输入 6 位密码..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Avatar Selector */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">选择初始头像</label>
                <div className="grid grid-cols-7 gap-1">
                  {AVAILABLE_AVATARS.map(av => (
                    <button
                      key={av}
                      type="button"
                      onClick={() => setRegAvatar(av)}
                      className={`h-8 rounded-xl flex items-center justify-center text-base transition ${
                        regAvatar === av
                          ? 'bg-indigo-600 ring-2 ring-indigo-400 scale-105'
                          : 'bg-slate-800 hover:bg-slate-700'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-1 flex flex-col gap-1.5">
                <button
                  id="submit-reg-btn"
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-lg shadow-indigo-600/30 transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" /> 立即注册账号
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className="text-xs text-center text-slate-400 hover:text-indigo-400 font-bold transition py-1"
                >
                  已有账号？点击返回登录
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
