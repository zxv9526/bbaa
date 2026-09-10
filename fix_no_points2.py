import re

with open('src/components/NoPointsModal.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix the duplicate div issue
code = re.sub(
    r'<\/div>\s*<\/div>\s*\{\/\* Solution \*\/\}',
    r'</div>\n          {/* Solution */}',
    code,
    flags=re.DOTALL
)

with open('src/components/NoPointsModal.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
