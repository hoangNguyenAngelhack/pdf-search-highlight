import { searchPage } from './SearchEngine';
import type { MatchRange } from './SearchEngine';
import { HighlightManager } from './HighlightManager';
import { DEFAULT_CLASS_NAMES, MULTI_CONTEXT_COLOR_COUNT } from './constants';
import type { SearchOptions, ClassNames, PageData, SearchContext } from '../types';

export interface SearchControllerOptions {
  classNames?: Pick<ClassNames, 'highlight' | 'activeHighlight'>;
}

/**
 * Headless search + highlight controller.
 * Does NOT render PDF — works with any PageData[] you provide.
 *
 * Use this when you want full control over:
 * - Where the PDF is rendered
 * - Where the search UI lives
 * - How search results are displayed
 *
 * Usage:
 * ```js
 * import { PDFRenderer, SearchController } from 'pdf-search-highlight';
 *
 * // Render PDF wherever you want
 * const renderer = new PDFRenderer(pdfContainer, pdfjsLib, {});
 * const pages = await renderer.renderAllPages();
 *
 * // Search controller — no UI, just logic
 * const search = new SearchController();
 * search.setPages(pages);
 *
 * // Wire up your own UI
 * input.oninput = () => search.search(input.value);
 * nextBtn.onclick = () => search.next();
 * prevBtn.onclick = () => search.prev();
 *
 * // React to changes
 * search.onChange = ({ current, total }) => {
 *   label.textContent = total > 0 ? `${current + 1}/${total}` : '';
 * };
 * ```
 */
export class SearchController {
  private highlightManager: HighlightManager;
  private pages: PageData[] = [];
  private lastQuery = '';
  private lastSearchOptions: SearchOptions = {};
  private lastContexts: SearchContext[] = [];
  private lastIsMultiContext = false;

  /** Callback fired when match state changes (search, next, prev, clear). */
  onChange: ((state: { current: number; total: number; query: string }) => void) | null = null;

  constructor(options: SearchControllerOptions = {}) {
    const cls = { ...DEFAULT_CLASS_NAMES, ...options.classNames };
    this.highlightManager = new HighlightManager(cls.highlight, cls.activeHighlight);
  }

  /**
   * Set the pages to search on.
   * Call this after rendering PDF pages.
   */
  setPages(pages: PageData[]): void {
    const savedQuery = this.lastQuery;
    const savedOptions = this.lastSearchOptions;
    const savedContexts = [...this.lastContexts];
    const savedIsMulti = this.lastIsMultiContext;

    this.clear();
    this.pages = pages;

    // Re-apply search if there was an active query (e.g. after zoom)
    if (savedIsMulti && savedContexts.length > 0) {
      this.searchMultiple(savedContexts, savedOptions);
    } else if (savedQuery.trim()) {
      this.search(savedQuery, savedOptions);
    }
  }

  /**
   * Search for text across all pages.
   * Returns total number of matches.
   */
  search(query: string, options: SearchOptions = {}): number {
    this.highlightManager.clearHighlights(this.pages);
    this.lastQuery = query;
    this.lastSearchOptions = options;
    this.lastIsMultiContext = false;
    this.lastContexts = [];

    const trimmed = query.trim();
    if (!trimmed) {
      this.notify();
      return 0;
    }

    for (const pd of this.pages) {
      const matchRanges = searchPage(pd.spans, trimmed, options);
      const matches = this.highlightManager.applyHighlights(pd.spans, matchRanges);
      this.highlightManager.addMatches(matches);
    }

    const total = this.highlightManager.getTotal();
    if (total > 0) {
      this.highlightManager.setActiveMatch(0);
    }

    this.notify();
    return total;
  }

  /**
   * Search for multiple query contexts across all pages.
   * Each context is highlighted with a different CSS class (highlight-0, highlight-1, ...).
   * Navigation (next/prev) cycles through ALL matches in document order.
   * Returns total number of matches across all contexts.
   */
  searchMultiple(contexts: SearchContext[], sharedOptions: SearchOptions = {}): number {
    this.highlightManager.clearHighlights(this.pages);
    this.lastContexts = contexts;
    this.lastIsMultiContext = true;
    this.lastQuery = '';
    this.lastSearchOptions = sharedOptions;

    const validContexts = contexts.filter((c) => c.query.trim());
    if (validContexts.length === 0) {
      this.notify();
      return 0;
    }

    for (const pd of this.pages) {
      // 1. Search all contexts on this page
      const allMatchRanges: MatchRange[][] = [];
      const classPerMatch: string[] = [];

      for (let ci = 0; ci < validContexts.length; ci++) {
        const ctx = validContexts[ci];
        const opts = { ...sharedOptions, ...ctx.options };
        const pageMatches = searchPage(pd.spans, ctx.query.trim(), opts);

        for (const matchRange of pageMatches) {
          allMatchRanges.push(matchRange);
          classPerMatch.push(`highlight-${ci % MULTI_CONTEXT_COLOR_COUNT}`);
        }
      }

      // 2. Sort all matches by document position (span index, then char offset)
      const indices = allMatchRanges.map((_, i) => i);
      indices.sort((a, b) => {
        const aFirst = allMatchRanges[a][0];
        const bFirst = allMatchRanges[b][0];
        if (!aFirst || !bFirst) return 0;
        if (aFirst.spanIdx !== bFirst.spanIdx) return aFirst.spanIdx - bFirst.spanIdx;
        return aFirst.start - bFirst.start;
      });

      const sortedRanges = indices.map((i) => allMatchRanges[i]);
      const sortedClasses = indices.map((i) => classPerMatch[i]);

      // 3. Apply highlights with per-match classes
      const matches = this.highlightManager.applyHighlights(
        pd.spans,
        sortedRanges,
        sortedClasses
      );
      this.highlightManager.addMatches(matches);
    }

    const total = this.highlightManager.getTotal();
    if (total > 0) {
      this.highlightManager.setActiveMatch(0);
    }

    this.notify();
    return total;
  }

  /** Navigate to next match. Returns new index. */
  next(): number {
    const idx = this.highlightManager.next();
    this.notify();
    return idx;
  }

  /** Navigate to previous match. Returns new index. */
  prev(): number {
    const idx = this.highlightManager.prev();
    this.notify();
    return idx;
  }

  /** Go to a specific match by index. */
  goTo(index: number): void {
    this.highlightManager.setActiveMatch(index);
    this.notify();
  }

  /** Clear all highlights. */
  clear(): void {
    this.highlightManager.clearHighlights(this.pages);
    this.lastQuery = '';
    this.lastContexts = [];
    this.lastIsMultiContext = false;
    this.notify();
  }

  /** Current match index (0-based). -1 if none. */
  get current(): number {
    return this.highlightManager.getCurrentIndex();
  }

  /** Total number of matches. */
  get total(): number {
    return this.highlightManager.getTotal();
  }

  /** Last searched query. */
  get query(): string {
    return this.lastQuery;
  }

  /** Last searched contexts (for multi-context search). */
  get contexts(): SearchContext[] {
    return this.lastContexts;
  }

  private notify(): void {
    this.onChange?.({
      current: this.highlightManager.getCurrentIndex(),
      total: this.highlightManager.getTotal(),
      query: this.lastQuery,
    });
  }
}
