import re

with open('src/components/SubmitChoiceModal.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Simplify Submit Choice Actions
code = re.sub(
    r'<button\s*onClick=\{\(\) => \{\s*triggerHaptic\(\'medium\'\);\s*onConfirm\(\'reveal\'\);\s*\}\}[\s\S]*?<\/button>',
    r'''<button
            onClick={() => {
              triggerHaptic('medium');
              onConfirm('reveal');
            }}
            className="flex-1 px-4 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-sm shadow-xl shadow-orange-600/20 flex flex-col items-center justify-center transition active:scale-95 cursor-pointer"
          >
            <span>揭晓比牌结果</span>
          </button>''',
    code
)

code = re.sub(
    r'<button\s*onClick=\{\(\) => \{\s*triggerHaptic\(\'medium\'\);\s*onConfirm\(\'quick_next\'\);\s*\}\}[\s\S]*?<\/button>',
    r'',
    code
)

with open('src/components/SubmitChoiceModal.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
