const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace Top Opponents Face-down cards preview
const topOpponentsRegex = /\{\/\* Top Opponents Face-down cards preview \*\/\}[\s\S]*?\{\/\* Special Hand Alert Banner \*\/\}/s;
const topBanner = `{/* Top Players Banner */}
            <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-center gap-4 shadow-lg whitespace-nowrap">
              <span className="text-xs font-bold text-slate-400">参赛玩家：</span>
              {playersInMatch.map(p => (
                <div key={p.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 rounded-xl border border-slate-700/50">
                  <span className="text-sm">{p.avatar}</span>
                  <span className="text-xs font-bold text-slate-200">{p.name} {p.isAi ? '' : '(我)'}</span>
                </div>
              ))}
            </div>

            {/* Special Hand Alert Banner */}`;
content = content.replace(topOpponentsRegex, topBanner);

// 2. Modify Header
content = content.replace(
  /点击手牌再点击槽位，或使用右侧智能理牌与快捷牌型/,
  "点击手牌再点击槽位进行互换，或点击下方变换牌型"
);

// 3. Remove "Auto-arrange Smart Suggestions Button", "Reset Slots", "Submit Button" from the header
const headerButtonsRegex = /\{\/\* Auto-arrange Smart Suggestions Button \*\/\}[\s\S]*?<\/button>\s*<\/div>\s*<\/div>/s;
content = content.replace(headerButtonsRegex, `</div>\n              </div>`);

// 4. Remove Suggestions Drawer Popup
const suggestionsDrawerRegex = /\{\/\* Suggestions Drawer Popup \*\/\}[\s\S]*?\{\/\* Error Message \*\/\}/s;
content = content.replace(suggestionsDrawerRegex, `{/* Error Message */}`);

// 5. Add Bottom Buttons below slots
// Search for end of slots
const slotsEndRegex = /<CardView key=\{\`back_\$\{i\}\`\}[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/s;
const bottomButtons = `</div>
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
            </div>`;
content = content.replace(slotsEndRegex, (match) => {
  return match.replace(/<\/div>\s*<\/div>\s*<\/div>\s*<\/div>$/, bottomButtons);
});

// 6. Remove Quick Pattern Extraction Bar
const quickPatternRegex = /\{\/\* Quick Pattern Extraction Bar \*\/\}[\s\S]*?\{\/\* 5\. Clean Footer \*\/\}/s;
content = content.replace(quickPatternRegex, `{/* 5. Clean Footer */}`);

// 7. Remove showSuggestions state
content = content.replace(/const \[showSuggestions, setShowSuggestions\] = useState\(false\);\n/, '');

fs.writeFileSync(file, content);
