import React, { useState } from 'react';
import { ApiClient, InitResponse } from '../api';
import { Database, CheckCircle2, AlertTriangle, RefreshCw, X, Server, Code, ShieldCheck } from 'lucide-react';

interface D1StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  d1Status: InitResponse | null;
  onRefresh: () => void;
}

export function D1StatusModal({ isOpen, onClose, d1Status, onRefresh }: D1StatusModalProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<InitResponse | null>(null);

  if (!isOpen) return null;

  const current = testResult || d1Status;

  const handleTestInit = async () => {
    setIsTesting(true);
    const res = await ApiClient.initializeDatabase();
    setTestResult(res);
    setIsTesting(false);
    onRefresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Cloudflare D1 数据库管理</h3>
              <p className="text-xs text-slate-500">打开页面自动建表 · 零配置持久化储存</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Status Alert */}
          <div
            className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
              current?.d1Bound
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
            }`}
          >
            {current?.d1Bound ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-bold text-sm">
                {current?.d1Bound ? '已成功连接 Cloudflare D1 数据库' : '当前运行于本地持久化模式 (LocalStorage)'}
              </div>
              <p className="text-xs opacity-90 leading-relaxed">
                {current?.message ||
                  '当部署在 Cloudflare Pages 并绑定 D1 时，每次打开游戏或访问 API 会自动执行 CREATE TABLE IF NOT EXISTS 语句。'}
              </p>
            </div>
          </div>

          {/* Database Tables Schema Preview */}
          <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600" />
              自动创建的数据表清单
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="font-mono font-bold text-blue-600 text-xs mb-1">players</div>
                <p className="text-xs text-slate-500">记录玩家胜场、积分、特殊牌统计与排行</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="font-mono font-bold text-indigo-600 text-xs mb-1">game_records</div>
                <p className="text-xs text-slate-500">保存每局比牌细节、前中后墩牌型与对手结算</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="font-mono font-bold text-emerald-600 text-xs mb-1">rooms</div>
                <p className="text-xs text-slate-500">多人在线开房、房号、玩家加入与同步出牌</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="font-mono font-bold text-amber-600 text-xs mb-1">system_meta</div>
                <p className="text-xs text-slate-500">系统元数据、建表迁移版本与最后校验时间</p>
              </div>
            </div>
          </div>

          {/* Cloudflare Pages Setup Instructions */}
          <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 space-y-2">
            <h4 className="font-bold text-blue-900 dark:text-blue-300 text-xs flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Cloudflare Pages 绑定 D1 说明
            </h4>
            <ol className="list-decimal list-inside text-xs text-blue-800 dark:text-blue-300/90 space-y-1 leading-relaxed">
              <li>在 Cloudflare 控制台创建 D1 数据库（例如命名为 <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded font-mono">thirteen-poker-db</code>）。</li>
              <li>进入你的 Pages 项目设置：<strong>Settings &gt; Functions &gt; D1 database bindings</strong>。</li>
              <li>点击 <strong>Add binding</strong>，变量名（Variable name）填写为 <code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded font-mono font-bold">DB</code>。</li>
              <li>重新部署后，打开网站任意页面即可<strong>全自动建表</strong>，无需手动执行 SQL 文件！</li>
            </ol>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {current?.stats ? `已记录 ${current.stats.totalGames} 局比赛 / ${current.stats.totalPlayers} 位玩家` : 'API 状态: 正常'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleTestInit}
              disabled={isTesting}
              className="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 transition flex items-center gap-2 text-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              {isTesting ? '正在校验...' : '执行建表校验 (Init)'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 transition text-xs"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
