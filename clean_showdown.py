import re

with open('src/components/ShowdownStage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Remove Quick Play Again button to simplify actions at the end of the game
code = re.sub(
    r'\{onQuickPlayAgain && \(\s*<button\s*onClick=\{onQuickPlayAgain\}[\s\S]*?<\/button>\s*\)\}',
    r'',
    code
)

# Remove the "Open Chat" button from the end of the game
code = re.sub(
    r'\{onOpenChat && \(\s*<button\s*onClick=\{onOpenChat\}[\s\S]*?<\/button>\s*\)\}',
    r'',
    code
)

with open('src/components/ShowdownStage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
