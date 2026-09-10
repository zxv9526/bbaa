import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Remove specific imports
code = re.sub(r"import \{ MultiplayerRoom \} from '\./components/MultiplayerRoom';\n", "", code)
code = re.sub(r"import \{ ShuffleCutStage \} from '\./components/ShuffleCutStage';\n", "", code)
code = re.sub(r"import \{ RoomManager, getLocalRoom, subscribeRoomUpdates \} from '\./lib/roomManager';\n", "", code)

# Fix GameMode and GameState
code = re.sub(r"type GameMode = 'vs_ai_8p' \| 'multiplayer';", "type GameMode = 'vs_ai_8p' | 'vs_ai_4p' | 'practice';", code)
code = re.sub(r"const \[gameState, setGameState\] = useState<'menu' \| 'room_lobby' \| 'shuffling_cutting' \| 'arranging' \| 'revealing'>\('menu'\);", "const [gameState, setGameState] = useState<'menu' | 'arranging' | 'revealing'>('menu');", code)

# Remove states
code = re.sub(r"  const \[roomCode, setRoomCode\] = useState<string>\(''\);\n", "", code)
code = re.sub(r"  const \[currentMultiplayerRoom, setCurrentMultiplayerRoom\] = useState<RoomState \| null>\(null\);\n", "", code)
code = re.sub(r"  const \[joinInputCode8P, setJoinInputCode8P\] = useState<string>\(''\);\n", "", code)

# Remove Multiplayer functions (startMultiplayerMatch ... handleMultiplayerQuickNextRound)
code = re.sub(r"  // 👥 好友联机开黑场：轮流做庄发牌与洗切牌逻辑.*?  // 💬 Chat & Voice Message Dispatcher", "  // 💬 Chat & Voice Message Dispatcher", code, flags=re.DOTALL)

# Remove join/create room functions
# Let's find their comments first.

code = re.sub(r"  // Join Multiplayer Room \(8P\).*?  // Real-time evaluation on player's current slots", "  // Real-time evaluation on player's current slots", code, flags=re.DOTALL)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
