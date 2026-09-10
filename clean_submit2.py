import re

with open('src/components/SubmitChoiceModal.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Remove Quick Next Round
code = re.sub(
    r'\{\/\* Choice 2: Quick Next Round \(Auto Deal New Hand\) \*\/\}.*?<\/button>',
    r'',
    code,
    flags=re.DOTALL
)

# Rename Choice 3
code = re.sub(
    r'\{\/\* Choice 3: Submit & Finish Game \(Return to Lobby\) \*\/\}',
    r'{/* Choice 2: Submit & Finish Game (Return to Lobby) */}',
    code
)

with open('src/components/SubmitChoiceModal.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
