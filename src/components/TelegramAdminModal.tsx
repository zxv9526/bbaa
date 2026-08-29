import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api';
import { TelegramBotStatus, UserAccount, PointsTransaction } from '../types';
import {
  getAuthorizedPhones,
  authorizePhone,
  revokePhone,
  getAllUsersList,
  searchUserByPhone,
  adminAdjustPoints,
  adminSetPoints,
  getPointsTransactions
} from '../lib/accountManager';
import {
  Bot,
  ShieldCheck,
  Search,
  Terminal,
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Copy,
  Users,
  Trophy,
  HelpCircle,
  Phone,
  PlusCircle,
  MinusCircle,
  Coins,
  Lock,
  Unlock,
  Sliders,
  History,
  Check,
  AlertCircle
} from 'lucide-react';

interface TelegramAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshCurrentAccount?: () => void;
}

export function TelegramAdminModal({ isOpen, onClose, onRefreshCurrentAccount }: TelegramAdminModalProps) {
  const [activeTab, setActiveTab] = useState<'players' | 'auth' | 'terminal' | 'guide'>('players');
  const [botStatus, setBotStatus] = useState<TelegramBotStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // 1. 玩家与积分管理状态
  const [searchQuery, setSearchQuery] = useState('');
  const [allPlayers, setAllPlayers] = useState<UserAccount[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<UserAccount | null>(null);
  const [playerTxs, setPlayerTxs] = useState<PointsTransaction[]>([]);
  const [customPointsInput, setCustomPointsInput] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 2. 手机号授权状态
  const [authorizedPhonesList, setAuthorizedPhonesList] = useState<string[]>([]);
  const [newAuthPhoneInput, setNewAuthPhoneInput] = useState('');
  const [authFeedback, setAuthFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 3. 终端模拟器状态
  const [commandInput, setCommandInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState<
    Array<{ sender: 'user' | 'bot'; text: string; markup?: any; time: string }>
  >([
    {
      sender: 'bot',
      text: `🤖 <b>十三水 Bot 管理员指令中心已就绪！</b>\n\n您可以使用指令管理注册授权、搜索玩家及增减玩家积分：\n\n• <code>/auth &lt;手机号&gt;</code> - 授权手机号注册\n• <code>/unauth &lt;手机号&gt;</code> - 取消手机号授权\n• <code>/score &lt;手机号/昵称&gt;</code> - 搜索玩家并查看积分\n• <code>/add &lt;手机号&gt; &lt;数量&gt;</code> - 为玩家增加积分\n• <code>/del &lt;手机号&gt; &lt;数量&gt;</code> - 为玩家扣减积分\n• <code>/set &lt;手机号&gt; &lt;数量&gt;</code> - 设置玩家指定积分\n• <code>/players</code> - 查看全服玩家与积分\n• <code>/authlist</code> - 查看已授权手机号名录`,
      markup: {
        inline_keyboard: [
          [
            { text: '👥 全服玩家与积分', callback_data: '/players' },
            { text: '📱 授权手机号列表', callback_data: '/authlist' }
          ],
          [
            { text: '🏆 全服风云榜', callback_data: '/rank' },
            { text: '📊 游戏全局统计', callback_data: '/stats' }
          ]
        ]
      },
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);

  // 4. Webhook 状态
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);
  const [webhookActionResult, setWebhookActionResult] = useState<string | null>(null);

  // 初始化加载数据
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    loadBotStatus();
    loadPlayersAndAuth();
  };

  const loadPlayersAndAuth = () => {
    const users = getAllUsersList();
    setAllPlayers(users);
    setAuthorizedPhonesList(getAuthorizedPhones());

    // 如果未选定玩家且列表有玩家，默认选定第一个
    if (!selectedPlayer && users.length > 0) {
      handleSelectPlayer(users[0]);
    } else if (selectedPlayer) {
      // 刷新选定玩家的信息
      const refreshed = users.find(u => u.phone === selectedPlayer.phone);
      if (refreshed) {
        setSelectedPlayer(refreshed);
        setPlayerTxs(getPointsTransactions(refreshed.phone));
      }
    }
  };

  const loadBotStatus = async () => {
    setIsLoadingStatus(true);
    const status = await ApiClient.getTelegramBotStatus();
    setBotStatus(status);
    setIsLoadingStatus(false);
  };

  const handleSelectPlayer = (player: UserAccount) => {
    setSelectedPlayer(player);
    setPlayerTxs(getPointsTransactions(player.phone));
    setActionFeedback(null);
  };

  // 搜索玩家
  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      loadPlayersAndAuth();
      return;
    }
    const res = searchUserByPhone(searchQuery.trim());
    if (res.success && res.user) {
      setSelectedPlayer(res.user);
      setPlayerTxs(getPointsTransactions(res.user.phone));
      setActionFeedback(null);
    } else {
      setActionFeedback({ type: 'error', text: res.message || '未找到匹配的玩家' });
    }
  };

  // 积分调增 / 调减
  const handleAdjustPoints = (delta: number) => {
    if (!selectedPlayer) return;
    const res = adminAdjustPoints(selectedPlayer.phone, delta);
    if (res.success && res.account) {
      setSelectedPlayer(res.account);
      setPlayerTxs(getPointsTransactions(res.account.phone));
      setAllPlayers(getAllUsersList());
      setActionFeedback({ type: 'success', text: res.message });
      if (onRefreshCurrentAccount) onRefreshCurrentAccount();
    } else {
      setActionFeedback({ type: 'error', text: res.message });
    }
  };

  // 自定义增减积分
  const handleCustomPointsAction = (isAdd: boolean) => {
    if (!selectedPlayer) return;
    const amount = parseInt(customPointsInput, 10);
    if (isNaN(amount) || amount <= 0) {
      setActionFeedback({ type: 'error', text: '请输入大于 0 的有效积分数量' });
      return;
    }
    handleAdjustPoints(isAdd ? amount : -amount);
    setCustomPointsInput('');
  };

  // 设定为指定积分
  const handleSetPointsDirect = () => {
    if (!selectedPlayer) return;
    const amount = parseInt(customPointsInput, 10);
    if (isNaN(amount) || amount < 0) {
      setActionFeedback({ type: 'error', text: '请输入大于等于 0 的有效积分目标值' });
      return;
    }
    const res = adminSetPoints(selectedPlayer.phone, amount);
    if (res.success && res.account) {
      setSelectedPlayer(res.account);
      setPlayerTxs(getPointsTransactions(res.account.phone));
      setAllPlayers(getAllUsersList());
      setActionFeedback({ type: 'success', text: res.message });
      setCustomPointsInput('');
      if (onRefreshCurrentAccount) onRefreshCurrentAccount();
    } else {
      setActionFeedback({ type: 'error', text: res.message });
    }
  };

  // 授权手机号
  const handleAuthorizePhone = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthFeedback(null);
    if (!newAuthPhoneInput.trim()) {
      setAuthFeedback({ type: 'error', text: '请输入要授权的手机号码' });
      return;
    }
    const res = authorizePhone(newAuthPhoneInput.trim());
    setAuthorizedPhonesList(res.list);
    if (res.success) {
      setAuthFeedback({ type: 'success', text: res.message });
      setNewAuthPhoneInput('');
    } else {
      setAuthFeedback({ type: 'error', text: res.message });
    }
  };

  // 取消授权
  const handleRevokePhone = (phone: string) => {
    const res = revokePhone(phone);
    setAuthorizedPhonesList(res.list);
    setAuthFeedback({ type: 'success', text: res.message });
  };

  // 执行终端指令
  const handleSendCommand = async (cmd: string) => {
    if (!cmd.trim() || isExecutingCommand) return;
    const cleanCmd = cmd.trim();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setTerminalHistory(prev => [...prev, { sender: 'user', text: cleanCmd, time: timeStr }]);
    setCommandInput('');
    setIsExecutingCommand(true);

    try {
      const result = await ApiClient.simulateTelegramCommand(cleanCmd);
      if (result.ok && result.response) {
        setTerminalHistory(prev => [
          ...prev,
          {
            sender: 'bot',
            text: result.response.text,
            markup: result.response.reply_markup,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        // 同步刷新本地数据
        loadPlayersAndAuth();
        if (onRefreshCurrentAccount) onRefreshCurrentAccount();
      }
    } catch {
      setTerminalHistory(prev => [
        ...prev,
        {
          sender: 'bot',
          text: `❌ 执行失败，请重试。`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
    setIsExecutingCommand(false);
  };

  const handleCopyWebhookUrl = () => {
    if (!botStatus?.recommendedWebhookUrl) return;
    navigator.clipboard.writeText(botStatus.recommendedWebhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  const handleSetWebhook = async () => {
    setIsSettingWebhook(true);
    setWebhookActionResult(null);
    const res = await ApiClient.setTelegramWebhook(botStatus?.recommendedWebhookUrl);
    if (res.ok) {
      setWebhookActionResult('✅ Webhook 设置成功！Telegram 消息将实时推送。');
      await loadBotStatus();
    } else {
      setWebhookActionResult(`❌ 设置失败: ${res.description || res.message || '请检查环境变量 TELEGRAM_BOT_TOKEN'}`);
    }
    setIsSettingWebhook(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/70 rounded-3xl shadow-2xl max-w-4xl w-full text-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-sky-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white">Bot 管理员中心</h3>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                  授权注册 & 积分管控
                </span>
              </div>
              <p className="text-xs text-slate-400">
                手机号注册授权 · 玩家档案搜索 · 积分增减调整 · Telegram 机器人联动
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoadingStatus}
              title="刷新数据"
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingStatus ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-900/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab('players')}
            className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition whitespace-nowrap -mb-px ${
              activeTab === 'players'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Coins className="w-4 h-4" />
            玩家积分管理 ({allPlayers.length})
          </button>
          <button
            onClick={() => setActiveTab('auth')}
            className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition whitespace-nowrap -mb-px ${
              activeTab === 'auth'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Phone className="w-4 h-4" />
            手机号注册授权 ({authorizedPhonesList.length})
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition whitespace-nowrap -mb-px ${
              activeTab === 'terminal'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Bot 指令交互终端
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition whitespace-nowrap -mb-px ${
              activeTab === 'guide'
                ? 'border-emerald-500 text-emerald-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Telegram 配置与指南
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm bg-slate-950/40">
          {/* TAB 1: 玩家积分与档案管理 */}
          {activeTab === 'players' && (
            <div className="space-y-6">
              {/* 搜索框 */}
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="输入手机号或玩家昵称进行搜索..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition flex items-center gap-1.5 shadow-md shadow-emerald-900/40"
                >
                  <Search className="w-4 h-4" />
                  搜索玩家
                </button>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      loadPlayersAndAuth();
                    }}
                    className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                  >
                    重置
                  </button>
                )}
              </form>

              {/* 提示消息 */}
              {actionFeedback && (
                <div
                  className={`p-3 rounded-xl flex items-center gap-2 text-xs border ${
                    actionFeedback.type === 'success'
                      ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/60 border-rose-800 text-rose-300'
                  }`}
                >
                  {actionFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  )}
                  <span>{actionFeedback.text}</span>
                </div>
              )}

              {/* 主操作区：左侧玩家列表，右侧选定玩家积分操作面板 */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                {/* 玩家列表 */}
                <div className="md:col-span-5 border border-slate-800 bg-slate-900/80 rounded-2xl p-3 flex flex-col h-[380px]">
                  <div className="text-xs font-semibold text-slate-400 mb-2 px-1 flex items-center justify-between">
                    <span>已注册玩家名录</span>
                    <span className="text-emerald-400 font-mono">{allPlayers.length} 位</span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                    {allPlayers.length === 0 ? (
                      <div className="text-center py-10 text-slate-500 text-xs">暂无已注册玩家</div>
                    ) : (
                      allPlayers.map(p => {
                        const isSelected = selectedPlayer?.phone === p.phone;
                        return (
                          <button
                            key={p.phone}
                            onClick={() => handleSelectPlayer(p)}
                            className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between ${
                              isSelected
                                ? 'bg-emerald-950/50 border-emerald-600 text-white'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-xl">{p.avatar}</span>
                              <div className="truncate">
                                <div className="font-semibold text-xs text-white truncate">{p.nickname}</div>
                                <div className="text-[11px] text-slate-400 font-mono">{p.phone}</div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-bold text-xs text-amber-400 font-mono">
                                {p.points.toLocaleString()}
                              </div>
                              <div className="text-[10px] text-slate-500">积分</div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 选定玩家详情 & 积分增减面板 */}
                <div className="md:col-span-7 border border-slate-800 bg-slate-900/80 rounded-2xl p-4 flex flex-col justify-between">
                  {selectedPlayer ? (
                    <div className="space-y-4">
                      {/* 玩家档案卡片 */}
                      <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl p-1 bg-slate-900 rounded-xl border border-slate-800">
                            {selectedPlayer.avatar}
                          </span>
                          <div>
                            <div className="font-bold text-white text-base flex items-center gap-2">
                              {selectedPlayer.nickname}
                              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                                正常状态
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="w-3.5 h-3.5 text-slate-500" />
                              {selectedPlayer.phone}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-400">当前可用积分</div>
                          <div className="text-xl font-bold text-amber-400 font-mono">
                            {selectedPlayer.points.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* 快捷增减操作 */}
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                          <span>一键快捷增减积分</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => handleAdjustPoints(1000)}
                            className="py-2 px-2 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-800/80 text-emerald-300 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1"
                          >
                            <PlusCircle className="w-3.5 h-3.5" /> +1,000 分
                          </button>
                          <button
                            onClick={() => handleAdjustPoints(5000)}
                            className="py-2 px-2 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-800/80 text-emerald-300 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1"
                          >
                            <PlusCircle className="w-3.5 h-3.5" /> +5,000 分
                          </button>
                          <button
                            onClick={() => handleAdjustPoints(20000)}
                            className="py-2 px-2 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-800/80 text-emerald-300 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1"
                          >
                            <PlusCircle className="w-3.5 h-3.5" /> +20,000 分
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => handleAdjustPoints(-1000)}
                            className="py-2 px-2 bg-rose-950/70 hover:bg-rose-900 border border-rose-800/80 text-rose-300 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1"
                          >
                            <MinusCircle className="w-3.5 h-3.5" /> -1,000 分
                          </button>
                          <button
                            onClick={() => handleAdjustPoints(-5000)}
                            className="py-2 px-2 bg-rose-950/70 hover:bg-rose-900 border border-rose-800/80 text-rose-300 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1"
                          >
                            <MinusCircle className="w-3.5 h-3.5" /> -5,000 分
                          </button>
                          <button
                            onClick={() => handleAdjustPoints(-20000)}
                            className="py-2 px-2 bg-rose-950/70 hover:bg-rose-900 border border-rose-800/80 text-rose-300 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1"
                          >
                            <MinusCircle className="w-3.5 h-3.5" /> -20,000 分
                          </button>
                        </div>
                      </div>

                      {/* 自定义调整输入框 */}
                      <div className="space-y-2 pt-1 border-t border-slate-800">
                        <div className="text-xs font-semibold text-slate-300">精准数值调整 / 积分设定</div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={customPointsInput}
                            onChange={e => setCustomPointsInput(e.target.value)}
                            placeholder="输入积分数值..."
                            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                          />
                          <button
                            onClick={() => handleCustomPointsAction(true)}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition"
                          >
                            ➕ 增加
                          </button>
                          <button
                            onClick={() => handleCustomPointsAction(false)}
                            className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-medium transition"
                          >
                            ➖ 扣减
                          </button>
                          <button
                            onClick={handleSetPointsDirect}
                            className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-medium transition"
                          >
                            🎯 设为
                          </button>
                        </div>
                      </div>

                      {/* 最近流水 */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-800">
                        <div className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                          <History className="w-3.5 h-3.5" />
                          <span>该玩家最近积分收支流水</span>
                        </div>
                        <div className="max-h-24 overflow-y-auto space-y-1 pr-1 text-xs">
                          {playerTxs.length === 0 ? (
                            <div className="text-slate-500 text-[11px]">暂无流水明细</div>
                          ) : (
                            playerTxs.slice(0, 4).map(tx => (
                              <div
                                key={tx.id}
                                className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950/40 border border-slate-800/60 text-[11px]"
                              >
                                <span className="text-slate-300 truncate max-w-[180px]">{tx.title}</span>
                                <span
                                  className={`font-mono font-semibold ${
                                    tx.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  {tx.amount >= 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-20 text-slate-500 text-xs">
                      请从左侧选择玩家，或在上方搜索玩家
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 手机号注册授权管理 */}
          {activeTab === 'auth' && (
            <div className="space-y-6">
              {/* 顶部说明 */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-800/60 flex items-start gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white text-sm">Bot 手机号授权注册机制 (Whitelist)</div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    本系统已开启严格的安全准入管控：<b>仅在下方授权白名单中的手机号才允许注册新账号</b>。未授权的手机号在注册时将被系统阻断。Bot 管理员可随时在此处或通过 Bot 指令（<code>/auth 手机号</code>）添加授权。
                  </p>
                </div>
              </div>

              {/* 授权表单 */}
              <form onSubmit={handleAuthorizePhone} className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={newAuthPhoneInput}
                    onChange={e => setNewAuthPhoneInput(e.target.value)}
                    placeholder="输入需要授权注册的手机号（例如：13912345678）..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition flex items-center gap-1.5 shadow-md shadow-emerald-900/40"
                >
                  <Unlock className="w-4 h-4" />
                  授权该手机号注册
                </button>
              </form>

              {/* 反馈消息 */}
              {authFeedback && (
                <div
                  className={`p-3 rounded-xl flex items-center gap-2 text-xs border ${
                    authFeedback.type === 'success'
                      ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/60 border-rose-800 text-rose-300'
                  }`}
                >
                  {authFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  )}
                  <span>{authFeedback.text}</span>
                </div>
              )}

              {/* 已授权手机号列表 */}
              <div className="border border-slate-800 bg-slate-900/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
                  <span>已授权注册的手机号列表</span>
                  <span className="text-emerald-400 font-mono">共 {authorizedPhonesList.length} 个授权号码</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {authorizedPhonesList.map((phone, idx) => {
                    const isRegistered = allPlayers.some(p => p.phone === phone);
                    const registeredPlayer = allPlayers.find(p => p.phone === phone);

                    return (
                      <div
                        key={phone}
                        className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between group hover:border-slate-700 transition"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                            <span className="text-slate-500 text-[10px]">#{idx + 1}</span>
                            {phone}
                          </div>
                          <div className="text-[11px] mt-0.5 flex items-center gap-1">
                            {isRegistered ? (
                              <span className="text-emerald-400 flex items-center gap-0.5">
                                <Check className="w-3 h-3" /> 已注册 ({registeredPlayer?.nickname})
                              </span>
                            ) : (
                              <span className="text-amber-400">待注册 (可直接注册)</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRevokePhone(phone)}
                          title="取消授权"
                          className="text-slate-500 hover:text-rose-400 p-1.5 hover:bg-slate-800 rounded-lg transition"
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Bot 指令交互终端 */}
          {activeTab === 'terminal' && (
            <div className="space-y-4">
              {/* 快捷指令区 */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <span className="text-slate-400 shrink-0">快捷指令:</span>
                <button
                  onClick={() => handleSendCommand('/players')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shrink-0 transition font-mono"
                >
                  /players 玩家积分
                </button>
                <button
                  onClick={() => handleSendCommand('/authlist')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shrink-0 transition font-mono"
                >
                  /authlist 授权列表
                </button>
                <button
                  onClick={() => handleSendCommand('/rank')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shrink-0 transition font-mono"
                >
                  /rank 积分榜
                </button>
                <button
                  onClick={() => handleSendCommand('/stats')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shrink-0 transition font-mono"
                >
                  /stats 数据统计
                </button>
                <button
                  onClick={() => handleSendCommand('/help')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shrink-0 transition font-mono"
                >
                  /help 指令帮助
                </button>
              </div>

              {/* 终端模拟窗口 */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs flex flex-col h-[340px] shadow-inner">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-slate-500 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
                    <span className="ml-2 text-slate-400">Telegram Bot Terminal Session</span>
                  </div>
                  <span className="text-emerald-400">ONLINE</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1">
                  {terminalHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col ${
                        item.sender === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl p-3 leading-relaxed whitespace-pre-wrap ${
                          item.sender === 'user'
                            ? 'bg-emerald-600 text-white rounded-br-none'
                            : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                        }`}
                      >
                        <div dangerouslySetInnerHTML={{ __html: item.text }} />

                        {/* Inline Keyboard Simulation */}
                        {item.markup?.inline_keyboard && (
                          <div className="mt-3 pt-2 border-t border-slate-800/80 flex flex-col gap-1.5">
                            {item.markup.inline_keyboard.map((row: any[], rIdx: number) => (
                              <div key={rIdx} className="flex gap-1.5 flex-wrap">
                                {row.map((btn: any, bIdx: number) => (
                                  <button
                                    key={bIdx}
                                    onClick={() => handleSendCommand(btn.callback_data)}
                                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 rounded-lg text-[11px] font-sans transition"
                                  >
                                    {btn.text}
                                  </button>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 px-1">{item.time}</span>
                    </div>
                  ))}
                  {isExecutingCommand && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>正在执行指令...</span>
                    </div>
                  )}
                </div>

                {/* 指令输入栏 */}
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleSendCommand(commandInput);
                  }}
                  className="flex gap-2 pt-2 border-t border-slate-800"
                >
                  <input
                    type="text"
                    value={commandInput}
                    onChange={e => setCommandInput(e.target.value)}
                    placeholder="输入指令，如 /score 13800138000 或 /add 13800138000 5000..."
                    className="flex-1 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={isExecutingCommand || !commandInput.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-medium transition flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    发送
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 4: Telegram 连接配置与指南 */}
          {activeTab === 'guide' && (
            <div className="space-y-5">
              {/* Bot 状态卡片 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900 flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      botStatus?.hasBotToken
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-amber-500/10 text-amber-400'
                    }`}
                  >
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-slate-400">Telegram Bot 状态</div>
                    <div className="font-semibold text-white truncate text-xs">
                      {botStatus?.hasBotToken
                        ? botStatus.botUsername
                          ? `@${botStatus.botUsername}`
                          : '已配置 Token'
                        : '未配置 Token (支持应用内终端直接使用)'}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900 flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      botStatus?.webhookInfo?.url
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-slate-400">Webhook 实时回调</div>
                    <div className="font-semibold text-white truncate text-xs">
                      {botStatus?.webhookInfo?.url ? '已连接 Webhook' : '未连接 Webhook'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Webhook 一键同步 */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="font-semibold text-white text-xs">Webhook 回调地址</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={botStatus?.recommendedWebhookUrl || ''}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 font-mono text-xs select-all"
                  />
                  <button
                    onClick={handleCopyWebhookUrl}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs flex items-center gap-1.5 transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedWebhook ? '已复制' : '复制'}
                  </button>
                  <button
                    onClick={handleSetWebhook}
                    disabled={isSettingWebhook}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSettingWebhook ? 'animate-spin' : ''}`} />
                    一键同步
                  </button>
                </div>
                {webhookActionResult && (
                  <div className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    {webhookActionResult}
                  </div>
                )}
              </div>

              {/* 核心指令参考表 */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                <div className="font-semibold text-white">Bot 指令一览表</div>
                <div className="space-y-1.5 text-slate-300">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <code>/auth &lt;手机号&gt;</code>
                    <span className="text-slate-400">授权该手机号注册新账号</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <code>/unauth &lt;手机号&gt;</code>
                    <span className="text-slate-400">取消手机号的注册授权</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <code>/authlist</code>
                    <span className="text-slate-400">查看所有已授权手机号名录</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <code>/score &lt;手机号/昵称&gt;</code>
                    <span className="text-slate-400">查看玩家积分余额与档案</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <code>/add &lt;手机号&gt; &lt;数量&gt;</code>
                    <span className="text-slate-400">为玩家增加指定积分</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <code>/del &lt;手机号&gt; &lt;数量&gt;</code>
                    <span className="text-slate-400">为玩家扣减指定积分</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <code>/set &lt;手机号&gt; &lt;数量&gt;</code>
                    <span className="text-slate-400">设定玩家积分为具体数值</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <code>/players</code>
                    <span className="text-slate-400">列出全服已注册玩家及当前积分</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
