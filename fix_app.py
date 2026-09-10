import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Remove the Multiplayer quick next round inside handleConfirmSubmit
code = re.sub(r"      if \(mode === 'multiplayer'\) \{\s*settleMatch\(pendingArrangement, false\);\s*handleMultiplayerQuickNextRound\(\);\s*\} else \{\s*settleMatch\(pendingArrangement, true\);\s*\}", r"      settleMatch(pendingArrangement, true);", code, flags=re.DOTALL)

# Remove the mode === 'multiplayer' branch in settleMatch
code = re.sub(r"    // 👥 好友联机开黑场：提交理牌并结算\s*if \(mode === 'multiplayer'\) \{.*?    \}\n\n    // 👤 单机闯关模式", r"    // 👤 单机闯关模式", code, flags=re.DOTALL)

# Remove MultiplayerRoom component from JSX
code = re.sub(r"        \{\/\* 3\. Multiplayer Lobby View \*\/\}.*?        \{\/\* 3\.5 Multiplayer Shuffling & Cutting Stage \*\/\}.*?        \{\/\* 4\. Active Game Table", r"        {/* 4. Active Game Table", code, flags=re.DOTALL)

# Remove 'if (mode === 'multiplayer')' checks in ShowdownStage props
code = re.sub(r"              onPlayAgain=\{\(\) => \{\s*if \(mode === 'multiplayer'\) \{\s*handleMultiplayerNextRound\(\);\s*\} else \{\s*startNewMatch\(mode\);\s*\}\s*\}\}", "              onPlayAgain={() => startNewMatch(mode)}", code, flags=re.DOTALL)
code = re.sub(r"              onQuickPlayAgain=\{\(\) => \{\s*if \(mode === 'multiplayer'\) \{\s*handleMultiplayerQuickNextRound\(\);\s*\} else \{\s*startNewMatch\(mode\);\s*\}\s*\}\}", "              onQuickPlayAgain={() => startNewMatch(mode)}", code, flags=re.DOTALL)

# Remove playAgainLabel check
code = re.sub(r"              playAgainLabel=\{.*?\n.*?\n.*?\n.*?\n              \}", "              playAgainLabel={'下一局 · 重新发牌'}", code, flags=re.DOTALL)

# Remove Multiplayer Header Bar
code = re.sub(r"            \{\/\* 👥 Multiplayer Header Bar \*\/\}.*?            \{\/\* 🏆 Carriage Info Header \*\/\}", r"            {/* 🏆 Carriage Info Header */}", code, flags=re.DOTALL)

# Remove roundIndex from SubmitChoiceModal
code = re.sub(r"        roundIndex=\{currentMultiplayerRoom\?\.roundIndex \|\| 1\}\n", "", code)

# Remove multiplayer blocks from handleConfirmSubmit again if there are others
code = re.sub(r"      if \(mode === 'multiplayer'\) \{\s*setGameState\('room_lobby'\);\s*\} else \{\s*setGameState\('menu'\);\s*\}", r"      setGameState('menu');", code, flags=re.DOTALL)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
