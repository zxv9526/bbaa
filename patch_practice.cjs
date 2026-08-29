const fs = require('fs');
const file = 'src/components/PracticeModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace initialization
content = content.replace(
  /const \[front, setFront\] = useState<\(Card \| null\)\[\]>\(\[null, null, null\]\);\s*const \[mid, setMid\] = useState<\(Card \| null\)\[\]>\(\[null, null, null, null, null\]\);\s*const \[back, setBack\] = useState<\(Card \| null\)\[\]>\(\[null, null, null, null, null\]\);\s*const \[pool, setPool\] = useState<Card\[\]>\(\(\) => sortCards\(hand\)\);/,
  `const [front, setFront] = useState<(Card | null)[]>(() => sortCards(hand).slice(0, 3));
  const [mid, setMid] = useState<(Card | null)[]>(() => sortCards(hand).slice(3, 8));
  const [back, setBack] = useState<(Card | null)[]>(() => sortCards(hand).slice(8, 13));
  const [pool, setPool] = useState<Card[]>([]);`
);

// handleDealRandom
content = content.replace(
  /setHand\(newHand\);\s*setPool\(newHand\);\s*setFront\(\[null, null, null\]\);\s*setMid\(\[null, null, null, null, null\]\);\s*setBack\(\[null, null, null, null, null\]\);/g,
  `setHand(newHand);\n    setPool([]);\n    setFront(newHand.slice(0, 3));\n    setMid(newHand.slice(3, 8));\n    setBack(newHand.slice(8, 13));`
);

// handleLoadSpecial
content = content.replace(
  /setHand\(newHand\);\s*setPool\(newHand\);\s*setFront\(\[null, null, null\]\);\s*setMid\(\[null, null, null, null, null\]\);\s*setBack\(\[null, null, null, null, null\]\);/g,
  `setHand(newHand);\n    setPool([]);\n    setFront(newHand.slice(0, 3));\n    setMid(newHand.slice(3, 8));\n    setBack(newHand.slice(8, 13));`
);

// handleClearSlots
const oldClearSlots = `  // Clear slots
  const handleClearSlots = () => {
    sounds.playCardPick();
    setPool(sortCards(hand));
    setFront([null, null, null]);
    setMid([null, null, null, null, null]);
    setBack([null, null, null, null, null]);
    setSelectedCardId(null);
  };`;
const newClearSlots = `  // Reset slots
  const handleClearSlots = () => {
    sounds.playCardPick();
    const sorted = sortCards(hand);
    setFront(sorted.slice(0, 3));
    setMid(sorted.slice(3, 8));
    setBack(sorted.slice(8, 13));
    setPool([]);
    setSelectedCardId(null);
  };`;
content = content.replace(oldClearSlots, newClearSlots);

// handleSlotClick
const oldSlotClick = `  // Slot click
  const handleSlotClick = (row: 'front' | 'mid' | 'back', index: number) => {
    const targetArray = row === 'front' ? front : row === 'mid' ? mid : back;
    const setTargetArray = row === 'front' ? setFront : row === 'mid' ? setMid : setBack;

    if (targetArray[index] !== null) {
      sounds.playCardPick();
      const card = targetArray[index]!;
      setPool(prev => sortCards([...prev, card]));
      const newArr = [...targetArray];
      newArr[index] = null;
      setTargetArray(newArr);
      if (selectedCardId === card.id) setSelectedCardId(null);
    } else if (selectedCardId) {
      sounds.playCardPick();
      const card = pool.find(c => c.id === selectedCardId);
      if (card) {
        setPool(prev => prev.filter(c => c.id !== selectedCardId));
        const newArr = [...targetArray];
        newArr[index] = card;
        setTargetArray(newArr);
        setSelectedCardId(null);
      }
    }
  };`;

const newSlotClick = `  // Slot click to place or swap
  const handleSlotClick = (row: 'front' | 'mid' | 'back', index: number) => {
    const targetArray = row === 'front' ? front : row === 'mid' ? mid : back;
    const clickedCard = targetArray[index];

    if (selectedCardId) {
      if (clickedCard && selectedCardId === clickedCard.id) {
        setSelectedCardId(null);
        return;
      }

      sounds.playCardPick();
      
      let sourceRow: 'pool' | 'front' | 'mid' | 'back' = 'pool';
      let sourceIndex = -1;
      let selectedObj: Card | undefined;
      
      if ((sourceIndex = pool.findIndex(c => c.id === selectedCardId)) !== -1) {
        sourceRow = 'pool';
        selectedObj = pool[sourceIndex];
      } else if ((sourceIndex = front.findIndex(c => c?.id === selectedCardId)) !== -1) {
        sourceRow = 'front';
        selectedObj = front[sourceIndex]!;
      } else if ((sourceIndex = mid.findIndex(c => c?.id === selectedCardId)) !== -1) {
        sourceRow = 'mid';
        selectedObj = mid[sourceIndex]!;
      } else if ((sourceIndex = back.findIndex(c => c?.id === selectedCardId)) !== -1) {
        sourceRow = 'back';
        selectedObj = back[sourceIndex]!;
      }

      if (!selectedObj) return;

      if (sourceRow === 'pool') {
         setPool(prev => prev.filter(c => c.id !== selectedCardId));
         const newArr = [...targetArray];
         if (clickedCard) {
            setPool(prev => sortCards([...prev, clickedCard]));
         }
         newArr[index] = selectedObj;
         if (row === 'front') setFront(newArr);
         else if (row === 'mid') setMid(newArr);
         else setBack(newArr);
      } else {
         const sourceArray = sourceRow === 'front' ? front : sourceRow === 'mid' ? mid : back;
         
         if (sourceRow === row) {
            const newArr = [...targetArray];
            newArr[sourceIndex] = clickedCard || null;
            newArr[index] = selectedObj;
            if (row === 'front') setFront(newArr);
            else if (row === 'mid') setMid(newArr);
            else setBack(newArr);
         } else {
            const newSourceArr = [...sourceArray];
            const newTargetArr = [...targetArray];
            newSourceArr[sourceIndex] = clickedCard || null;
            newTargetArr[index] = selectedObj;
            
            if (sourceRow === 'front') setFront(newSourceArr);
            else if (sourceRow === 'mid') setMid(newSourceArr);
            else setBack(newSourceArr);
            
            if (row === 'front') setFront(newTargetArr);
            else if (row === 'mid') setMid(newTargetArr);
            else setBack(newTargetArr);
         }
      }
      setSelectedCardId(null);
    } else {
      if (clickedCard) {
        sounds.playCardPick();
        setSelectedCardId(clickedCard.id);
      }
    }
  };`;

content = content.replace(oldSlotClick, newSlotClick);

// Remove pool rendering
const poolRenderRegex = /\{\/\* Hand Pool \*\/\}.*?<\/div>\s*<\/div>/s;
// Let's just do it manually with a string replace if possible. Wait, regular expression dotall /s is better.
const poolRender = `        {/* Hand Pool */}
        <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center gap-3">
          <div className="flex items-center justify-between w-full text-xs text-slate-400">
            <span className="font-bold">未放置手牌 ({pool.length} / 13)</span>
            <span>点击空槽位放置</span>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {pool.map(c => (
              <CardView
                key={c.id}
                card={c}
                selected={selectedCardId === c.id}
                size="md"
                onClick={() => {
                  sounds.playCardPick();
                  setSelectedCardId(prev => prev === c.id ? null : c.id);
                }}
              />
            ))}
            {pool.length === 0 && (
              <div className="py-4 text-emerald-400 font-bold text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> 13 张牌已全部放置完成
              </div>
            )}
          </div>
        </div>`;

content = content.replace(poolRender, '');

fs.writeFileSync(file, content);
