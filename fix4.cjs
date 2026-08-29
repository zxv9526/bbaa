const fs = require('fs');
const file = 'src/App.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');
lines.splice(767, 3);
fs.writeFileSync(file, lines.join('\n'));
