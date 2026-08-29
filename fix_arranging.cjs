const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\{gameState === 'arranging' && \(\n\s*<div className="w-full max-w-5xl flex flex-col items-center gap-6">\n\s*\)\}\}\n\s*<\/div>/;

// Let's replace the broken block directly.
content = content.replace(
  /\{gameState === 'arranging' && \(\n\s*<div className="w-full max-w-5xl flex flex-col items-center gap-6">\s*\)\}\}\n\s*<\/div>/,
  `{gameState === 'arranging' && (
          <div className="w-full max-w-5xl flex flex-col items-center gap-6">`
);

fs.writeFileSync(file, content);
