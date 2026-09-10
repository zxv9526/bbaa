import re

with open('src/components/NoPointsModal.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix the duplicate paragraph issue
code = re.sub(
    r'<p className="text-slate-300">\s*十三水对局为.*?<\/p>\s*<\/div>',
    r'</div>',
    code,
    flags=re.DOTALL
)

with open('src/components/NoPointsModal.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
