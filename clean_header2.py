import re

with open('src/components/CarriageHeaderBar.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Hide Chat Icon if onOpenChat is not provided, since we want to simplify
code = re.sub(
    r'\{\/\* 💬 牌桌对讲 \(Integrated Chat Trigger\) \*\/\}.*?<\/button>',
    r'',
    code,
    flags=re.DOTALL
)


with open('src/components/CarriageHeaderBar.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
