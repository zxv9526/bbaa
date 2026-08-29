const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `{gameState === 'arranging' && (
          <div className="w-full max-w-5xl flex flex-col items-center gap-6">
              
            ))}
            </div>

            {/* Special Hand Alert Banner */}`;

const replacement = `{gameState === 'arranging' && (
          <div className="w-full max-w-5xl flex flex-col items-center gap-6">
            {/* Special Hand Alert Banner */}`;

content = content.replace(target, replacement);
fs.writeFileSync(file, content);
