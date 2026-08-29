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
