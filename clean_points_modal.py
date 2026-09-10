import re

with open('src/components/NoPointsModal.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Make No Points Explanation simple
code = re.sub(
    r'<div className="bg-slate-950\/80 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs text-slate-300 leading-relaxed">.*?<\/div>',
    r'''<div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs text-slate-300 leading-relaxed">
            <div className="font-bold text-amber-300 flex items-center gap-1.5 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>补充积分</span>
            </div>
            <p className="text-slate-300">
              您的积分不足，需要补充积分才能继续巅峰对决。
            </p>
          </div>''',
    code,
    flags=re.DOTALL
)


with open('src/components/NoPointsModal.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
