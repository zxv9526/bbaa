const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\{\/\* Status Validation Alert \*\/\}[\s\S]*?<\/div>[\s\S]*?<\/main>/;
const newStr = `{/* Status Validation Alert */}
              {isCurrentDaoShui && (
                <div className="w-full p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold text-center flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  ⚠️ 发生违规倒水（后墩 &lt; 中墩 或 中墩 &lt; 前墩）！请调整牌位或点击上方“一键调水”。
                </div>
              )}
            </div>
          </div>
        )}
      </main>`;

content = content.replace(regex, newStr);

fs.writeFileSync(file, content);
