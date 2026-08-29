const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /\s*\)\}\s*\}\)\}\s*<\/div>\s*\{\/\* Special Hand Alert Banner \*\/\}/g,
  `
        )}
        {gameState === 'arranging' && (
          <div className="w-full max-w-5xl flex flex-col items-center gap-6">
            {/* Special Hand Alert Banner */}`
);

fs.writeFileSync(file, content);
