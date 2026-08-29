const fs = require('fs');
const file = 'src/components/PracticeModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\{\/\* Unplaced Pool \*\/\}.*?<\/div>\s*<\/div>/s;
content = content.replace(regex, '</div>');

fs.writeFileSync(file, content);
