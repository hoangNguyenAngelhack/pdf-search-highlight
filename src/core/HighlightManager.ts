import type { SearchMatch, SpanData, PageData } from '../types';
import type { MatchRange } from './SearchEngine';

/**
 * Manages cross-span highlighting using the charMap approach.
 *
 * Algorithm (from demo):
 * 1. Group match ranges by spanIdx
 * 2. For each affected span, replace textContent with a DocumentFragment:
 *    - Plain text nodes for non-matching parts
 *    - <mark> elements for matching parts
 * 3. Collect marks per match for navigation
 */
export class HighlightManager {
  private matches: SearchMatch[] = [];
  private currentMatch = -1;
  private highlightClass: string;
  private activeHighlightClass: string;

  constructor(highlightClass: string, activeHighlightClass: string) {
    this.highlightClass = highlightClass;
    this.activeHighlightClass = activeHighlightClass;
  }

  /**
   * Apply highlights for all matches on a page.
   * Returns the SearchMatch[] (array of mark groups).
   */
  applyHighlights(
    pageSpans: SpanData[],
    matchRanges: MatchRange[][]
  ): SearchMatch[] {
    if (!matchRanges.length) return [];

    // Group ranges by spanIdx, keeping track of which match they belong to
    const spanRanges: Record<
      number,
      { start: number; end: number; matchIdx: number }[]
    > = {};

    matchRanges.forEach((range, mi) => {
      range.forEach((r) => {
        if (!spanRanges[r.spanIdx]) spanRanges[r.spanIdx] = [];
        spanRanges[r.spanIdx].push({ start: r.start, end: r.end, matchIdx: mi });
      });
    });

    // Collect marks per match
    const matchMarks: HTMLElement[][] = matchRanges.map(() => []);

    // For each affected span, rebuild DOM with highlights
    for (const siStr of Object.keys(spanRanges)) {
      const si = parseInt(siStr, 10);
      const s = pageSpans[si];
      const ranges = spanRanges[si].sort((a, b) => a.start - b.start);

      const frag = document.createDocumentFragment();
      let last = 0;

      for (const r of ranges) {
        const actualStart = Math.max(r.start, last);

        // Add plain text before highlight
        if (actualStart > last) {
          frag.appendChild(document.createTextNode(s.text.slice(last, actualStart)));
        }

        // Add highlight mark
        if (actualStart < r.end) {
          const mark = document.createElement('mark');
          mark.className = this.highlightClass;
          mark.textContent = s.text.slice(actualStart, r.end);
          frag.appendChild(mark);
          matchMarks[r.matchIdx].push(mark);
        }

        last = Math.max(last, r.end);
      }

      // Add remaining plain text
      if (last < s.text.length) {
        frag.appendChild(document.createTextNode(s.text.slice(last)));
      }

      // Replace span content
      s.el.textContent = '';
      s.el.appendChild(frag);
    }

    return matchMarks
      .filter((marks) => marks.length > 0)
      .map((marks) => ({ marks }));
  }

  /**
   * Add matches to the global list.
   */
  addMatches(newMatches: SearchMatch[]): void {
    this.matches.push(...newMatches);
  }

  /**
   * Clear all highlights and restore original span text.
   */
  clearHighlights(allPageData: PageData[]): void {
    allPageData.forEach((pd) => {
      pd.spans.forEach((s) => {
        s.el.textContent = s.text;
      });
    });
    this.matches = [];
    this.currentMatch = -1;
  }

  /**
   * Set active match by index. Applies active CSS class and scrolls into view.
   */
  setActiveMatch(index: number): void {
    // Remove active class from previous
    if (this.currentMatch >= 0 && this.currentMatch < this.matches.length) {
      this.matches[this.currentMatch].marks.forEach((m) =>
        m.classList.remove(this.activeHighlightClass)
      );
    }

    this.currentMatch = index;

    if (index >= 0 && index < this.matches.length) {
      this.matches[index].marks.forEach((m) =>
        m.classList.add(this.activeHighlightClass)
      );
      // Scroll first mark into view
      this.matches[index].marks[0]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }

  /**
   * Navigate to next match (wraps around).
   */
  next(): number {
    if (this.matches.length === 0) return -1;
    const newIdx = (this.currentMatch + 1) % this.matches.length;
    this.setActiveMatch(newIdx);
    return newIdx;
  }

  /**
   * Navigate to previous match (wraps around).
   */
  prev(): number {
    if (this.matches.length === 0) return -1;
    const newIdx =
      (this.currentMatch - 1 + this.matches.length) % this.matches.length;
    this.setActiveMatch(newIdx);
    return newIdx;
  }

  getCurrentIndex(): number {
    return this.currentMatch;
  }

  getTotal(): number {
    return this.matches.length;
  }

  getMatches(): SearchMatch[] {
    return this.matches;
  }
}
