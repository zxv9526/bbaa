const fs = require('fs');
const file = 'src/App.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');
console.log(lines[766]);
console.log(lines[767]);
console.log(lines[768]);
