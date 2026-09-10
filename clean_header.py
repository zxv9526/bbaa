import re

with open('src/components/CarriageHeaderBar.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Remove the hub button
code = re.sub(
    r'<button\s*onClick=\{onOpenHub\}.*?<\/button>',
    r'',
    code,
    flags=re.DOTALL
)

# Hide Chat Icon if onOpenChat is not provided, since we want to simplify
code = re.sub(
    r'<button\s*onClick=\{onOpenChat\}[\s\S]*?<\/button>',
    r'',
    code,
    flags=re.DOTALL
)


with open('src/components/CarriageHeaderBar.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
