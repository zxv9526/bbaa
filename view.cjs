const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
console.log(content.split('\n').slice(765, 780).join('\n'));
