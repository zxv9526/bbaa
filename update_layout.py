import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Update main container background
code = re.sub(
    r'<div className="h-screen h-\[100dvh\] max-h-\[100dvh\] w-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white overflow-hidden">',
    r'<div className="h-screen h-[100dvh] max-h-[100dvh] w-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white overflow-hidden">',
    code
)

# Update menu grid layout to a simple flex column since there's only one block now
code = re.sub(
    r'<div className="w-full grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 my-auto">.*?\{\/\* BLOCK 1: 八人巅峰场 \(Flagship 8-Player Double-Deck Arena with Integrated Voice/Text Chat\) \*\/\}.*?<div.*?id="arena-8p-section".*?className={`col-span-1 md:col-span-2 relative',
    r'<div className="w-full flex flex-col items-center justify-center gap-6 sm:gap-8 my-auto">\n              {/* Hero Banner Area */}\n              <div className="flex flex-col items-center gap-2 mb-2 sm:mb-4 animate-fade-in-up">\n                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-amber-400 to-red-600 flex items-center justify-center text-4xl sm:text-5xl font-black shadow-lg shadow-red-600/30 ring-4 ring-slate-950 ring-offset-4 ring-offset-red-500/20 transform hover:scale-105 transition-transform duration-300">🀄</div>\n                <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-orange-500 tracking-tight mt-4 drop-shadow-sm">十三水巅峰对决</h1>\n                <p className="text-sm sm:text-base text-slate-400 font-medium tracking-wide">随时随地 · 极速匹配 · 畅快交锋</p>\n              </div>\n\n              {/* BLOCK 1: 八人巅峰场 */}\n              <div\n                id="arena-8p-section"\n                onClick={() => {\n                  if (currentAccount.points <= 0) {\n                    setShowNoPointsModal(true);\n                    return;\n                  }\n                  if (occ8P.isFull) {\n                    setErrorMsg(\'八人场当前车厢已满座 (0/8)，无法进入！\');\n                    return;\n                  }\n                  startNewMatch(\'vs_ai_8p\');\n                }}\n                className={`w-full max-w-4xl relative',
    code,
    flags=re.DOTALL
)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
