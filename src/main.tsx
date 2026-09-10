import React, { StrictMode, ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  public props: Readonly<Props> & Readonly<{ children?: ReactNode }>;
  public state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
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

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center text-3xl mb-4">
            ⚠️
          </div>
          <h1 className="text-2xl font-black text-rose-400 mb-2">十三水 · 页面加载或运行异常</h1>
          <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            系统检测到页面数据或组件运行状态异常 ({this.state.error?.message || '未知错误'})。点击下方按钮可自动重置并恢复。
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                try {
                  localStorage.clear();
                } catch {}
                window.location.reload();
              }}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-lg transition active:scale-95 cursor-pointer"
            >
              重置缓存并恢复
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition active:scale-95 cursor-pointer"
            >
              刷新页面
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
