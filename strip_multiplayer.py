import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Remove imports
code = re.sub(r"import \{ MultiplayerRoom \} from '\./components/MultiplayerRoom';\n", "", code)
code = re.sub(r"import \{ RoomManager, getLocalRoom, subscribeRoomUpdates \} from '\./lib/roomManager';\n", "", code)

# 2. Update types
code = re.sub(r"type GameMode = 'vs_ai_8p' \| 'multiplayer' \| 'vs_ai_4p' \| 'practice';", "type GameMode = 'vs_ai_8p' | 'vs_ai_4p' | 'practice';", code)
code = re.sub(r"type GameMode = 'vs_ai_8p' \| 'multiplayer';", "type GameMode = 'vs_ai_8p' | 'vs_ai_4p' | 'practice';", code) # just in case
code = re.sub(r"const \[gameState, setGameState\] = useState<'menu' \| 'room_lobby' \| 'shuffling_cutting' \| 'arranging' \| 'revealing'>\('menu'\);", "const [gameState, setGameState] = useState<'menu' | 'arranging' | 'revealing'>('menu');", code)

# 3. Remove state
code = re.sub(r"  const \[roomCode, setRoomCode\] = useState<string>\(''\);\n", "", code)
code = re.sub(r"  const \[currentMultiplayerRoom, setCurrentMultiplayerRoom\] = useState<RoomState \| null>\(null\);\n", "", code)
code = re.sub(r"  const \[joinInputCode8P, setJoinInputCode8P\] = useState<string>\(''\);\n", "", code)

# 4. Remove Multiplayer Logic section
code = re.sub(r"\s+// --- Multiplayer Logic ---.*?\s+// --- End Multiplayer Logic ---", "", code, flags=re.DOTALL)

# 5. Remove Multiplayer Join/Create section
code = re.sub(r"\s+// Join Multiplayer Room \(8P\).*?\s+// End Multiplayer Join/Create", "", code, flags=re.DOTALL)
# Wait, are there "End Multiplayer Join/Create" comments? Let's check.
