import React, { useState, useEffect, useRef } from 'react';
import { Bot, Terminal, Send, Sparkles, Trash2, CheckCircle2, ShieldAlert, Users, Phone, Coins, RefreshCw, X, HelpCircle, Layers } from 'lucide-react';
import { ApiClient } from '../api';

interface BotConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTableReset?: () => void;
}

interface MessageLog {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  replyMarkup?: {
    inline_keyboard?: Array<Array<{ text: string; callback_data: string }>>;
  };
  timestamp: number;
}

export function BotConsoleModal({ isOpen, onClose, onTableReset }: BotConsoleModalProps) {
  const [inputCommand, setInputCommand] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen && logs.length === 0) {
      // Initialize with welcome help menu
      handleExecuteCommand('/help');
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isLoading]);

  if (!isOpen) return null;

  const handleExecuteCommand = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed || isLoading) return;

    const userMsg: MessageLog = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text: trimmed,
      timestamp: Date.now()
    };

    setLogs(prev => [...prev, userMsg]);
    setInputCommand('');
    setIsLoading(true);

    try {
      const res = await ApiClient.simulateTelegramCommand(trimmed);
      const botMsg: MessageLog = {
        id: 'bot_' + Date.now(),
        sender: 'bot',
        text: res.response?.text || '指令已执行。',
        replyMarkup: res.response?.reply_markup,
        timestamp: Date.now()
      };
      setLogs(prev => [...prev, botMsg]);

      // If it's a clean command, trigger external table reset callback
      if (trimmed.startsWith('/clean') || trimmed.startsWith('/clear') || trimmed.startsWith('/reset') || trimmed.includes('清理')) {
        if (onTableReset) {
          onTableReset();
        }
      }
    } catch (err: any) {
      const errMsg: MessageLog = {
        id: 'bot_err_' + Date.now(),
        sender: 'bot',
        text: `❌ 执行失败: ${err.message || '网络或服务端异常'}`,
        timestamp: Date.now()
      };
      setLogs(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickClean = () => {
    handleExecuteCommand('/clean all');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-2xl bg-slate-900 border-2 border-indigo-500/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        
        {/* 1. Header */}
        <div className="w-full bg-gradient-to-r from-slate-950 via-indigo-950/80 to-slate-950 border-b border-indigo-500/30 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white">Bot 管理控制台</h3>
                <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Online
                </span>
              </div>
              <p className="text-[11px] text-indigo-300/80">
                支持执行清理残留、手机号授权、积分划拨与牌桌全服重置
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Quick Action Toolbar */}
        <div className="w-full bg-slate-950/90 border-b border-slate-800 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={handleQuickClean}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-red-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md hover:brightness-110 active:scale-95 transition whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>🧹 一键清理全服残留 (/clean all)</span>
          </button>

          <button
            onClick={() => handleExecuteCommand('/clean 888888')}
            disabled={isLoading}
            className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-bold flex items-center gap-1 border border-amber-500/40 transition whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className="w-3 h-3 text-amber-400" />
            <span>🧹 清理888888房间</span>
          </button>

          <button
            onClick={() => handleExecuteCommand('/authlist')}
            disabled={isLoading}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 border border-slate-700 transition whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <Phone className="w-3 h-3 text-cyan-400" />
            <span>📱 授权名录</span>
          </button>

          <button
            onClick={() => handleExecuteCommand('/players')}
            disabled={isLoading}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 border border-slate-700 transition whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <Users className="w-3 h-3 text-blue-400" />
            <span>👥 玩家名录</span>
          </button>

          <button
            onClick={() => handleExecuteCommand('/stats')}
            disabled={isLoading}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 border border-slate-700 transition whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <Layers className="w-3 h-3 text-emerald-400" />
            <span>📊 数据统计</span>
          </button>

          <button
            onClick={() => handleExecuteCommand('/help')}
            disabled={isLoading}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 border border-slate-700 transition whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <HelpCircle className="w-3 h-3 text-indigo-400" />
            <span>❓ 帮助菜单</span>
          </button>
        </div>

        {/* 3. Terminal Log View */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-[220px] max-h-[460px] overflow-y-auto p-3 sm:p-4 space-y-3 font-sans text-xs bg-slate-950/60"
        >
          {logs.map(log => {
            if (log.sender === 'user') {
              return (
                <div key={log.id} className="flex justify-end">
                  <div className="max-w-[85%] bg-indigo-600/90 text-white rounded-2xl rounded-tr-sm px-3.5 py-2 shadow-md flex items-center gap-2">
                    <Terminal className="w-3 h-3 opacity-75 shrink-0" />
                    <span className="font-mono font-bold">{log.text}</span>
                  </div>
                </div>
              );
            }

            return (
              <div key={log.id} className="flex justify-start">
                <div className="max-w-[90%] bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm p-3 shadow-lg space-y-2.5">
                  <div
                    className="text-slate-200 leading-relaxed break-words [&>b]:text-amber-300 [&>code]:bg-slate-950 [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded [&>code]:font-mono [&>code]:text-cyan-300 [&>code]:border [&>code]:border-slate-800 [&>i]:text-slate-400"
                    dangerouslySetInnerHTML={{ __html: log.text.replace(/\n/g, '<br/>') }}
                  />

                  {/* Inline Keyboard buttons if present */}
                  {log.replyMarkup?.inline_keyboard && (
                    <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-800/80">
                      {log.replyMarkup.inline_keyboard.map((row, rIdx) => (
                        <div key={rIdx} className="flex flex-wrap gap-1.5">
                          {row.map((btn, bIdx) => (
                            <button
                              key={bIdx}
                              onClick={() => handleExecuteCommand(btn.callback_data)}
                              disabled={isLoading}
                              className="flex-1 min-w-[120px] px-2.5 py-1.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-200 hover:text-white font-bold text-[11px] transition shadow-sm active:scale-95 cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                            >
                              <span>{btn.text}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-2 flex items-center gap-2 text-indigo-300">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Bot 正在执行指令并广播全网...</span>
              </div>
            </div>
          )}
        </div>

        {/* 4. Command Input Bar */}
        <div className="w-full bg-slate-950 border-t border-slate-800/90 p-2 sm:p-3 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleExecuteCommand(inputCommand);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs select-none">
                /
              </span>
              <input
                type="text"
                value={inputCommand}
                onChange={(e) => setInputCommand(e.target.value)}
                placeholder="输入命令如 /clean, /auth 13800000000, /add 13800000000 5000..."
                className="w-full pl-6 pr-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-white text-xs font-mono placeholder:text-slate-500 focus:outline-none focus:border-indigo-400 shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !inputCommand.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black text-xs rounded-xl shadow-md transition active:scale-95 cursor-pointer flex items-center gap-1 shrink-0 disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
              <span>发送</span>
            </button>
          </form>

          {/* Quick Command Hints */}
          <div className="flex items-center gap-2 mt-1.5 px-1 text-[10px] text-slate-400 overflow-x-auto no-scrollbar">
            <span className="text-slate-500 shrink-0">常用:</span>
            <button onClick={() => setInputCommand('/clean all')} className="hover:text-amber-300 font-mono underline shrink-0 cursor-pointer">/clean all</button>
            <button onClick={() => setInputCommand('/auth ')} className="hover:text-amber-300 font-mono underline shrink-0 cursor-pointer">/auth &lt;手机号&gt;</button>
            <button onClick={() => setInputCommand('/add ')} className="hover:text-amber-300 font-mono underline shrink-0 cursor-pointer">/add &lt;手机号&gt; 5000</button>
            <button onClick={() => setInputCommand('/score ')} className="hover:text-amber-300 font-mono underline shrink-0 cursor-pointer">/score &lt;手机号&gt;</button>
            <button onClick={() => setInputCommand('/players')} className="hover:text-amber-300 font-mono underline shrink-0 cursor-pointer">/players</button>
          </div>
        </div>

      </div>
    </div>
  );
}
