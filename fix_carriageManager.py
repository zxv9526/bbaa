import re

with open('src/lib/carriageManager.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix getStorageKeys
code = re.sub(
    r"function getStorageKeys\(mode: 'vs_ai_8p' = 'vs_ai_8p'\) \{.*?\}",
    r"function getStorageKeys(mode: 'vs_ai_8p' = 'vs_ai_8p') {\n  return { CARRIAGE_STORAGE_KEY: CARRIAGE_STORAGE_KEY_8P, PLAYER_PROGRESS_KEY: PLAYER_PROGRESS_KEY_8P };\n}",
    code,
    flags=re.DOTALL
)

with open('src/lib/carriageManager.ts', 'w', encoding='utf-8') as f:
    f.write(code)
