import re

with open('src/api.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# Remove RoomState from import
code = re.sub(r"import \{ GameRecord, PlayerStats, RoomState, TelegramBotStatus \} from '\./types';", "import { GameRecord, PlayerStats, TelegramBotStatus } from './types';", code)

# Remove RoomManager imports
code = re.sub(r"import \{ RoomManager, getLocalRoom, saveLocalRoom \} from '\./lib/roomManager';\n", "", code)

# Remove createRoom, joinRoom, pollRoom, submitRoomCards
code = re.sub(r"  public static async createRoom.*?  public static async getTelegramBotStatus", "  // 6. Telegram Bot Admin Integration\n  public static async getTelegramBotStatus", code, flags=re.DOTALL)

with open('src/api.ts', 'w', encoding='utf-8') as f:
    f.write(code)
