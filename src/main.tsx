import React, { Component, StrictMode, ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// 🚀 注册 PWA Service Worker (支持离线缓存和无缝自动更新)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('十三水 PWA 发现新版本，准备自动更新资源...');
    },
    onOfflineReady() {
      console.log('十三水 PWA 离线缓存资源已就绪，支持离线畅玩');
    },
  });
}

// 🛡️ 核心 DOM 防御补丁：防止浏览器内置翻译（如 Chrome / Edge 翻译插件）或第三方扩展篡改 DOM 导致 React 抛出
// "Failed to execute 'removeChild' on 'Node': The Node to be returned is not a child of this node."
if (typeof window !== 'undefined' && typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Prevented React removeChild crash from external DOM mutation:', child, this);
      }
      if (child.parentNode) {
        try {
          return child.parentNode.removeChild(child);
        } catch {
          return child;
        }
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Prevented React insertBefore crash from external DOM mutation:', referenceNode, this);
      }
      return this.appendChild(newNode) as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught Error in Thirteen Water App:', error, errorInfo);
  }

  handleSoftRecover = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || '未知错误';
      const isDomMismatch = errorMsg.includes('removeChild') || errorMsg.includes('insertBefore') || errorMsg.includes('not a child');

      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-3xl mb-4 animate-bounce">
            ⚡
          </div>
          <h1 className="text-2xl font-black text-amber-300 mb-2">十三水 · 运行状态自愈</h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            {isDomMismatch 
              ? '检测到移动端浏览器自动翻译或扩展修改了页面节点。已为您注入防御隔离层，点击下方立即自愈即可无损继续对局！'
              : `系统检测到页面组件临时状态异常 (${errorMsg})。您可以尝试自愈继续或刷新。`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={this.handleSoftRecover}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-lg transition active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <span>✨ 一键自愈继续对局</span>
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition active:scale-95 cursor-pointer"
            >
              刷新页面
            </button>
            <button
              onClick={() => {
                try {
                  localStorage.clear();
                } catch {}
                window.location.reload();
              }}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-750 hover:bg-slate-800 text-slate-400 hover:text-rose-400 font-medium text-xs transition active:scale-95 cursor-pointer"
            >
              重置缓存
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
