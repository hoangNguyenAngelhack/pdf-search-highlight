import { searchPage } from './SearchEngine';
import { HighlightManager } from './HighlightManager';
import { DEFAULT_CLASS_NAMES } from './constants';
import type { SearchOptions, ClassNames, PageData } from '../types';

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
    this.clear();
    this.pages = pages;
  }

  /**
   * Search for text across all pages.
   * Returns total number of matches.
   */
  search(query: string, options: SearchOptions = {}): number {
    this.highlightManager.clearHighlights(this.pages);
    this.lastQuery = query;

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

  private notify(): void {
    this.onChange?.({
      current: this.highlightManager.getCurrentIndex(),
      total: this.highlightManager.getTotal(),
      query: this.lastQuery,
    });
  }
}
