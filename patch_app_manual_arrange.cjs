const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update state definitions
content = content.replace(
  /const \[front, setFront\] = useState<\(Card \| null\)\[\]>\(\[null, null, null\]\);[\s\S]*?const \[selectedCardId, setSelectedCardId\] = useState<string \| null>\(null\);/,
  `const [front, setFront] = useState<Card[]>([]);
  const [mid, setMid] = useState<Card[]>([]);
  const [back, setBack] = useState<Card[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);`
);

// 2. Replace card action handlers
const oldHandlersRegex = /\/\/ Card click in Pool[\s\S]*?\/\/ Submit Player Arrangement & Reveal/;

const newHandlers = `// Multi-card selection toggle
  const handleToggleCardSelect = (cardId: string) => {
    sounds.playCardPick();
    setSelectedCardIds(prev =>
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };

  // Move all selected cards to target row ('front' | 'mid' | 'back' | 'pool')
  const handleMoveSelectedTo = (target: 'front' | 'mid' | 'back' | 'pool') => {
    if (selectedCardIds.length === 0) return;

    sounds.playCardPick();
    const selectedSet = new Set(selectedCardIds);
    const movedCards: Card[] = [];

    const newPool = pool.filter(c => {
      if (c && selectedSet.has(c.id)) {
        movedCards.push(c);
        return false;
      }
      return true;
    });

    const newFront = front.filter(c => {
      if (c && selectedSet.has(c.id)) {
        movedCards.push(c);
        return false;
      }
      return true;
    });

    const newMid = mid.filter(c => {
      if (c && selectedSet.has(c.id)) {
        movedCards.push(c);
        return false;
      }
      return true;
    });

    const newBack = back.filter(c => {
      if (c && selectedSet.has(c.id)) {
        movedCards.push(c);
        return false;
      }
      return true;
    });

    if (target === 'front') {
      setFront([...newFront, ...movedCards]);
      setMid(newMid);
      setBack(newBack);
      setPool(newPool);
    } else if (target === 'mid') {
      setFront(newFront);
      setMid([...newMid, ...movedCards]);
      setBack(newBack);
      setPool(newPool);
    } else if (target === 'back') {
      setFront(newFront);
      setMid(newMid);
      setBack([...newBack, ...movedCards]);
      setPool(newPool);
    } else if (target === 'pool') {
      setFront(newFront);
      setMid(newMid);
      setBack(newBack);
      setPool(sortCards([...newPool, ...movedCards]));
    }

    setSelectedCardIds([]);
    setErrorMsg('');
  };

  // Recall all placed cards to pool
  const handleRecallAllToPool = () => {
    sounds.playCardPick();
    const all = sortCards([
      ...front,
      ...mid,
      ...back,
      ...pool
    ]);
    setFront([]);
    setMid([]);
    setBack([]);
    setPool(all);
    setSelectedCardIds([]);
    setErrorMsg('');
  };

  // Swap Middle and Back Duns
  const handleSwapMidBack = () => {
    sounds.playSwap();
    const currentMid = [...mid];
    const currentBack = [...back];
    setMid(currentBack);
    setBack(currentMid);
    setErrorMsg('');
  };

  // Smart Pattern Changer
  const handleChangePattern = () => {
    sounds.playCardPick();
    if (patternChangerRef.current) {
      const nextPattern = patternChangerRef.current.getNextPattern();
      if (nextPattern) {
        setFront(nextPattern.front);
        setMid(nextPattern.middle);
        setBack(nextPattern.back);
        setPool([]);
        setSelectedCardIds([]);
        setErrorMsg('');
      }
    }
  };

  // Auto Fix Dao Shui
  const handleAutoFix = () => {
    sounds.playAutoArrange();
    const allPlacedOrPool = [
      ...front,
      ...mid,
      ...back,
      ...pool
    ];

    const fixed = autoFixDaoShui(allPlacedOrPool);
    if (fixed) {
      setFront(fixed.front);
      setMid(fixed.middle);
      setBack(fixed.back);
      setPool([]);
      setSelectedCardIds([]);
      setErrorMsg('');
    }
  };

  // Apply suggestion
  const applySuggestion = (option: ArrangementOption) => {
    sounds.playAutoArrange();
    setFront([...option.front]);
    setMid([...option.middle]);
    setBack([...option.back]);
    setPool([]);
    setSelectedCardIds([]);
    setErrorMsg('');
  };

  // Reset slots to original hand order
  const handleResetSlots = () => {
    sounds.playCardPick();
    const allCards = sortCards([
      ...front,
      ...mid,
      ...back,
      ...pool
    ]);
    setFront(allCards.slice(0, 3));
    setMid(allCards.slice(3, 8));
    setBack(allCards.slice(8, 13));
    setPool([]);
    setSelectedCardIds([]);
    setErrorMsg('');
  };

  // Submit Player Arrangement & Reveal`;

content = content.replace(oldHandlersRegex, newHandlers);

// 3. Update handleSubmitArrangement logic
const oldSubmitRegex = /const handleSubmitArrangement = async \(\) => \{[\s\S]*?settleMatch\(userArrangement\);\n  \};/;

const newSubmit = `const handleSubmitArrangement = async () => {
    if (useSpecialHand && specialHand) {
      const userArrangement: PlayerArrangement = {
        front: [],
        middle: [],
        back: [],
        specialHand,
        isValid: true,
        isDaoShui: false
      };
      settleMatch(userArrangement);
      return;
    }

    if (pool.length > 0) {
      sounds.playError();
      setErrorMsg(\`⚠️ 手牌尚未全部分配！还剩 \${pool.length} 张牌在手牌区，请先分配完毕。\`);
      return;
    }

    if (front.length !== 3) {
      sounds.playError();
      setErrorMsg(\`⚠️ 前墩张数不符！前墩必须正好为 3 张牌（当前为 \${front.length} 张）。\`);
      return;
    }

    if (mid.length !== 5) {
      sounds.playError();
      setErrorMsg(\`⚠️ 中墩张数不符！中墩必须正好为 5 张牌（当前为 \${mid.length} 张）。\`);
      return;
    }

    if (back.length !== 5) {
      sounds.playError();
      setErrorMsg(\`⚠️ 后墩张数不符！后墩必须正好为 5 张牌（当前为 \${back.length} 张）。\`);
      return;
    }

    const isValid = isValidArrangement(front, mid, back);
    if (!isValid) {
      sounds.playError();
      setErrorMsg('⚠️ 发生违规倒水（后墩 < 中墩 或 中墩 < 前墩）！请调整牌位或点击“一键调水”。');
      return;
    }

    const userArrangement: PlayerArrangement = {
      front,
      middle: mid,
      back,
      isValid: true,
      isDaoShui: false
    };

    settleMatch(userArrangement);
  };`;

content = content.replace(oldSubmitRegex, newSubmit);

// 4. Update hand evaluation definitions
const oldEvalRegex = /const frontFilled = front\.every\(Boolean\);[\s\S]*?const isCurrentDaoShui = allFilled && !isValidArrangement\(front as Card\[\], mid as Card\[\], back as Card\[\]\);/;

const newEval = `const fEval = front.length === 3 ? evaluateHand(front, 'front') : null;
  const mEval = mid.length === 5 ? evaluateHand(mid, 'middle') : null;
  const bEval = back.length === 5 ? evaluateHand(back, 'back') : null;

  const isCurrentDaoShui =
    front.length === 3 &&
    mid.length === 5 &&
    back.length === 5 &&
    !isValidArrangement(front, mid, back);`;

content = content.replace(oldEvalRegex, newEval);

// 5. Replace arranging JSX block
const oldArrangingJSXRegex = /\{gameState === 'arranging' && \([\s\S]*?\)\}\n\s*<\/main>/;

const newArrangingJSX = `{gameState === 'arranging' && (
          <div className="w-full max-w-5xl flex flex-col items-center gap-3 py-1">
            {/* Special Hand Alert Banner */}
            {specialHand && (
              <SpecialHandBanner
                specialHand={specialHand}
                isUsed={useSpecialHand}
                onUseSpecial={() => setUseSpecialHand(!useSpecialHand)}
              />
            )}

            {/* Error Message Banner */}
            {errorMsg && (
              <div className="w-full p-2.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            {/* Quick Actions Bar */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 border border-slate-800 rounded-2xl px-3.5 py-2 shadow-md">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleChangePattern}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                  title="智能轮巡合法组合"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 变换牌型
                </button>
                <button
                  onClick={handleSwapMidBack}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                  title="交换中墩与后墩"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" /> 中后互换
                </button>
                <button
                  onClick={handleRecallAllToPool}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                  title="清空所有墩，牌全部回收至手牌区"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" /> 全部回收
                </button>
                {isCurrentDaoShui && (
                  <button
                    onClick={handleAutoFix}
                    className="px-3 py-1.5 rounded-xl bg-rose-600/30 border border-rose-500/50 text-rose-200 hover:bg-rose-600/40 text-xs font-black flex items-center gap-1.5 transition animate-pulse"
                    title="自动调整倒水"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> 一键调水
                  </button>
                )}
              </div>

              {/* Selection Status & Clear selection */}
              <div className="flex items-center gap-2 text-xs">
                {selectedCardIds.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/30">
                      已选 {selectedCardIds.length} 张
                    </span>
                    <button
                      onClick={() => setSelectedCardIds([])}
                      className="text-slate-400 hover:text-slate-200 underline font-semibold text-[11px]"
                    >
                      取消选择
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-500 font-medium text-[11px]">
                    点牌选定，点击目标墩完成移动
                  </span>
                )}
              </div>
            </div>

            {/* Arrangement Card Containers */}
            <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-3.5 sm:p-4 shadow-xl flex flex-col gap-3">
              
              {/* 1. FRONT DUN (前墩) */}
              <div
                onClick={() => selectedCardIds.length > 0 && handleMoveSelectedTo('front')}
                className={\`flex flex-col gap-1 p-2.5 rounded-2xl border transition-all \${
                  selectedCardIds.length > 0
                    ? 'border-blue-500/60 bg-blue-950/30 cursor-pointer hover:bg-blue-900/40 hover:border-blue-400 shadow-md'
                    : 'border-slate-800/80 bg-slate-950/50'
                }\`}
              >
                <div className="flex items-center justify-between w-full text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-slate-300">前墩</span>
                    <span className={\`text-[11px] px-2 py-0.5 rounded-full \${
                      front.length === 3 ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold' : 'bg-slate-800 text-slate-400'
                    }\`}>
                      {front.length}/3 张
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {fEval && (
                      <span className="text-blue-400 font-black text-xs">
                        [{HAND_TYPE_CN[fEval.type]}] {fEval.description}
                      </span>
                    )}
                    {selectedCardIds.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSelectedTo('front');
                        }}
                        className="px-2.5 py-0.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition active:scale-95"
                      >
                        移入前墩 ({selectedCardIds.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 min-h-[82px] p-1 rounded-xl bg-slate-900/50">
                  {front.length === 0 ? (
                    <div className="w-full py-3 text-center text-xs text-slate-500 font-medium">
                      {selectedCardIds.length > 0 ? '👉 点击此处放入前墩' : '前墩暂无扑克牌'}
                    </div>
                  ) : (
                    front.map(c => (
                      <CardView
                        key={c.id}
                        card={c}
                        size="md"
                        selected={selectedCardIds.includes(c.id)}
                        onClick={() => handleToggleCardSelect(c.id)}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* 2. MIDDLE DUN (中墩) */}
              <div
                onClick={() => selectedCardIds.length > 0 && handleMoveSelectedTo('mid')}
                className={\`flex flex-col gap-1 p-2.5 rounded-2xl border transition-all \${
                  selectedCardIds.length > 0
                    ? 'border-indigo-500/60 bg-indigo-950/30 cursor-pointer hover:bg-indigo-900/40 hover:border-indigo-400 shadow-md'
                    : 'border-slate-800/80 bg-slate-950/50'
                }\`}
              >
                <div className="flex items-center justify-between w-full text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <span className="text-slate-300">中墩</span>
                    <span className={\`text-[11px] px-2 py-0.5 rounded-full \${
                      mid.length === 5 ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold' : 'bg-slate-800 text-slate-400'
                    }\`}>
                      {mid.length}/5 张
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {mEval && (
                      <span className="text-indigo-400 font-black text-xs">
                        [{HAND_TYPE_CN[mEval.type]}] {mEval.description}
                      </span>
                    )}
                    {selectedCardIds.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSelectedTo('mid');
                        }}
                        className="px-2.5 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow transition active:scale-95"
                      >
                        移入中墩 ({selectedCardIds.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 min-h-[82px] p-1 rounded-xl bg-slate-900/50">
                  {mid.length === 0 ? (
                    <div className="w-full py-3 text-center text-xs text-slate-500 font-medium">
                      {selectedCardIds.length > 0 ? '👉 点击此处放入中墩' : '中墩暂无扑克牌'}
                    </div>
                  ) : (
                    mid.map(c => (
                      <CardView
                        key={c.id}
                        card={c}
                        size="md"
                        selected={selectedCardIds.includes(c.id)}
                        onClick={() => handleToggleCardSelect(c.id)}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* 3. BACK DUN (后墩) */}
              <div
                onClick={() => selectedCardIds.length > 0 && handleMoveSelectedTo('back')}
                className={\`flex flex-col gap-1 p-2.5 rounded-2xl border transition-all \${
                  selectedCardIds.length > 0
                    ? 'border-purple-500/60 bg-purple-950/30 cursor-pointer hover:bg-purple-900/40 hover:border-purple-400 shadow-md'
                    : 'border-slate-800/80 bg-slate-950/50'
                }\`}
              >
                <div className="flex items-center justify-between w-full text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="text-slate-300">后墩</span>
                    <span className={\`text-[11px] px-2 py-0.5 rounded-full \${
                      back.length === 5 ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold' : 'bg-slate-800 text-slate-400'
                    }\`}>
                      {back.length}/5 张
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {bEval && (
                      <span className="text-purple-400 font-black text-xs">
                        [{HAND_TYPE_CN[bEval.type]}] {bEval.description}
                      </span>
                    )}
                    {selectedCardIds.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSelectedTo('back');
                        }}
                        className="px-2.5 py-0.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow transition active:scale-95"
                      >
                        移入后墩 ({selectedCardIds.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 min-h-[82px] p-1 rounded-xl bg-slate-900/50">
                  {back.length === 0 ? (
                    <div className="w-full py-3 text-center text-xs text-slate-500 font-medium">
                      {selectedCardIds.length > 0 ? '👉 点击此处放入后墩' : '后墩暂无扑克牌'}
                    </div>
                  ) : (
                    back.map(c => (
                      <CardView
                        key={c.id}
                        card={c}
                        size="md"
                        selected={selectedCardIds.includes(c.id)}
                        onClick={() => handleToggleCardSelect(c.id)}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* 4. POOL (未分配手牌) */}
              <div
                onClick={() => selectedCardIds.length > 0 && handleMoveSelectedTo('pool')}
                className={\`flex flex-col gap-1 p-2.5 rounded-2xl border transition-all \${
                  selectedCardIds.length > 0
                    ? 'border-emerald-500/60 bg-emerald-950/30 cursor-pointer hover:bg-emerald-900/40 hover:border-emerald-400 shadow-md'
                    : 'border-slate-800/80 bg-slate-950/40'
                }\`}
              >
                <div className="flex items-center justify-between w-full text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-300">未分配手牌区</span>
                    <span className={\`text-[11px] px-2 py-0.5 rounded-full \${
                      pool.length > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-400'
                    }\`}>
                      {pool.length} 张
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {pool.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCardIds(pool.map(c => c.id));
                        }}
                        className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold"
                      >
                        全选手牌
                      </button>
                    )}
                    {selectedCardIds.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSelectedTo('pool');
                        }}
                        className="px-2.5 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition active:scale-95"
                      >
                        退回手牌 ({selectedCardIds.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 min-h-[64px] p-1 rounded-xl bg-slate-900/40">
                  {pool.length === 0 ? (
                    <div className="w-full py-1.5 text-center text-xs text-slate-500 font-medium">
                      手牌已全部分配
                    </div>
                  ) : (
                    pool.map(c => (
                      <CardView
                        key={c.id}
                        card={c}
                        size="md"
                        selected={selectedCardIds.includes(c.id)}
                        onClick={() => handleToggleCardSelect(c.id)}
                      />
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Bottom Submit Action */}
            <div className="w-full flex items-center justify-center pt-1">
              <button
                onClick={handleSubmitArrangement}
                className="w-full max-w-md py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-base font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition active:scale-95 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                提交牌型 ({front.length + mid.length + back.length}/13张已分配)
              </button>
            </div>
          </div>
        )}
      </main>`;

content = content.replace(oldArrangingJSXRegex, newArrangingJSX);

fs.writeFileSync(file, content);
console.log('Successfully patched App.tsx');
