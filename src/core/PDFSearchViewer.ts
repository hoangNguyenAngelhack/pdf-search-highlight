import { EventEmitter } from './EventEmitter';
import { PDFRenderer } from './PDFRenderer';
import { searchPage } from './SearchEngine';
import type { MatchRange } from './SearchEngine';
import { HighlightManager } from './HighlightManager';
import { DEFAULT_CLASS_NAMES, ZOOM_STEP, MIN_SCALE, MAX_SCALE, MULTI_CONTEXT_COLOR_COUNT } from './constants';
import type {
  PDFSearchViewerOptions,
  SearchOptions,
  SearchContext,
  PDFSearchViewerEventMap,
  PageData,
} from '../types';

export type PDFSource = File | ArrayBuffer | Uint8Array | string;

/**
 * Main PDF viewer with search and highlight functionality.
 *
 * Usage:
 * ```js
 * import * as pdfjsLib from 'pdfjs-dist';
 * import { PDFSearchViewer } from 'pdf-search-highlight';
 *
 * const viewer = new PDFSearchViewer(container, pdfjsLib, {
 *   classNames: {
 *     page: 'my-page',
 *     highlight: 'my-highlight',
 *     activeHighlight: 'my-active',
 *   }
 * });
 * await viewer.loadPDF(file);
 * viewer.search('hello');
 * viewer.nextMatch();
 * ```
 */
export class PDFSearchViewer extends EventEmitter<PDFSearchViewerEventMap> {
  private renderer: PDFRenderer;
  private highlightManager: HighlightManager;
  private pageData: PageData[] = [];
  private lastQuery = '';
  private lastSearchOptions: SearchOptions = {};
  private lastContexts: SearchContext[] = [];
  private lastIsMultiContext = false;
  private destroyed = false;

  constructor(
    container: HTMLElement,
    pdfjsLib: any,
    options: PDFSearchViewerOptions = {}
  ) {
    super();

    const cls = { ...DEFAULT_CLASS_NAMES, ...options.classNames };

    this.renderer = new PDFRenderer(container, options);
    this.renderer.setPdfjsLib(pdfjsLib);
    this.highlightManager = new HighlightManager(
      cls.highlight,
      cls.activeHighlight
    );
  }

  /**
   * Load and render a PDF document.
   */
  async loadPDF(source: PDFSource): Promise<void> {
    if (this.destroyed) throw new Error('PDFSearchViewer has been destroyed');

    try {
      await this.renderer.loadDocument(source);
      this.pageData = await this.renderer.renderAllPages();
      const pageCount = this.renderer.getPageCount();
      this.emit('load', { pageCount });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('error', { error, context: 'loadPDF' });
      throw error;
    }
  }

  /**
   * Search for text across all pages.
   * Clears previous highlights and creates new ones.
   */
  search(query: string, options: SearchOptions = {}): number {
    if (this.destroyed) throw new Error('PDFSearchViewer has been destroyed');

    // Clear previous highlights
    this.highlightManager.clearHighlights(this.pageData);
    this.lastQuery = query;
    this.lastSearchOptions = options;
    this.lastIsMultiContext = false;
    this.lastContexts = [];

    const trimmed = query.trim();
    if (!trimmed) {
      this.emit('search', { query, total: 0 });
      this.emit('matchchange', { current: -1, total: 0 });
      return 0;
    }

    // Search each page and apply highlights
    for (const pd of this.pageData) {
      const matchRanges = searchPage(pd.spans, trimmed, options);
      const matches = this.highlightManager.applyHighlights(pd.spans, matchRanges);
      this.highlightManager.addMatches(matches);
    }

    const total = this.highlightManager.getTotal();

    // Auto-activate first match
    if (total > 0) {
      this.highlightManager.setActiveMatch(0);
    }

    this.emit('search', { query, total });
    this.emit('matchchange', {
      current: total > 0 ? 0 : -1,
      total,
    });

    return total;
  }

  /**
   * Search for multiple query contexts across all pages.
   * Each context is highlighted with a different color (highlight-0, highlight-1, ...).
   * Navigation (nextMatch/prevMatch) cycles through ALL matches in document order.
   * Returns total number of matches across all contexts.
   */
  searchMultiple(contexts: SearchContext[], sharedOptions: SearchOptions = {}): number {
    if (this.destroyed) throw new Error('PDFSearchViewer has been destroyed');

    this.highlightManager.clearHighlights(this.pageData);
    this.lastContexts = contexts;
    this.lastIsMultiContext = true;
    this.lastQuery = '';
    this.lastSearchOptions = sharedOptions;

    const validContexts = contexts.filter((c) => c.query.trim());
    if (validContexts.length === 0) {
      this.emit('searchmultiple', { contexts, total: 0, totalsPerContext: contexts.map(() => 0) });
      this.emit('matchchange', { current: -1, total: 0 });
      return 0;
    }

    const totalsPerContext = new Array(validContexts.length).fill(0);

    for (const pd of this.pageData) {
      const allMatchRanges: MatchRange[][] = [];
      const classPerMatch: string[] = [];
      const contextPerMatch: number[] = [];

      for (let ci = 0; ci < validContexts.length; ci++) {
        const ctx = validContexts[ci];
        const opts = { ...sharedOptions, ...ctx.options };
        const pageMatches = searchPage(pd.spans, ctx.query.trim(), opts);

        for (const matchRange of pageMatches) {
          allMatchRanges.push(matchRange);
          classPerMatch.push(`highlight-${ci % MULTI_CONTEXT_COLOR_COUNT}`);
          contextPerMatch.push(ci);
        }
      }

      // Sort all matches by document position
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

      // Count per context
      for (const i of indices) {
        totalsPerContext[contextPerMatch[i]]++;
      }

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

    this.emit('searchmultiple', { contexts, total, totalsPerContext });
    this.emit('matchchange', {
      current: total > 0 ? 0 : -1,
      total,
    });

    return total;
  }

  /**
   * Navigate to next match (wraps around).
   */
  nextMatch(): number {
    const idx = this.highlightManager.next();
    this.emit('matchchange', {
      current: idx,
      total: this.highlightManager.getTotal(),
    });
    return idx;
  }

  /**
   * Navigate to previous match (wraps around).
   */
  prevMatch(): number {
    const idx = this.highlightManager.prev();
    this.emit('matchchange', {
      current: idx,
      total: this.highlightManager.getTotal(),
    });
    return idx;
  }

  /**
   * Clear all search highlights.
   */
  clearSearch(): void {
    this.highlightManager.clearHighlights(this.pageData);
    this.lastQuery = '';
    this.lastContexts = [];
    this.lastIsMultiContext = false;
    this.emit('search', { query: '', total: 0 });
    this.emit('matchchange', { current: -1, total: 0 });
  }

  /** Get the current scale setting. */
  getScale(): number | 'auto' {
    return this.renderer.getScale();
  }

  /** Set scale and re-render. Preserves current search state. */
  async setScale(scale: number | 'auto'): Promise<void> {
    if (this.destroyed) throw new Error('PDFSearchViewer has been destroyed');
    this.renderer.setScale(scale);
    await this.rerender();
    this.emit('zoom', { scale: this.renderer.getEffectiveScale() });
  }

  /** Zoom in by one step. */
  async zoomIn(): Promise<void> {
    const current = this.resolveCurrentScale();
    const newScale = Math.min(current + ZOOM_STEP, MAX_SCALE);
    await this.setScale(newScale);
  }

  /** Zoom out by one step. */
  async zoomOut(): Promise<void> {
    const current = this.resolveCurrentScale();
    const newScale = Math.max(current - ZOOM_STEP, MIN_SCALE);
    await this.setScale(newScale);
  }

  /** Download the currently loaded PDF. */
  async download(filename?: string): Promise<void> {
    if (this.destroyed) throw new Error('PDFSearchViewer has been destroyed');
    await this.renderer.download(filename);
  }

  private resolveCurrentScale(): number {
    const s = this.renderer.getScale();
    return s === 'auto' ? this.renderer.getEffectiveScale() : s;
  }

  private async rerender(): Promise<void> {
    this.highlightManager.clearHighlights(this.pageData);
    this.pageData = await this.renderer.renderAllPages();

    if (this.lastIsMultiContext && this.lastContexts.length > 0) {
      this.searchMultiple(this.lastContexts, this.lastSearchOptions);
    } else if (this.lastQuery.trim()) {
      this.search(this.lastQuery, this.lastSearchOptions);
    }
  }

  /**
   * Get total number of pages.
   */
  getPageCount(): number {
    return this.renderer.getPageCount();
  }

  /**
   * Get current active match index (0-based). -1 if none.
   */
  getCurrentMatchIndex(): number {
    return this.highlightManager.getCurrentIndex();
  }

  /**
   * Get total number of matches.
   */
  getMatchCount(): number {
    return this.highlightManager.getTotal();
  }

  /**
   * Destroy the viewer, release all resources.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.highlightManager.clearHighlights(this.pageData);
    this.renderer.cleanup();
    this.removeAllListeners();
    this.pageData = [];
  }
}
