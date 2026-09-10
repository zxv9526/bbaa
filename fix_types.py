import re

with open('src/types.ts', 'r', encoding='utf-8') as f:
    code = f.read()

code = re.sub(r"export interface RoomState \{.*?\}\n", "", code, flags=re.DOTALL)
code = re.sub(r"export interface RoomPlayer \{.*?\}\n", "", code, flags=re.DOTALL)

with open('src/types.ts', 'w', encoding='utf-8') as f:
    f.write(code)
