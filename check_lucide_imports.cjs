const fs = require('fs');
const glob = require('glob');

const lucideIcons = new Set([
  'AlertCircle', 'AlertTriangle', 'ArrowDownRight', 'ArrowLeft', 'ArrowRight', 'ArrowUpRight',
  'Award', 'BookOpen', 'CheckCircle', 'CheckCircle2', 'ChevronDown', 'ChevronRight', 'ChevronUp',
  'Clock', 'Coins', 'Database', 'Edit3', 'FastForward', 'Flame', 'FolderOpen', 'History', 'Home',
  'KeyRound', 'Layers', 'LogOut', 'Medal', 'MessageSquare', 'Mic', 'MicOff', 'Palette', 'Phone', 'Play',
  'Radio', 'RefreshCw', 'RotateCcw', 'Search', 'Send', 'Server', 'Shield', 'ShieldAlert', 'ShieldCheck',
  'Smile', 'Sparkles', 'Square', 'Trash2', 'Trophy', 'Upload', 'User', 'UserCheck', 'UserPlus', 'Users',
  'Volume2', 'VolumeX', 'X', 'Zap'
]);

const files = glob.sync('src/**/*.tsx');
let hasError = false;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  
  // Find all used tags
  const tags = [...content.matchAll(/<([A-Z][a-zA-Z0-9_]*)/g)].map(m => m[1]);
  const usedLucideTags = new Set(tags.filter(t => lucideIcons.has(t)));
  
  // Find all imports
  const importMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/);
  const importedTags = new Set();
  
  if (importMatch) {
    const importsStr = importMatch[1];
    const items = importsStr.split(',').map(s => s.trim()).filter(Boolean);
    items.forEach(item => importedTags.add(item));
  }

  for (const tag of usedLucideTags) {
    if (!importedTags.has(tag)) {
      console.log(`ERROR: Missing import for <${tag}> in ${file}`);
      hasError = true;
    }
  }
}

if (!hasError) {
  console.log("SUCCESS: All Lucide icons are properly imported!");
} else {
  process.exit(1);
}
