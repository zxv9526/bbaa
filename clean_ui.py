import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Simplify the Lobby Quick Tool Shelf
code = re.sub(
    r'\{\/\* Lobby Quick Tool Shelf \*\/\}.*?<div className="col-span-1 md:col-span-2 flex flex-wrap items-center justify-center gap-2\.5 sm:gap-3 pt-2">.*?<button\s+id="btn-open-chat-from-lobby".*?<\/button>\s*<button\s+onClick=\{\(\) => setShowReplayModal\(true\)\}.*?<\/button>\s*<button\s+onClick=\{\(\) => setShowRankModal\(true\)\}.*?<\/button>\s*<button\s+onClick=\{\(\) => setShowRuleModal\(true\)\}.*?<\/button>\s*<button\s+onClick=\{\(\) => setShowSkinModal\(true\)\}.*?<\/button>\s*<\/div>',
    r'''{/* Lobby Quick Tool Shelf - Simplified */}
              <div className="w-full max-w-4xl flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-4 border-t border-slate-800/50">
                <button
                  onClick={() => setShowRuleModal(true)}
                  className="px-5 py-2.5 rounded-full bg-slate-900/60 hover:bg-slate-800 border border-slate-700/50 text-slate-300 hover:text-white text-sm font-bold flex items-center gap-2.5 transition-all shadow-sm cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  <span>玩法规则</span>
                </button>
                <button
                  onClick={() => setShowReplayModal(true)}
                  className="px-5 py-2.5 rounded-full bg-slate-900/60 hover:bg-slate-800 border border-slate-700/50 text-slate-300 hover:text-white text-sm font-bold flex items-center gap-2.5 transition-all shadow-sm cursor-pointer"
                >
                  <History className="w-4 h-4 text-amber-400" />
                  <span>我的战绩</span>
                </button>
              </div>''',
    code,
    flags=re.DOTALL
)

# Simplify the Header
code = re.sub(
    r'\{\/\* 1\. Header Bar: ONLY shown on main menu\/lobby; completely hidden during game match \*\/\}\s*\{gameState === \'menu\' && \(\s*<header className="shrink-0 border-b border-slate-800\/80 bg-slate-900\/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3 flex items-center justify-between shadow-sm">.*?<\/header>\s*\)\}',
    r'''{/* 1. Header Bar: Minimalist */}
      {gameState === 'menu' && (
        <header className="shrink-0 bg-transparent absolute top-0 left-0 w-full z-30 px-4 sm:px-8 py-4 flex items-center justify-between">
          <button
            id="user-auth-entry-btn"
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/60 hover:bg-slate-800 backdrop-blur-sm border border-slate-700/50 transition active:scale-95 group"
          >
            <div className="text-xl">{currentAccount.avatar}</div>
            <span className="text-sm font-bold text-white group-hover:text-blue-300 transition max-w-[100px] truncate">
              {currentAccount.nickname}
            </span>
          </button>

          <button
            id="points-management-entry-btn"
            onClick={() => setShowPointsModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/60 hover:bg-slate-800 backdrop-blur-sm border border-amber-500/30 text-amber-400 transition active:scale-95"
          >
            <span className="text-sm">🪙</span>
            <span className="text-sm font-black">{currentAccount.points.toLocaleString()}</span>
          </button>
        </header>
      )}''',
    code,
    flags=re.DOTALL
)

# Remove the Highlights Banner from the Arena block to make it cleaner
code = re.sub(
    r'\{\/\* Highlights Banner \*\/\}\s*<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">.*?<\/div>\s*<\/div>\s*<div className="pt-4 border-t border-slate-800\/80',
    r'</div>\n                <div className="pt-4 border-t border-slate-800/80',
    code,
    flags=re.DOTALL
)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
