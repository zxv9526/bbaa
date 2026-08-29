const fs = require('fs');
const file = 'src/App.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');
lines[766] = `        )}
        {gameState === 'arranging' && (
          <div className="w-full max-w-5xl flex flex-col items-center gap-6">`;
lines[767] = ''; // remove the </div>
fs.writeFileSync(file, lines.join('\n'));
