import { Card, Suit, Rank } from '../types';

export interface CardSkinAsset {
  key: string; // e.g. "AS", "10C", "back"
  type: 'svg' | 'image_url' | 'data_url';
  content: string; // SVG text or image URL / Data URL
}

// Convert rank number to standard words and symbols
export function getRankDetails(rank: Rank) {
  const words: Record<Rank, string> = {
    14: 'ace',
    13: 'king',
    12: 'queen',
    11: 'jack',
    10: '10',
    9: '9',
    8: '8',
    7: '7',
    6: '6',
    5: '5',
    4: '4',
    3: '3',
    2: '2'
  };

  const symbols: Record<Rank, string> = {
    14: 'A',
    13: 'K',
    12: 'Q',
    11: 'J',
    10: '10',
    9: '9',
    8: '8',
    7: '7',
    6: '6',
    5: '5',
    4: '4',
    3: '3',
    2: '2'
  };

  return {
    word: words[rank] || rank.toString(),
    symbol: symbols[rank] || rank.toString()
  };
}

export function getSuitDetails(suit: Suit) {
  const names: Record<Suit, { en: string; enSingular: string; zh: string; symbol: string }> = {
    S: { en: 'spades', enSingular: 'spade', zh: 'heitao', symbol: '♠' },
    H: { en: 'hearts', enSingular: 'heart', zh: 'hongtao', symbol: '♥' },
    C: { en: 'clubs', enSingular: 'club', zh: 'meihua', symbol: '♣' },
    D: { en: 'diamonds', enSingular: 'diamond', zh: 'fangkuai', symbol: '♦' }
  };
  return names[suit];
}

// Standard file paths to try loading from /cards/ or public directory
export function getCardAssetUrls(rank: Rank, suit: Suit): string[] {
  const { word, symbol } = getRankDetails(rank);
  const { en, enSingular } = getSuitDetails(suit);

  return [
    // 1. User specified primary format: 10_of_clubs.png, ace_of_spades.png, king_of_diamonds.png, queen_of_hearts.png, jack_of_spades.png
    `/cards/${word}_of_${en}.png`,
    `/cards/${word}_of_${en}.svg`,
    `/cards/${word}_of_${en}.webp`,
    `/cards/${word}_of_${en}.jpg`,
    // 2. Short format: AS.png, 10C.png, AS.svg
    `/cards/${symbol}${suit}.png`,
    `/cards/${symbol}${suit}.svg`,
    `/cards/${symbol}${suit}.webp`,
    // 3. Alternative formats: spades_A.png, ace_of_spade.png
    `/cards/${en}_${symbol}.png`,
    `/cards/${en}_${symbol}.svg`,
    `/cards/${word}_of_${enSingular}.png`,
    `/cards/${word}_of_${enSingular}.svg`
  ];
}

export function getBackAssetUrls(): string[] {
  return [
    '/cards/back.png',
    '/cards/back.svg',
    '/cards/back.webp',
    '/cards/card_back.png',
    '/cards/card_back.svg',
    '/cards/card_back.webp',
    '/cards/pai_bei.png',
    '/cards/pai_bei.svg'
  ];
}

// Canonical Card Key helpers (e.g. "AS", "10C", "back")
export function getCardCanonicalKey(rank: Rank, suit: Suit): string {
  const { symbol } = getRankDetails(rank);
  return `${symbol}${suit}`.toUpperCase();
}

// Standard mapping aliases for key lookup
export function getCardFileKeys(rank: Rank, suit: Suit): string[] {
  const { word, symbol } = getRankDetails(rank);
  const { en, zh } = getSuitDetails(suit);

  return [
    `${symbol}${suit}`.toUpperCase(),
    `${rank}-${suit}`,
    `${suit}${rank}`,
    `${word}_of_${en}`.toLowerCase(),
    `${symbol}_of_${en}`.toLowerCase(),
    `${en}_${symbol}`.toLowerCase(),
    `${en}_${word}`.toLowerCase(),
    `${zh}_${symbol}`.toLowerCase()
  ];
}

// Parse file name to canonical card key
export function parseFileNameToKey(fileName: string): string | null {
  // Strip extensions (.png, .svg, .webp, .jpg, .jpeg)
  const clean = fileName
    .replace(/\.(png|svg|webp|jpe?g)$/i, '')
    .trim()
    .toLowerCase();

  // 1. Back of card (牌背)
  if (/^(back|card_back|poker_back|pai_bei|beimian|back_card)$/i.test(clean)) {
    return 'back';
  }

  const rankWordMap: Record<string, string> = {
    ace: 'A',
    a: 'A',
    '1': 'A',
    '14': 'A',
    king: 'K',
    k: 'K',
    '13': 'K',
    queen: 'Q',
    q: 'Q',
    '12': 'Q',
    jack: 'J',
    j: 'J',
    '11': 'J',
    ten: '10',
    '10': '10',
    nine: '9',
    '9': '9',
    eight: '8',
    '8': '8',
    seven: '7',
    '7': '7',
    six: '6',
    '6': '6',
    five: '5',
    '5': '5',
    four: '4',
    '4': '4',
    three: '3',
    '3': '3',
    two: '2',
    '2': '2'
  };

  const suitNameMap: Record<string, Suit> = {
    spades: 'S',
    spade: 'S',
    s: 'S',
    heitao: 'S',
    hearts: 'H',
    heart: 'H',
    h: 'H',
    hongtao: 'H',
    clubs: 'C',
    club: 'C',
    c: 'C',
    meihua: 'C',
    diamonds: 'D',
    diamond: 'D',
    d: 'D',
    fangkuai: 'D'
  };

  // Pattern 1: {rank}_of_{suit} (e.g. 10_of_clubs, ace_of_spades, king_of_diamonds, queen_of_hearts, jack_of_spades)
  const matchOf = clean.match(/^([a-z0-9]+)_of_([a-z]+)$/i);
  if (matchOf) {
    const rankPart = matchOf[1];
    const suitPart = matchOf[2];
    const rank = rankWordMap[rankPart];
    const suit = suitNameMap[suitPart];
    if (rank && suit) return `${rank}${suit}`;
  }

  // Pattern 2: {suit}_{rank} (e.g. spades_ace, clubs_10, hearts_q)
  const matchSuitRank = clean.match(/^([a-z]+)[-_]([a-z0-9]+)$/i);
  if (matchSuitRank) {
    const p1 = matchSuitRank[1];
    const p2 = matchSuitRank[2];

    // Check if p1 is suit and p2 is rank
    if (suitNameMap[p1] && rankWordMap[p2]) {
      return `${rankWordMap[p2]}${suitNameMap[p1]}`;
    }
    // Check if p1 is rank and p2 is suit
    if (rankWordMap[p1] && suitNameMap[p2]) {
      return `${rankWordMap[p1]}${suitNameMap[p2]}`;
    }
  }

  // Pattern 3: Compact format (e.g. AS, 10H, KD, 2C, 10C)
  const matchCompact = clean.match(/^([2-9]|10|[jqka])([shcd])$/i);
  if (matchCompact) {
    return `${matchCompact[1].toUpperCase()}${matchCompact[2].toUpperCase()}`;
  }

  // Pattern 4: S10, H14, C2
  const matchPrefixSuit = clean.match(/^([shcd])([2-9]|1[0-4]|[jqka])$/i);
  if (matchPrefixSuit) {
    const suit = matchPrefixSuit[1].toUpperCase() as Suit;
    const rankVal = rankWordMap[matchPrefixSuit[2].toLowerCase()];
    if (rankVal) return `${rankVal}${suit}`;
  }

  return null;
}

// In-browser Custom Skin Storage (IndexedDB)
const DB_NAME = 'thirteen_poker_assets_db_v2';
const STORE_NAME = 'card_assets';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Memory cache for instantaneous renders
const assetMemoryCache: Record<string, CardSkinAsset> = {};
// Record of verified static files available on server (/cards/...)
const verifiedStaticUrls: Record<string, string | false> = {};

let isCacheLoaded = false;
const listeners: Array<() => void> = [];

export function subscribeToSkinChanges(callback: () => void) {
  listeners.push(callback);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function notifySkinChanged() {
  listeners.forEach(fn => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
}

// Pre-load all stored assets into memory
export async function initCardSkins(): Promise<void> {
  if (isCacheLoaded) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const items: CardSkinAsset[] = req.result || [];
      items.forEach(item => {
        assetMemoryCache[item.key] = item;
      });
      isCacheLoaded = true;
      notifySkinChanged();
    };
  } catch (err) {
    console.warn('Could not init IndexedDB for card skins:', err);
  }

  // Pre-probe back.png or back.svg from /cards/
  checkStaticAssetExists('/cards/back.png').then(exists => {
    if (exists) {
      verifiedStaticUrls['back'] = '/cards/back.png';
      notifySkinChanged();
    }
  });
}

// Check if a static URL responds with a valid image
export function checkStaticAssetExists(url: string): Promise<boolean> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

// Save an asset (SVG string or Data URL)
export async function saveCardAsset(key: string, content: string, type: 'svg' | 'image_url' | 'data_url'): Promise<void> {
  const asset: CardSkinAsset = { key, content, type };
  assetMemoryCache[key] = asset;
  notifySkinChanged();
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(asset);
  } catch (err) {
    console.warn('Failed to persist card asset:', err);
  }
}

// Batch save multiple card assets
export async function batchSaveCardAssets(entries: CardSkinAsset[]): Promise<void> {
  entries.forEach(e => {
    assetMemoryCache[e.key] = e;
  });
  notifySkinChanged();

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    entries.forEach(e => store.put(e));
  } catch (err) {
    console.warn('Failed to batch persist card assets:', err);
  }
}

// Clear all custom assets
export async function clearAllCardAssets(): Promise<void> {
  Object.keys(assetMemoryCache).forEach(k => delete assetMemoryCache[k]);
  Object.keys(verifiedStaticUrls).forEach(k => delete verifiedStaticUrls[k]);
  notifySkinChanged();
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
  } catch (err) {
    console.warn('Failed to clear card assets:', err);
  }
}

// Get the custom asset or static path for a card
export function getCustomCardAsset(card?: Card, isFaceDown = false): {
  isSvgText?: string;
  imageUrl?: string;
} | null {
  if (isFaceDown) {
    // 1. Memory cache check for 'back'
    if (assetMemoryCache['back']) {
      const a = assetMemoryCache['back'];
      if (a.type === 'svg') return { isSvgText: a.content };
      return { imageUrl: a.content };
    }
    // 2. Verified static url
    if (verifiedStaticUrls['back']) {
      return { imageUrl: verifiedStaticUrls['back'] as string };
    }
    // 3. Try primary static back.png
    return { imageUrl: '/cards/back.png' };
  }

  if (!card) return null;

  const canonicalKey = getCardCanonicalKey(card.rank, card.suit);
  const aliases = getCardFileKeys(card.rank, card.suit);

  // 1. Check in-memory user uploads
  for (const k of aliases) {
    if (assetMemoryCache[k]) {
      const a = assetMemoryCache[k];
      if (a.type === 'svg') return { isSvgText: a.content };
      return { imageUrl: a.content };
    }
  }

  // 2. Check verified static url
  if (verifiedStaticUrls[canonicalKey]) {
    return { imageUrl: verifiedStaticUrls[canonicalKey] as string };
  }

  // 3. Fallback to primary convention path: e.g. /cards/10_of_clubs.png, /cards/ace_of_spades.png
  const { word } = getRankDetails(card.rank);
  const { en } = getSuitDetails(card.suit);
  return { imageUrl: `/cards/${word}_of_${en}.png` };
}

// Mark URL as verified or failed
export function markStaticUrlStatus(key: string, url: string, exists: boolean) {
  if (exists) {
    verifiedStaticUrls[key] = url;
  } else {
    if (verifiedStaticUrls[key] === url) {
      delete verifiedStaticUrls[key];
    }
  }
}

// Check coverage count for UI display
export function getSkinCoverageCount(): { total: number; uploaded: number; hasBack: boolean } {
  let count = 0;
  const suits: Suit[] = ['S', 'H', 'C', 'D'];
  for (let r = 2; r <= 14; r++) {
    for (const s of suits) {
      const key = getCardCanonicalKey(r as Rank, s);
      const aliases = getCardFileKeys(r as Rank, s);
      const exists =
        aliases.some(k => assetMemoryCache[k]) ||
        Boolean(verifiedStaticUrls[key]);
      if (exists) count++;
    }
  }

  const hasBack = Boolean(assetMemoryCache['back'] || verifiedStaticUrls['back']);

  return {
    total: 52,
    uploaded: count,
    hasBack
  };
}
