const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Import
content = content.replace(
  /import \{ getSuggestedArrangements, \w+[^}]*\} from '\.\/lib\/gameLogic';/,
  (match) => match + "\nimport { PatternChanger } from './lib/patternChanger';"
);

// 2. Add useRef for patternChanger
content = content.replace(
  /const \[suggestions, setSuggestions\] = useState<ArrangementOption\[\]>\(\[\]\);/,
  "const [suggestions, setSuggestions] = useState<ArrangementOption[]>([]);\n  const patternChangerRef = useRef<PatternChanger | null>(null);"
);

// 3. Initialize in startNewMatch
content = content.replace(
  /const smartSuggestions = getSuggestedArrangements\(sortedPlayerHand\);\n\s*setSuggestions\(smartSuggestions\);/,
  "const smartSuggestions = getSuggestedArrangements(sortedPlayerHand);\n    setSuggestions(smartSuggestions);\n    patternChangerRef.current = new PatternChanger(sortedPlayerHand);"
);

// 4. Add handleChangePattern function
const changePatternFunc = `
  const handleChangePattern = () => {
    sounds.playCardPick();
    if (patternChangerRef.current) {
      const nextPattern = patternChangerRef.current.getNextPattern();
      if (nextPattern) {
        setFront(nextPattern.front);
        setMid(nextPattern.middle);
        setBack(nextPattern.back);
        setPool([]);
        setSelectedCardId(null);
        setErrorMsg('');
      }
    }
  };
`;
content = content.replace(
  /const handleAutoFix = \(\) => \{/,
  changePatternFunc + "\n  const handleAutoFix = () => {"
);

fs.writeFileSync(file, content);
