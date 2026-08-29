const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace the header section
const oldHeaderRegex = /\{\/\* 1\. Header Bar: Ultra clean, strict adherence to user request \*\/\}\n\s*<header className="shrink-0 border-b border-slate-800\/80 bg-slate-900\/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3\.5 flex items-center justify-between shadow-sm">[\s\S]*?<\/header>/;

const newHeader = `{/* 1. Header Bar */}
      {gameState === 'menu' ? (
        <header className="shrink-0 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-sm">
          {/* TOP LEFT: Registration / Login / Profile Entry */}
          <button
            id="user-auth-entry-btn"
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-3 px-3.5 py-2 rounded-2xl border border-slate-800 bg-slate-950/80 hover:bg-slate-900 hover:border-blue-500/50 transition active:scale-95 text-left group shadow-sm"
            title="手机号登录 / 注册 / 个人中心"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/40 flex items-center justify-center text-xl shadow-inner group-hover:scale-105 transition">
              {currentAccount.avatar}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white group-hover:text-blue-300 transition truncate max-w-[120px]">
                  {currentAccount.nickname}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {currentAccount.phone}
              </div>
            </div>
          </button>
          
          {/* Center Brand Title */}
          <div
            onClick={() => setGameState('menu')}
            className="cursor-pointer select-none text-center"
          >
            <h1 className="font-black text-xl tracking-wider text-white flex items-center justify-center gap-2">
              十三水
            </h1>
          </div>

          {/* TOP RIGHT: Points Management Entry */}
          <div className="flex items-center gap-3">
            <button
              id="points-management-entry-btn"
              onClick={() => setShowPointsModal(true)}
              className="flex items-center gap-2.5 px-3.5 sm:px-4 py-2 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/50 to-slate-950 hover:border-amber-400 text-amber-300 transition active:scale-95 shadow-md shadow-amber-500/10 group"
              title="点击打开积分管理：手机号互赠积分"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-base text-amber-400 group-hover:scale-110 transition">
                🪙
              </div>
              <div className="text-left">
                <div className="text-[10px] text-amber-400/80 font-bold">积分管理</div>
                <div className="text-sm font-black text-amber-400 leading-none">
                  {currentAccount.points.toLocaleString()}
                </div>
              </div>
            </button>
          </div>
        </header>
      ) : (
        <header className="shrink-0 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 px-4 py-2 flex items-center justify-center shadow-sm overflow-x-auto no-scrollbar">
          <div className="flex flex-nowrap items-center justify-center gap-3 w-full max-w-5xl whitespace-nowrap">
            <span className="text-xs font-bold text-slate-400 shrink-0">参赛玩家：</span>
            {playersInMatch.map(p => (
              <div key={p.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 rounded-xl border border-slate-700/50 shrink-0">
                <span className="text-sm">{p.avatar}</span>
                <span className="text-xs font-bold text-slate-200">{p.name} {p.isAi ? '' : '(我)'}</span>
              </div>
            ))}
          </div>
        </header>
      )}`;

content = content.replace(oldHeaderRegex, newHeader);

// 2. Remove the duplicate Top Players Banner from arranging
const duplicateBannerRegex = /\{\/\* Top Players Banner \*\/\}\n\s*<div className="w-full bg-slate-900\/90 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-center gap-4 shadow-lg whitespace-nowrap">[\s\S]*?<\/div>/;
content = content.replace(duplicateBannerRegex, '');

// 3. Make main overflow-hidden always
content = content.replace(
  /className=\{\`flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-3 flex flex-col items-center justify-center \$\{\n\s*gameState === 'menu' \? 'overflow-hidden' : 'overflow-y-auto'\n\s*\}\`\}/,
  'className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-3 flex flex-col items-center justify-center overflow-hidden"'
);

fs.writeFileSync(file, content);
