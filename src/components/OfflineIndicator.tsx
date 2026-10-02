import React, { useEffect, useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff, Wifi } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [showOnlineToast, setShowOnlineToast] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowOnlineToast(false);
    } else if (wasOffline) {
      setShowOnlineToast(true);
      const timer = setTimeout(() => {
        setShowOnlineToast(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (!isOnline) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/95 text-amber-300 text-xs font-semibold shadow-xl border border-amber-500/40 backdrop-blur-md animate-bounce"
      >
        <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>离线模式 · 已启用本地离线缓存</span>
      </aside>
    );
  }

  if (showOnlineToast) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/95 text-emerald-300 text-xs font-semibold shadow-xl border border-emerald-500/50 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-300"
      >
        <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>已恢复网络连接</span>
      </aside>
    );
  }

  return null;
};
