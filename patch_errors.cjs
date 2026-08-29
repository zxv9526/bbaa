const fs = require('fs');

// 1. Fix App.tsx
const appFile = 'src/App.tsx';
let appContent = fs.readFileSync(appFile, 'utf8');
appContent = appContent.replace(/import React, \{ useState, useEffect \} from 'react';/, "import React, { useState, useEffect, useRef } from 'react';");
appContent = appContent.replace(/setShowSuggestions\(false\);\n/g, "");
fs.writeFileSync(appFile, appContent);

// 2. Fix patternChanger.ts
const pcFile = 'src/lib/patternChanger.ts';
let pcContent = fs.readFileSync(pcFile, 'utf8');
pcContent = pcContent.replace(/from '\.\/gameLogic'/, "from '../gameLogic'");
fs.writeFileSync(pcFile, pcContent);
