import re

with open('src/components/ChatFloatingWidget.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Make the floating chat button simpler
code = re.sub(
    r'<div className="hidden min-\[480px\]:flex flex-col items-start leading-none text-left">.*?<\/div>',
    r'',
    code,
    flags=re.DOTALL
)

with open('src/components/ChatFloatingWidget.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
