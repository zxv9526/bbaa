const fs = require('fs');
const file = 'src/App.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');
lines.splice(770, 2);
fs.writeFileSync(file, lines.join('\n'));
