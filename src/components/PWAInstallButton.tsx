import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share, PlusSquare, CheckCircle2, X } from 'lucide-react';

interface PWAInstallButtonProps {
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running in standalone PWA mode, suppress the button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <>
      {/* Chromium / Android / Desktop Flow */}
      {isInstallable && (
        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          id="pwa-install-header-btn"
          title="将十三水安装到手机或桌面，享受全屏无卡顿原生体验"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-amber-300 animate-pulse ${className}`}
        >
          <Download className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>安装客户端</span>
        </button>
      )}

      {/* iOS Safari Flow (WebKit doesn't fire beforeinstallprompt) */}
      {!isInstallable && isIOS && (
        <button
          onClick={() => setShowIOSGuide(true)}
          id="pwa-ios-install-header-btn"
          title="添加到 iPhone / iPad 主屏幕"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-amber-300 font-bold text-xs border border-amber-500/40 backdrop-blur-sm transition-all active:scale-95 cursor-pointer ${className}`}
        >
          <Download className="w-3.5 h-3.5 text-amber-400" />
          <span>加到主屏幕</span>
        </button>
      )}

      {/* iOS Safari Step-by-Step Installation Modal */}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-slate-900 via-emerald-950 to-slate-950 p-6 border-2 border-amber-500/50 shadow-2xl text-slate-100 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* App Icon & Title */}
            <div className="flex items-center gap-3 mb-5">
              <img
                src="/icon.svg"
                alt="十三水"
                className="w-12 h-12 rounded-2xl shadow-lg border border-amber-400/40"
              />
              <div>
                <h3 className="text-base font-black text-amber-300">安装至 iPhone / iPad</h3>
                <p className="text-xs text-slate-400">一键添加主屏幕 · 全屏畅玩更沉浸</p>
              </div>
            </div>

            {/* Step 1 & 2 instructions */}
            <div className="space-y-3.5 text-xs text-slate-200 bg-slate-950/60 p-4 rounded-2xl border border-emerald-900/60">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0 mt-0.5 border border-amber-500/30">
                  1
                </div>
                <div>
                  <p className="font-semibold text-amber-200">轻点 Safari 底部导航栏的【分享】按钮</p>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    即带有向上箭头的方形图标 <Share className="w-3.5 h-3.5 text-amber-300 inline" />
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0 mt-0.5 border border-amber-500/30">
                  2
                </div>
                <div>
                  <p className="font-semibold text-amber-200">在菜单中向下滑动，轻点【添加到主屏幕】</p>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    选择 <PlusSquare className="w-3.5 h-3.5 text-amber-300 inline" /> 添加到主屏幕
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0 mt-0.5 border border-emerald-500/30">
                  3
                </div>
                <div>
                  <p className="font-semibold text-emerald-300">点击右上角【添加】完成安装</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    返回手机桌面即可像原生 App 一样直接启动十三水！
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs hover:from-amber-400 hover:to-amber-500 transition shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </>
  );
};
