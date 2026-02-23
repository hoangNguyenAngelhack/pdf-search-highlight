import { EventEmitter } from './EventEmitter';
import { PDFRenderer } from './PDFRenderer';
import { searchPage } from './SearchEngine';
import { HighlightManager } from './HighlightManager';
import { DEFAULT_CLASS_NAMES } from './constants';
import type {
  PDFSearchViewerOptions,
  SearchOptions,
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
    this.emit('search', { query: '', total: 0 });
    this.emit('matchchange', { current: -1, total: 0 });
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
