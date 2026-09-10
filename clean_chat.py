import re

with open('src/components/ChatDrawer.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Make chat drawer simple by default, focusing on quick phrases
code = re.sub(
    r'\{/\* Voice Record Button \(按住/点击对讲\) \*\/\}.*?<\/button>',
    r'',
    code,
    flags=re.DOTALL
)


with open('src/components/ChatDrawer.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
