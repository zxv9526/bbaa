import { Card } from '../types';
import { getSuggestedArrangements, ArrangementOption, isValidArrangement, autoFixDaoShui, evaluateHand } from '../gameLogic';

export class PatternChanger {
  private patterns: ArrangementOption[] = [];
  private currentIndex: number = 0;

  constructor(cards: Card[]) {
    // 生成智能理牌建议，并严格过滤出 100% 合法非倒水方案 (后墩 >= 中墩 >= 前墩)
    const suggestions = getSuggestedArrangements(cards);
    this.patterns = suggestions.filter(opt => 
      opt.front.length === 3 &&
      opt.middle.length === 5 &&
      opt.back.length === 5 &&
      isValidArrangement(opt.front, opt.middle, opt.back)
    );

    // 极端异常兜底：若建议列表为空，使用 autoFixDaoShui 强力生成合规方案
    if (this.patterns.length === 0 && cards && cards.length === 13) {
      const fixed = autoFixDaoShui(cards);
      if (fixed && isValidArrangement(fixed.front, fixed.middle, fixed.back)) {
        const fEval = evaluateHand(fixed.front, 'front');
        const mEval = evaluateHand(fixed.middle, 'middle');
        const bEval = evaluateHand(fixed.back, 'back');
        this.patterns = [{
          title: '基础合规排列',
          tag: '👑 尾墩最大',
          front: fixed.front,
          middle: fixed.middle,
          back: fixed.back,
          frontEval: fEval,
          midEval: mEval,
          backEval: bEval,
          totalEstScore: bEval.score + mEval.score + fEval.score
        }];
      }
    }

    // 默认初始已展示第1个方案(尾墩最大)，故下次点击切换优先步进至第2个方案
    this.currentIndex = this.patterns.length > 1 ? 1 : 0;
  }

  public getNextPattern(): ArrangementOption | null {
    if (this.patterns.length === 0) return null;
    const pattern = this.patterns[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.patterns.length;
    return pattern;
  }

  public getNextPatternWithMeta(): { pattern: ArrangementOption; index: number; total: number } | null {
    if (this.patterns.length === 0) return null;
    const pattern = this.patterns[this.currentIndex];
    const index = this.currentIndex + 1;
    this.currentIndex = (this.currentIndex + 1) % this.patterns.length;
    return { pattern, index, total: this.patterns.length };
  }

  /**
   * 获取与当前摆牌严格不同的下一个合法牌型方案，确保每次点击都切实变换且绝不倒水
   */
  public getNextPatternDifferentFrom(
    currentFront: Card[],
    currentMid: Card[],
    currentBack: Card[]
  ): { pattern: ArrangementOption; index: number; total: number } | null {
    if (this.patterns.length === 0) return null;

    const isCurrentValid = isValidArrangement(currentFront, currentMid, currentBack);
    const currentSig = this.getArrangementSig(currentFront, currentMid, currentBack);

    // 若当前手牌为倒水违规状态，优先直接切换为排名第一的最佳合规方案
    if (!isCurrentValid) {
      const best = this.patterns[0];
      this.currentIndex = (1) % this.patterns.length;
      return { pattern: best, index: 1, total: this.patterns.length };
    }

    if (this.patterns.length === 1) {
      return { pattern: this.patterns[0], index: 1, total: 1 };
    }

    // 循环查找下一个与当前牌面不同的合法方案
    for (let attempt = 0; attempt < this.patterns.length; attempt++) {
      const idx = this.currentIndex;
      const candidate = this.patterns[idx];
      this.currentIndex = (this.currentIndex + 1) % this.patterns.length;

      // 再次严格校验候选方案绝不倒水
      if (isValidArrangement(candidate.front, candidate.middle, candidate.back)) {
        const candidateSig = this.getArrangementSig(candidate.front, candidate.middle, candidate.back);
        if (candidateSig !== currentSig || attempt === this.patterns.length - 1) {
          return {
            pattern: candidate,
            index: idx + 1,
            total: this.patterns.length
          };
        }
      }
    }

    const fallback = this.patterns[0];
    return { pattern: fallback, index: 1, total: this.patterns.length };
  }

  private getArrangementSig(f: Card[], m: Card[], b: Card[]): string {
    if (!f || !m || !b) return '';
    const fIds = f.map(c => c.id).sort().join(',');
    const mIds = m.map(c => c.id).sort().join(',');
    const bIds = b.map(c => c.id).sort().join(',');
    return `${fIds}|${mIds}|${bIds}`;
  }
  
  public getPatternAt(index: number): { pattern: ArrangementOption; index: number; total: number } | null {
    if (this.patterns.length === 0) return null;
    const boundedIndex = Math.max(0, Math.min(index, this.patterns.length - 1));
    const pattern = this.patterns[boundedIndex];
    this.currentIndex = (boundedIndex + 1) % this.patterns.length;
    return { pattern, index: boundedIndex + 1, total: this.patterns.length };
  }

  public getPatternByStrategy(strategy: 'tail' | 'mid' | 'head'): { pattern: ArrangementOption; index: number; total: number } | null {
    if (this.patterns.length === 0) return null;
    const tagKeyword = strategy === 'tail' ? '尾墩' : strategy === 'mid' ? '中墩' : '头墩';
    const foundIdx = this.patterns.findIndex(p => p.tag.includes(tagKeyword));
    if (foundIdx !== -1) {
      return this.getPatternAt(foundIdx);
    }
    // Default fallback by index
    const fallbackIdx = strategy === 'tail' ? 0 : strategy === 'mid' ? 1 : 2;
    return this.getPatternAt(fallbackIdx % this.patterns.length);
  }

  public getCount(): number {
    return this.patterns.length;
  }

  public getPatterns(): ArrangementOption[] {
    return this.patterns;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public selectPatternIndex(index: number): ArrangementOption | null {
    if (index >= 0 && index < this.patterns.length) {
      this.currentIndex = index;
      const pattern = this.patterns[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.patterns.length;
      return pattern;
    }
    return null;
  }
}

