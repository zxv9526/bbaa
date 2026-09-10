import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Find the Multiplayer BLOCK 3 and remove it
code = re.sub(r"              \{\/\* BLOCK 3: 好友多人联机 \(Multiplayer Room\) \*\/\}.*?              </div>\n\n              \{\/\* Lobby Quick Tool Shelf \*\/\}", r"              {/* Lobby Quick Tool Shelf */}", code, flags=re.DOTALL)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
