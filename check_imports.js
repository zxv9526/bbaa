const fs = require('fs');
const glob = require('glob');
// Just a quick check for common global constructors used as JSX tags without import
const files = glob.sync('src/**/*.tsx');
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const tags = [...content.matchAll(/<([A-Z][a-zA-Z0-9_]*)/g)].map(m => m[1]);
  const imports = [...content.matchAll(/import\s+.*\{([^}]+)\}.*from/g)].flatMap(m => m[1].split(',').map(s => s.trim()));
  const defaultImports = [...content.matchAll(/import\s+([A-Z][a-zA-Z0-9_]*)\s+from/g)].map(m => m[1]);
  const allImports = new Set([...imports, ...defaultImports]);
  const globals = ['History', 'Image', 'Audio', 'Text', 'Map', 'Set', 'Worker', 'Animation'];
  
  for (const tag of tags) {
    if (globals.includes(tag) && !allImports.has(tag)) {
      console.log(`Missing import for ${tag} in ${file}`);
    }
  }
}
