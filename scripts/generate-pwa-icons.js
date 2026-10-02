import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Standard Brand SVG (for favicon, pwa-192, pwa-512, apple-touch-icon)
const brandSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#0f3d2e" />
      <stop offset="60%" stop-color="#062217" />
      <stop offset="100%" stop-color="#02120b" />
    </radialGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="35%" stop-color="#f59e0b" />
      <stop offset="70%" stop-color="#d97706" />
      <stop offset="100%" stop-color="#b45309" />
    </linearGradient>
    <linearGradient id="cardGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>
    <linearGradient id="cardGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fffbeb" />
      <stop offset="100%" stop-color="#fef3c7" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.6" />
    </filter>
  </defs>

  <!-- Background rounded squircle with gold border -->
  <rect width="512" height="512" rx="110" fill="url(#bg)" />
  <rect x="12" y="12" width="488" height="488" rx="100" fill="none" stroke="url(#gold)" stroke-width="8" opacity="0.85" />
  <rect x="24" y="24" width="464" height="464" rx="90" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6 6" opacity="0.4" />

  <!-- Poker Cards Fan in background -->
  <g filter="url(#shadow)">
    <!-- Left tilted card -->
    <g transform="translate(185, 230) rotate(-18)">
      <rect x="-65" y="-95" width="130" height="190" rx="14" fill="url(#cardGrad1)" stroke="#cbd5e1" stroke-width="3" />
      <text x="-48" y="-62" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#dc2626">A</text>
      <text x="-48" y="-36" font-family="Arial, sans-serif" font-size="24" fill="#dc2626">♥</text>
      <text x="0" y="25" font-family="Arial, sans-serif" font-size="54" fill="#dc2626" text-anchor="middle">♥</text>
    </g>

    <!-- Right tilted card -->
    <g transform="translate(325, 230) rotate(18)">
      <rect x="-65" y="-95" width="130" height="190" rx="14" fill="url(#cardGrad1)" stroke="#cbd5e1" stroke-width="3" />
      <text x="26" y="-62" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#dc2626">K</text>
      <text x="26" y="-36" font-family="Arial, sans-serif" font-size="24" fill="#dc2626">♦</text>
      <text x="0" y="25" font-family="Arial, sans-serif" font-size="54" fill="#dc2626" text-anchor="middle">♦</text>
    </g>

    <!-- Center Ace of Spades card -->
    <g transform="translate(256, 215)">
      <rect x="-72" y="-105" width="144" height="210" rx="16" fill="url(#cardGrad2)" stroke="url(#gold)" stroke-width="4" />
      <text x="-52" y="-70" font-family="Arial, sans-serif" font-size="30" font-weight="900" fill="#0f172a">A</text>
      <text x="-52" y="-42" font-family="Arial, sans-serif" font-size="24" fill="#0f172a">♠</text>
      
      <!-- Big Center Spade with Golden Glow -->
      <path d="M 0,-40 C 25,-8 48,16 48,38 C 48,56 34,70 16,70 C 8,70 2,66 0,60 C -2,66 -8,70 -16,70 C -34,70 -48,56 -48,38 C -48,16 -25,-8 0,-40 Z" fill="#0f172a" />
      <path d="M -8,58 L -18,84 L 18,84 L 8,58 Z" fill="#0f172a" />
      <!-- Golden spade highlight -->
      <circle cx="0" cy="22" r="12" fill="url(#gold)" opacity="0.8" />
    </g>
  </g>

  <!-- Crown on Top -->
  <g transform="translate(256, 88)" filter="url(#glow)">
    <path d="M -50,18 L -36,-16 L -12,2 L 0,-24 L 12,2 L 36,-16 L 50,18 Z" fill="url(#gold)" stroke="#b45309" stroke-width="2" />
    <rect x="-48" y="16" width="96" height="12" rx="4" fill="url(#gold)" />
    <circle cx="-36" cy="-18" r="5" fill="#fef08a" />
    <circle cx="0" cy="-26" r="6" fill="#fef08a" />
    <circle cx="36" cy="-18" r="5" fill="#fef08a" />
  </g>

  <!-- 13水 Banner at bottom -->
  <g transform="translate(256, 400)" filter="url(#shadow)">
    <!-- Golden banner ribbon -->
    <rect x="-170" y="-36" width="340" height="72" rx="36" fill="url(#gold)" stroke="#fff" stroke-width="2" />
    <rect x="-162" y="-28" width="324" height="56" rx="28" fill="#062217" />
    <text x="0" y="10" font-family="'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="34" font-weight="900" fill="url(#gold)" text-anchor="middle" letter-spacing="4">
      十三水
    </text>
  </g>

  <!-- Stars -->
  <polygon points="120,385 125,398 139,398 128,406 132,419 120,411 108,419 112,406 101,398 115,398" fill="url(#gold)" />
  <polygon points="392,385 397,398 411,398 400,406 404,419 392,411 380,419 384,406 373,398 387,398" fill="url(#gold)" />
</svg>`;

// Maskable SVG with 15% Safe-zone margin (full bleed background, iconography scaled into central 70%)
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bgm" cx="50%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#0f3d2e" />
      <stop offset="60%" stop-color="#062217" />
      <stop offset="100%" stop-color="#02120b" />
    </radialGradient>
    <linearGradient id="goldm" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="35%" stop-color="#f59e0b" />
      <stop offset="70%" stop-color="#d97706" />
      <stop offset="100%" stop-color="#b45309" />
    </linearGradient>
    <linearGradient id="cardm" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>
    <filter id="shadowm" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.6" />
    </filter>
  </defs>

  <!-- Full-bleed background with no rounding (safe for squircle/circle clipping) -->
  <rect width="512" height="512" fill="url(#bgm)" />
  <circle cx="256" cy="256" r="236" fill="none" stroke="url(#goldm)" stroke-width="4" opacity="0.3" />

  <!-- Centered safe-zone group (scale 0.72) -->
  <g transform="translate(256, 256) scale(0.72) translate(-256, -256)">
    <!-- Poker Cards Fan in background -->
    <g filter="url(#shadowm)">
      <!-- Left card -->
      <g transform="translate(185, 230) rotate(-18)">
        <rect x="-65" y="-95" width="130" height="190" rx="14" fill="url(#cardm)" stroke="#cbd5e1" stroke-width="3" />
        <text x="-48" y="-62" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#dc2626">A</text>
        <text x="-48" y="-36" font-family="Arial, sans-serif" font-size="24" fill="#dc2626">♥</text>
        <text x="0" y="25" font-family="Arial, sans-serif" font-size="54" fill="#dc2626" text-anchor="middle">♥</text>
      </g>

      <!-- Right card -->
      <g transform="translate(325, 230) rotate(18)">
        <rect x="-65" y="-95" width="130" height="190" rx="14" fill="url(#cardm)" stroke="#cbd5e1" stroke-width="3" />
        <text x="26" y="-62" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#dc2626">K</text>
        <text x="26" y="-36" font-family="Arial, sans-serif" font-size="24" fill="#dc2626">♦</text>
        <text x="0" y="25" font-family="Arial, sans-serif" font-size="54" fill="#dc2626" text-anchor="middle">♦</text>
      </g>

      <!-- Center Ace of Spades card -->
      <g transform="translate(256, 215)">
        <rect x="-72" y="-105" width="144" height="210" rx="16" fill="#fffbeb" stroke="url(#goldm)" stroke-width="4" />
        <text x="-52" y="-70" font-family="Arial, sans-serif" font-size="30" font-weight="900" fill="#0f172a">A</text>
        <text x="-52" y="-42" font-family="Arial, sans-serif" font-size="24" fill="#0f172a">♠</text>
        
        <path d="M 0,-40 C 25,-8 48,16 48,38 C 48,56 34,70 16,70 C 8,70 2,66 0,60 C -2,66 -8,70 -16,70 C -34,70 -48,56 -48,38 C -48,16 -25,-8 0,-40 Z" fill="#0f172a" />
        <path d="M -8,58 L -18,84 L 18,84 L 8,58 Z" fill="#0f172a" />
        <circle cx="0" cy="22" r="12" fill="url(#goldm)" opacity="0.8" />
      </g>
    </g>

    <!-- Crown on Top -->
    <g transform="translate(256, 88)">
      <path d="M -50,18 L -36,-16 L -12,2 L 0,-24 L 12,2 L 36,-16 L 50,18 Z" fill="url(#goldm)" stroke="#b45309" stroke-width="2" />
      <rect x="-48" y="16" width="96" height="12" rx="4" fill="url(#goldm)" />
      <circle cx="-36" cy="-18" r="5" fill="#fef08a" />
      <circle cx="0" cy="-26" r="6" fill="#fef08a" />
      <circle cx="36" cy="-18" r="5" fill="#fef08a" />
    </g>

    <!-- 13水 Banner at bottom -->
    <g transform="translate(256, 400)" filter="url(#shadowm)">
      <rect x="-170" y="-36" width="340" height="72" rx="36" fill="url(#goldm)" stroke="#fff" stroke-width="2" />
      <rect x="-162" y="-28" width="324" height="56" rx="28" fill="#062217" />
      <text x="0" y="10" font-family="'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="34" font-weight="900" fill="url(#goldm)" text-anchor="middle" letter-spacing="4">
        十三水
      </text>
    </g>
  </g>
</svg>`;

async function run() {
  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Save SVGs
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), brandSvg);
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), brandSvg);
  fs.writeFileSync(path.join(publicDir, 'icon-maskable.svg'), maskableSvg);

  // 2. Generate PNGs
  const brandBuffer = Buffer.from(brandSvg);
  const maskableBuffer = Buffer.from(maskableSvg);

  // 192x192
  await sharp(brandBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('✓ Generated pwa-192x192.png');

  // 512x512
  await sharp(brandBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('✓ Generated pwa-512x512.png');

  // 512x512 maskable
  await sharp(maskableBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('✓ Generated pwa-maskable-512x512.png');

  // apple-touch-icon (180x180)
  await sharp(brandBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ Generated apple-touch-icon.png');

  // favicon.ico (64x64 png fallback/ico)
  await sharp(brandBuffer)
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('✓ Generated favicon.ico');

  console.log('All PWA icons generated successfully!');
}

run().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
