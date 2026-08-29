const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /\{\/\* 5\. Clean Footer \*\/\}/,
  `          </div>\n        )}\n      </main>\n\n      {/* 5. Clean Footer */}`
);
fs.writeFileSync(file, content);
