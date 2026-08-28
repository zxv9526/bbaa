import React, { useState, useEffect } from 'react';
import { ApiClient } from '../api';
import { TelegramBotStatus } from '../types';
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
  ExternalLink,
  Users,
  Trophy,
  BarChart2,
  Sparkles,
  KeyRound,
  Globe,
  HelpCircle,
  Clock
} from 'lucide-react';

interface TelegramAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TelegramAdminModal({ isOpen, onClose }: TelegramAdminModalProps) {
  const [activeTab, setActiveTab] = useState<'console' | 'admins' | 'guide'>('console');
  const [botStatus, setBotStatus] = useState<TelegramBotStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Score search input
  const [searchPlayerName, setSearchPlayerName] = useState('');

  // Terminal Simulator State
  const [commandInput, setCommandInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState<
    Array<{ sender: 'user' | 'bot'; text: string; markup?: any; time: string }>
  >([
    {
      sender: 'bot',
      text: `🃏 <b>十三水管理员机器人 (Telegram Bot Admin)</b> 已就绪！\n\n您可以在 Telegram 中直接向 Bot 发送指令查询全服玩家净胜积分、胜率及详细牌型流水。\n\n👇 <i>点击下方快捷指令或在输入框输入 <code>/score 玩家名</code> 开始查询：</i>`,
      markup: {
        inline_keyboard: [
          [
            { text: '🏆 全服风云榜', callback_data: '/rank' },
            { text: '📊 游戏全局统计', callback_data: '/stats' }
          ],
          [
            { text: '👥 活跃玩家列表', callback_data: '/players' },
            { text: '📜 最新对局历史', callback_data: '/history' }
          ]
        ]
      },
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);

  // Webhook action state
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);
  const [webhookActionResult, setWebhookActionResult] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadBotStatus();
    }
  }, [isOpen]);

  const loadBotStatus = async () => {
    setIsLoadingStatus(true);
    const status = await ApiClient.getTelegramBotStatus();
    setBotStatus(status);
    setIsLoadingStatus(false);
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
      setWebhookActionResult('✅ Webhook 设置成功！Telegram 消息将实时推送至本站点。');
      await loadBotStatus();
    } else {
      setWebhookActionResult(`❌ 设置失败: ${res.description || res.message || '请检查环境变量 TELEGRAM_BOT_TOKEN'}`);
    }
    setIsSettingWebhook(false);
  };

  const handleSendCommand = async (cmd: string) => {
    if (!cmd.trim() || isExecutingCommand) return;
    const cleanCmd = cmd.trim();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Add user command to terminal
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
      }
    } catch {
      setTerminalHistory(prev => [
        ...prev,
        {
          sender: 'bot',
          text: `❌ 执行失败，无法连接到机器人后端服务。`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
    setIsExecutingCommand(false);
  };

  const handleSearchPlayer = () => {
    if (!searchPlayerName.trim()) return;
    handleSendCommand(`/score ${searchPlayerName.trim()}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-sky-500/10 via-indigo-500/5 to-transparent dark:from-sky-500/20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-lg shadow-sky-500/25">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Telegram Bot 管理员中心</h3>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                  积分监控
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                通过 Telegram 实时查分 · 积分排行榜 · 全局数据监管
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadBotStatus}
              disabled={isLoadingStatus}
              title="刷新状态"
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingStatus ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={() => setActiveTab('console')}
            className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition -mb-px ${
              activeTab === 'console'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            控制台与查分终端
          </button>
          <button
            onClick={() => setActiveTab('admins')}
            className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition -mb-px ${
              activeTab === 'admins'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            已授权管理员 ({botStatus?.dbAdmins?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition -mb-px ${
              activeTab === 'guide'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            一键配置与指令指引
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm bg-slate-50/30 dark:bg-slate-950/30">
          {/* Status summary banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  botStatus?.hasBotToken
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}
              >
                <Bot className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-slate-500 dark:text-slate-400">Telegram 机器人</div>
                <div className="font-semibold text-slate-800 dark:text-white truncate text-xs">
                  {botStatus?.hasBotToken
                    ? botStatus.botUsername
                      ? `@${botStatus.botUsername}`
                      : '已配置 Token'
                    : '未配置 Token'}
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  botStatus?.webhookInfo?.url
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-500/10 text-slate-500'
                }`}
              >
                <Globe className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-slate-500 dark:text-slate-400">Webhook 状态</div>
                <div className="font-semibold text-slate-800 dark:text-white truncate text-xs">
                  {botStatus?.webhookInfo?.url ? '已成功连接' : '就绪待绑定'}
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-slate-500 dark:text-slate-400">数据库绑定</div>
                <div className="font-semibold text-slate-800 dark:text-white truncate text-xs">
                  {botStatus?.d1Bound ? 'Cloudflare D1 (在线)' : '本地持久化模式'}
                </div>
              </div>
            </div>
          </div>

          {/* TAB 1: Console & Score Explorer */}
          {activeTab === 'console' && (
            <div className="space-y-4">
              {/* Quick Player Search Box */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-xs">
                    <Search className="w-4 h-4 text-sky-500" />
                    <span>快速查询玩家积分档案</span>
                  </div>
                  <span className="text-[11px] text-slate-400">输入昵称即刻获取总分、胜率与流水</span>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="输入玩家昵称 (例如: 玩家_1234, 雀圣阿旺)..."
                      value={searchPlayerName}
                      onChange={e => setSearchPlayerName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearchPlayer()}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                  <button
                    onClick={handleSearchPlayer}
                    disabled={!searchPlayerName.trim() || isExecutingCommand}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 active:scale-95 disabled:opacity-50 text-white font-medium rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm"
                  >
                    <Search className="w-3.5 h-3.5" />
                    查分
                  </button>
                </div>

                {/* Quick Action Chips */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => handleSendCommand('/rank')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-sky-950/40 dark:hover:text-sky-300 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-1.5 transition"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    全服积分榜 (/rank)
                  </button>
                  <button
                    onClick={() => handleSendCommand('/stats')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-sky-950/40 dark:hover:text-sky-300 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-1.5 transition"
                  >
                    <BarChart2 className="w-3.5 h-3.5 text-indigo-500" />
                    全局统计 (/stats)
                  </button>
                  <button
                    onClick={() => handleSendCommand('/players')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-sky-950/40 dark:hover:text-sky-300 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-1.5 transition"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-500" />
                    活跃玩家 (/players)
                  </button>
                  <button
                    onClick={() => handleSendCommand('/history')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-sky-950/40 dark:hover:text-sky-300 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-1.5 transition"
                  >
                    <Clock className="w-3.5 h-3.5 text-rose-500" />
                    最新流水 (/history)
                  </button>
                  <button
                    onClick={() => handleSendCommand('/help')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-sky-950/40 dark:hover:text-sky-300 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-1.5 transition"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-sky-500" />
                    指令菜单 (/help)
                  </button>
                </div>
              </div>

              {/* Live Telegram Bot Command Simulator */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 text-slate-100 flex flex-col shadow-inner overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-mono font-medium text-slate-300">Telegram Bot Terminal</span>
                  </div>
                  <span className="text-[11px] text-slate-500">模拟管理员交互 & 查询结果即时预览</span>
                </div>

                {/* Messages Container */}
                <div className="p-4 space-y-4 max-h-72 overflow-y-auto font-sans text-xs">
                  {terminalHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col ${item.sender === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 px-1">
                        <span>{item.sender === 'user' ? '👤 管理员' : '🤖 十三水 Bot'}</span>
                        <span>·</span>
                        <span>{item.time}</span>
                      </div>
                      <div
                        className={`p-3 rounded-2xl max-w-[90%] whitespace-pre-wrap leading-relaxed shadow-sm ${
                          item.sender === 'user'
                            ? 'bg-sky-600 text-white rounded-br-none'
                            : 'bg-slate-800/90 text-slate-100 border border-slate-700/60 rounded-bl-none'
                        }`}
                        dangerouslySetInnerHTML={{ __html: item.text }}
                      />

                      {/* Inline Buttons Preview */}
                      {item.markup?.inline_keyboard && (
                        <div className="mt-2 space-y-1.5 w-full max-w-[90%]">
                          {item.markup.inline_keyboard.map((row: any[], rIdx: number) => (
                            <div key={rIdx} className="flex gap-1.5">
                              {row.map((btn: any, bIdx: number) => (
                                <button
                                  key={bIdx}
                                  onClick={() => handleSendCommand(btn.callback_data)}
                                  className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-sky-600/30 border border-slate-700 hover:border-sky-500/50 rounded-xl text-sky-400 hover:text-sky-300 text-xs font-medium transition text-center active:scale-95"
                                >
                                  {btn.text}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {isExecutingCommand && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                      <span>正在从 D1 数据库获取玩家数据...</span>
                    </div>
                  )}
                </div>

                {/* Command Input Bar */}
                <div className="p-2.5 bg-slate-950 border-t border-slate-800 flex gap-2">
                  <input
                    type="text"
                    value={commandInput}
                    onChange={e => setCommandInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendCommand(commandInput)}
                    placeholder="输入指令 (例如: /score 玩家名, /rank, /stats, /help)..."
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                  />
                  <button
                    onClick={() => handleSendCommand(commandInput)}
                    disabled={!commandInput.trim() || isExecutingCommand}
                    className="px-3 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl text-xs font-medium flex items-center gap-1 transition active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    发送
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Bound Admins */}
          {activeTab === 'admins' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white text-sm">
                      已授权 Telegram 管理员名单
                    </h4>
                    <p className="text-xs text-slate-500">
                      拥有通过 Telegram 查看全服玩家积分与游戏记录权限的用户
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                    共 {botStatus?.dbAdmins?.length || 0} 位已绑定
                  </span>
                </div>

                {botStatus?.dbAdmins && botStatus.dbAdmins.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                    {botStatus.dbAdmins.map((admin, idx) => (
                      <div key={idx} className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold text-xs">
                            TG
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{admin.first_name || 'Telegram User'}</span>
                              {admin.username && (
                                <span className="text-xs text-sky-600 dark:text-sky-400 font-mono">
                                  @{admin.username}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              Chat ID: {admin.chat_id} · 授权时间: {admin.created_at || '最近'}
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          {admin.role || 'Admin'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
                    <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
                    <div className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                      暂无已绑定的 Telegram 管理员
                    </div>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      在 Telegram 中向您的 Bot 发送 <code className="text-sky-600 font-mono">/auth 您的密码</code> 即可自动绑定并列入此名单。
                    </p>
                  </div>
                )}
              </div>

              {/* Password info box */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start gap-3">
                <KeyRound className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-slate-800 dark:text-white">
                    管理员密码授权机制
                  </div>
                  <p className="text-slate-500 leading-relaxed">
                    任何被邀请的管理人员，只需在 Telegram 对话窗口中向 Bot 发送{' '}
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-sky-600 dark:text-sky-400 font-mono">
                      /auth &lt;密码&gt;
                    </code>
                    ，即可完成权限验证并无限制查询全服积分明细。密码可通过 Cloudflare 环境变量{' '}
                    <code className="text-slate-700 dark:text-slate-300 font-mono">
                      TELEGRAM_ADMIN_PASSWORD
                    </code>{' '}
                    自定义。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Setup Guide */}
          {activeTab === 'guide' && (
            <div className="space-y-4">
              {/* Webhook Configuration Widget */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-900 dark:text-white text-xs flex items-center gap-2">
                    <Globe className="w-4 h-4 text-sky-500" />
                    <span>Cloudflare Webhook 接收端点</span>
                  </div>
                  <span className="text-[11px] text-slate-400">供 Telegram 推送用户消息</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs text-slate-700 dark:text-slate-300 truncate">
                    {botStatus?.recommendedWebhookUrl || `${window.location.origin}/api/telegram`}
                  </div>
                  <button
                    onClick={handleCopyWebhookUrl}
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1 transition shrink-0"
                  >
                    {copiedWebhook ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedWebhook ? '已复制' : '复制'}
                  </button>
                  <button
                    onClick={handleSetWebhook}
                    disabled={isSettingWebhook}
                    className="px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-medium flex items-center gap-1 transition shrink-0 shadow-sm"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isSettingWebhook ? 'animate-spin' : ''}`} />
                    一键绑定 Webhook
                  </button>
                </div>

                {webhookActionResult && (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                    {webhookActionResult}
                  </div>
                )}
              </div>

              {/* 3-Step Setup Instructions */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h4 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Bot className="w-4 h-4 text-sky-500" />
                  3 步快速接入 Telegram 管理员 Bot
                </h4>

                <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-sky-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        创建 Telegram Bot
                      </div>
                      <p className="text-slate-500">
                        在 Telegram 中搜索 <span className="font-mono text-sky-600">@BotFather</span>，发送{' '}
                        <code className="font-mono">/newbot</code>，按照提示设定 Bot 名字，获取 API Token (如{' '}
                        <code className="font-mono">123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11</code>)。
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-sky-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      2
                    </div>
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        配置 Cloudflare Pages 环境变量
                      </div>
                      <p className="text-slate-500">
                        在 Cloudflare 控制台 -&gt; <b>Pages</b> -&gt; 项目设置 -&gt; <b>Environment variables</b> 添加：
                      </p>
                      <ul className="list-disc list-inside space-y-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        <li><code>TELEGRAM_BOT_TOKEN</code>: 您的 Bot Token</li>
                        <li><code>TELEGRAM_ADMIN_PASSWORD</code>: 自定义管理密码 (默认 13poker888)</li>
                      </ul>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-sky-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      3
                    </div>
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        一键绑定 &amp; 授权查分
                      </div>
                      <p className="text-slate-500">
                        点击上方的【一键绑定 Webhook】，然后打开您的 Telegram Bot 发送{' '}
                        <code className="font-mono text-sky-600">/auth 您的密码</code>，即可随时随地在手机端监控全服玩家积分！
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>实时与 Cloudflare D1 数据库双向同步</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium rounded-xl text-xs transition"
          >
            完成并关闭
          </button>
        </div>
      </div>
    </div>
  );
}
