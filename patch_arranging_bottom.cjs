const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacement = `                  </div>
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

              {/* Status Validation Alert */}`;

content = content.replace(/<\/div>\s*<\/div>\s*\{\/\* Status Validation Alert \*\/\}/s, replacement);
fs.writeFileSync(file, content);
