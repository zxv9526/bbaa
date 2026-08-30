import { Card } from '../types';
import { getSuggestedArrangements, ArrangementOption, isValidArrangement } from '../gameLogic';

export class PatternChanger {
  private patterns: ArrangementOption[] = [];
  private currentIndex: number = 0;

  constructor(cards: Card[]) {
    // Generate patterns and ensure they are valid (no daoshui)
    const suggestions = getSuggestedArrangements(cards);
    this.patterns = suggestions.filter(opt => isValidArrangement(opt.front, opt.middle, opt.back));
    if (this.patterns.length === 0 && suggestions.length > 0) {
       this.patterns = suggestions; // fallback if somehow all are filtered
    }
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
   * 获取与当前摆牌严格不同的下一个牌型方案，确保每次点击都切实变换
   */
  public getNextPatternDifferentFrom(
    currentFront: Card[],
    currentMid: Card[],
    currentBack: Card[]
  ): { pattern: ArrangementOption; index: number; total: number } | null {
    if (this.patterns.length === 0) return null;
    if (this.patterns.length === 1) {
      return { pattern: this.patterns[0], index: 1, total: 1 };
    }

    const currentSig = this.getArrangementSig(currentFront, currentMid, currentBack);

    // 循环查找下一个与当前牌面不同的方案
    for (let attempt = 0; attempt < this.patterns.length; attempt++) {
      const idx = this.currentIndex;
      const candidate = this.patterns[idx];
      this.currentIndex = (this.currentIndex + 1) % this.patterns.length;

      const candidateSig = this.getArrangementSig(candidate.front, candidate.middle, candidate.back);
      if (candidateSig !== currentSig || attempt === this.patterns.length - 1) {
        return {
          pattern: candidate,
          index: idx + 1,
          total: this.patterns.length
        };
      }
    }

    const fallback = this.patterns[0];
    return { pattern: fallback, index: 1, total: this.patterns.length };
  }

  private getArrangementSig(f: Card[], m: Card[], b: Card[]): string {
    const fIds = f.map(c => c.id).sort().join(',');
    const mIds = m.map(c => c.id).sort().join(',');
    const bIds = b.map(c => c.id).sort().join(',');
    return `${fIds}|${mIds}|${bIds}`;
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

