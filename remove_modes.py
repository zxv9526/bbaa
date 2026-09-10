import re
import glob

def clean_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple search and replace for type declarations and strings
    content = re.sub(r"'vs_ai_8p' \| 'vs_ai_4p' \| 'practice'", r"'vs_ai_8p'", content)
    content = re.sub(r"'vs_ai_4p' \| 'vs_ai_8p'", r"'vs_ai_8p'", content)
    content = re.sub(r"mode\?: 'vs_ai_8p'", r"mode?: 'vs_ai_8p'", content) # In case it was stripped to just this
    
    # Fix LeaderboardModal
    content = re.sub(r"h\.mode === 'vs_ai_4p' \? '四人对局' : '双人对决'", r"'八人场'", content)
    
    # Fix MatchReplayModal
    content = re.sub(r"selectedReplay\.mode === 'vs_ai_8p' \? '八人场' : selectedReplay\.mode === 'vs_ai_4p' \? '四人场' : '双人场'", r"'八人场'", content)
    content = re.sub(r"r\.mode === 'vs_ai_8p' \? '八人场' : r\.mode === 'vs_ai_4p' \? '四人场' : '双人单挑'", r"'八人场'", content)
    
    # Fix SubmitChoiceModal
    content = re.sub(r"\{mode === 'vs_ai_4p' \? '四人匹配赛' : mode === 'practice' \? '单机练习' : '八人巅峰场'\}", r"八人巅峰场", content)
    
    # carriageManager.ts fixes
    content = re.sub(r"if \(mode === 'vs_ai_4p'\) \{.*?\} else \{.*?(return \{.*?\}).*?\}", r"\1", content, flags=re.DOTALL|re.MULTILINE) # roughly handle getStorageKeys but it might be safer to do it manually. Let's just do a simple replacement for now and fix manually if needed.

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

for filepath in glob.glob('src/**/*.tsx', recursive=True) + glob.glob('src/**/*.ts', recursive=True):
    clean_file(filepath)
