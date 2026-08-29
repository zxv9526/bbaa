const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the entire arranging block to be sure it is balanced.
const startMarker = /\{\/\* Player's Card Arrangement Table \*\/\}/;
const endMarker = /\{\/\* 5\. Clean Footer \*\/\}/;
const before = content.slice(0, content.search(startMarker));
const after = content.slice(content.search(endMarker));

const newArranging = `{/* Player's Card Arrangement Table */}
            <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl flex flex-col items-center gap-6">
              {/* Header & Quick Action Buttons */}
              <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center text-xl font-bold">
                    <Layers className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-black text-base sm:text-lg text-white">
                      {playerName} 的理牌台
                    </h3>
                    <p className="text-xs text-slate-400">
                      点击手牌再点击槽位进行互换，或点击下方变换牌型
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                  {/* Swap Mid and Back */}
                  <button
                    onClick={handleSwapMidBack}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 transition active:scale-95"
                    title="交换中墩与后墩"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" /> 中后互换
                  </button>
                  {/* Auto-fix Dao Shui if invalid */}
                  {isCurrentDaoShui && (
                    <button
                      onClick={handleAutoFix}
                      className="px-3 py-2 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600/30 text-xs font-black flex items-center gap-1 transition animate-pulse"
                      title="一键调正倒水"
                    >
                      <Wand2 className="w-3.5 h-3.5" /> 一键调水
                    </button>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="w-full p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {errorMsg}
                </div>
              )}

              {/* 3 Slots: Front (3), Middle (5), Back (5) */}
              <div className="flex flex-col items-center gap-5 w-full">
                {/* 1. FRONT (前墩 3张) */}
                <div className="flex flex-col items-center gap-1.5 w-full">
                  <div className="flex items-center justify-between w-full max-w-sm px-2 text-xs font-bold text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      前墩 (3 张牌)
                    </span>
                    {fEval && (
                      <span className="text-blue-400 font-black">
                        [{HAND_TYPE_CN[fEval.type]}] {fEval.description}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {front.map((c, i) => (
                      <CardView
                        key={\`front_\${i}\`}
                        card={c || undefined}
                        size="lg"
                        onClick={() => handleSlotClick('front', i)}
                      />
                    ))}
                  </div>
                </div>

                {/* 2. MIDDLE (中墩 5张) */}
                <div className="flex flex-col items-center gap-1.5 w-full">
                  <div className="flex items-center justify-between w-full max-w-md px-2 text-xs font-bold text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                      中墩 (5 张牌)
                    </span>
                    {mEval && (
                      <span className="text-indigo-400 font-black">
                        [{HAND_TYPE_CN[mEval.type]}] {mEval.description}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {mid.map((c, i) => (
                      <CardView
                        key={\`mid_\${i}\`}
                        card={c || undefined}
                        size="lg"
                        onClick={() => handleSlotClick('mid', i)}
                      />
                    ))}
                  </div>
                </div>

                {/* 3. BACK (后墩 5张) */}
                <div className="flex flex-col items-center gap-1.5 w-full">
                  <div className="flex items-center justify-between w-full max-w-md px-2 text-xs font-bold text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                      后墩 (5 张牌)
                    </span>
                    {bEval && (
                      <span className="text-purple-400 font-black">
                        [{HAND_TYPE_CN[bEval.type]}] {bEval.description}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {back.map((c, i) => (
                      <CardView
                        key={\`back_\${i}\`}
                        card={c || undefined}
                        size="lg"
                        onClick={() => handleSlotClick('back', i)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Actions: Change Pattern and Submit */}
              <div className="w-full flex items-center justify-center gap-4 pt-4 border-t border-slate-800/80">
                <button
                  onClick={handleChangePattern}
                  className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-bold flex items-center gap-2 shadow transition active:scale-95"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  变换牌型
                </button>
                <button
                  onClick={handleSubmitArrangement}
                  disabled={pool.length > 0 && !useSpecialHand}
                  className="px-8 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-sm font-black flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  提交牌型
                </button>
              </div>

              {/* Status Validation Alert */}
              {isCurrentDaoShui && (
                <div className="w-full p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold text-center flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  ⚠️ 发生违规倒水（后墩 &lt; 中墩 或 中墩 &lt; 前墩）！请调整牌位或点击上方“一键调水”。
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      `;
      
content = before + newArranging + after;
fs.writeFileSync(file, content);
