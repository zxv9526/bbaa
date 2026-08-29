const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');
content = "import { PatternChanger } from './lib/patternChanger';\n" + content;
fs.writeFileSync(file, content);
