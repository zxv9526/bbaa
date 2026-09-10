import re

with open('src/components/PointsManagementModal.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Make history tab simpler
code = re.sub(
    r'<div className="text-\[11px\] text-slate-500 font-mono">.*?<\/div>',
    r'',
    code,
    flags=re.DOTALL
)

with open('src/components/PointsManagementModal.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
