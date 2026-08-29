const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. In startNewMatch, change pool and slot initialization
content = content.replace(
  /setPool\(sortedPlayerHand\);\s*setFront\(\[null, null, null\]\);\s*setMid\(\[null, null, null, null, null\]\);\s*setBack\(\[null, null, null, null, null\]\);/g,
  `setPool([]);\n    setFront(sortedPlayerHand.slice(0, 3));\n    setMid(sortedPlayerHand.slice(3, 8));\n    setBack(sortedPlayerHand.slice(8, 13));`
);

// 3. Rewrite handleSlotClick
const oldSlotClick = `  // Slot click to place or remove
  const handleSlotClick = (row: 'front' | 'mid' | 'back', index: number) => {
    if (gameState !== 'arranging') return;

    const targetArray = row === 'front' ? front : row === 'mid' ? mid : back;
    const setTargetArray = row === 'front' ? setFront : row === 'mid' ? setMid : setBack;

    if (targetArray[index] !== null) {
      // Return card to pool
      sounds.playCardPick();
      const card = targetArray[index]!;
      setPool(prev => sortCards([...prev, card]));
      const newArr = [...targetArray];
      newArr[index] = null;
      setTargetArray(newArr);
      if (selectedCardId === card.id) setSelectedCardId(null);
    } else if (selectedCardId) {
      // Place selected card into empty slot
      sounds.playCardPick();
      const card = pool.find(c => c.id === selectedCardId);
      if (card) {
        setPool(prev => prev.filter(c => c.id !== selectedCardId));
        const newArr = [...targetArray];
        newArr[index] = card;
        setTargetArray(newArr);
        setSelectedCardId(null);
        setErrorMsg('');
      }
    }
  };`;

const newSlotClick = `  // Slot click to place or swap
  const handleSlotClick = (row: 'front' | 'mid' | 'back', index: number) => {
    if (gameState !== 'arranging') return;

    const targetArray = row === 'front' ? front : row === 'mid' ? mid : back;
    const clickedCard = targetArray[index];

    if (selectedCardId) {
      if (clickedCard && selectedCardId === clickedCard.id) {
        // Deselect
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
      setErrorMsg('');
    } else {
      if (clickedCard) {
        sounds.playCardPick();
        setSelectedCardId(clickedCard.id);
      }
    }
  };`;

content = content.replace(oldSlotClick, newSlotClick);

// 4. Rewrite handleApplyPatternToDun
const oldApplyPattern = `  // Quick fill pattern into a dun
  const handleApplyPatternToDun = (patternCards: Card[], targetDun: 'front' | 'mid' | 'back') => {
    sounds.playCardPick();
    // Return existing cards in that dun to pool
    const targetArr = targetDun === 'front' ? front : targetDun === 'mid' ? mid : back;
    const existingCards = targetArr.filter(Boolean) as Card[];
    
    // Remaining pool cards after removing patternCards and adding existingCards
    const patternIds = new Set(patternCards.map(c => c.id));
    const newPool = sortCards([
      ...pool.filter(c => !patternIds.has(c.id)),
      ...existingCards
    ]);

    setPool(newPool);

    if (targetDun === 'front') {
      const fNew: (Card | null)[] = [null, null, null];
      patternCards.slice(0, 3).forEach((c, i) => fNew[i] = c);
      setFront(fNew);
    } else if (targetDun === 'mid') {
      const mNew: (Card | null)[] = [null, null, null, null, null];
      patternCards.slice(0, 5).forEach((c, i) => mNew[i] = c);
      setMid(mNew);
    } else if (targetDun === 'back') {
      const bNew: (Card | null)[] = [null, null, null, null, null];
      patternCards.slice(0, 5).forEach((c, i) => bNew[i] = c);
      setBack(bNew);
    }

    setSelectedCardId(null);
    setErrorMsg('');
  };`;

const newApplyPattern = `  // Quick fill pattern into a dun
  const handleApplyPatternToDun = (patternCards: Card[], targetDun: 'front' | 'mid' | 'back') => {
    sounds.playCardPick();
    
    const allCards = [
      ...front.filter(Boolean),
      ...mid.filter(Boolean),
      ...back.filter(Boolean),
      ...pool
    ] as Card[];

    const patternIds = new Set(patternCards.map(c => c.id));
    const remainingCards = allCards.filter(c => !patternIds.has(c.id));

    let fNew: Card[] = [];
    let mNew: Card[] = [];
    let bNew: Card[] = [];

    if (targetDun === 'front') {
      fNew = patternCards.slice(0, 3);
      const poolForOthers = [...patternCards.slice(3), ...remainingCards];
      mNew = poolForOthers.slice(0, 5);
      bNew = poolForOthers.slice(5, 10);
    } else if (targetDun === 'mid') {
      mNew = patternCards.slice(0, 5);
      const poolForOthers = [...patternCards.slice(5), ...remainingCards];
      fNew = poolForOthers.slice(0, 3);
      bNew = poolForOthers.slice(3, 8);
    } else if (targetDun === 'back') {
      bNew = patternCards.slice(0, 5);
      const poolForOthers = [...patternCards.slice(5), ...remainingCards];
      fNew = poolForOthers.slice(0, 3);
      mNew = poolForOthers.slice(3, 8);
    }

    setFront(fNew);
    setMid(mNew);
    setBack(bNew);
    setPool([]);

    setSelectedCardId(null);
    setErrorMsg('');
  };`;

content = content.replace(oldApplyPattern, newApplyPattern);

// 5. Rewrite handleResetSlots
const oldResetSlots = `  // Clear all slots back to pool
  const handleResetSlots = () => {
    sounds.playCardPick();
    const placedCards = [
      ...front.filter(Boolean),
      ...mid.filter(Boolean),
      ...back.filter(Boolean)
    ] as Card[];
    setPool(prev => sortCards([...prev, ...placedCards]));
    setFront([null, null, null]);
    setMid([null, null, null, null, null]);
    setBack([null, null, null, null, null]);
    setSelectedCardId(null);
    setErrorMsg('');
  };`;

const newResetSlots = `  // Reset slots to original hand order
  const handleResetSlots = () => {
    sounds.playCardPick();
    const allCards = sortCards([
      ...front.filter(Boolean),
      ...mid.filter(Boolean),
      ...back.filter(Boolean),
      ...pool
    ] as Card[]);
    setFront(allCards.slice(0, 3));
    setMid(allCards.slice(3, 8));
    setBack(allCards.slice(8, 13));
    setPool([]);
    setSelectedCardId(null);
    setErrorMsg('');
  };`;

content = content.replace(oldResetSlots, newResetSlots);

// 6. Fix availablePatterns to use originalHand all the time since pool is empty
content = content.replace(
  /const availablePatterns = findAvailablePatterns\(pool\.length > 0 \? pool : originalHand\);/g,
  `const availablePatterns = findAvailablePatterns(originalHand);`
);

// 7. Remove the Hand Pool section
const handPoolRegex = /\{\/\* Hand Pool \(Unplaced Cards\) \*\/\}[\s\S]*?\{\/\* 5\. Clean Footer \*\/\}/g;
const handPoolReplacement = `{/* 5. Clean Footer */}`;
content = content.replace(handPoolRegex, handPoolReplacement);

fs.writeFileSync(file, content);
