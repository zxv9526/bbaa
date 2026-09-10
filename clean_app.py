import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Remove the Tactical Chat Bar to keep the screen ultra clean during gameplay
code = re.sub(
    r'<TableTacticalChatBar[\s\S]*?\/>',
    r'',
    code
)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
