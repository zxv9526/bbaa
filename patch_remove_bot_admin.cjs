const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove import
content = content.replace(/import \{ TelegramAdminModal \} from '\.\/components\/TelegramAdminModal';\n/, '');

// 2. Remove Bot icon from lucide-react
content = content.replace(/,\s*Bot\n\} from 'lucide-react';/, '\n} from \'lucide-react\';');

// 3. Remove state
content = content.replace(/  const \[showTelegramAdminModal, setShowTelegramAdminModal\] = useState\(false\);\n/, '');

// 4. Remove button in header
const buttonRegex = /\{\/\* TOP RIGHT: Bot Admin & Points Management Entry \*\/\}[\s\S]*?<button[\s\S]*?id="bot-admin-entry-btn"[\s\S]*?<\/button>\s*<button\s*id="points-management-entry-btn"/;
content = content.replace(buttonRegex, `{/* TOP RIGHT: Points Management Entry */}\n        <div className="flex items-center gap-3">\n          <button\n            id="points-management-entry-btn"`);

// 5. Remove modal component
const modalRegex = /<TelegramAdminModal[\s\S]*?\/>\n/;
content = content.replace(modalRegex, '');

fs.writeFileSync(file, content);
