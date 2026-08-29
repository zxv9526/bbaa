const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /<div className="w-full max-w-5xl flex flex-col items-center gap-6">\n\s*\)\}\}\n\s*<\/div>/,
  '<div className="w-full max-w-5xl flex flex-col items-center gap-6">'
);

fs.writeFileSync(file, content);
