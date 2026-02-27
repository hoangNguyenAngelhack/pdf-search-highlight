import type { SearchContext } from './results';

export type PDFSearchViewerEventMap = {
  /** Fired when PDF finishes loading. */
  load: { pageCount: number };

  /** Fired when a search completes. */
  search: { query: string; total: number };

  /** Fired when a multi-context search completes. */
  searchmultiple: { contexts: SearchContext[]; total: number; totalsPerContext: number[] };

  /** Fired when active match changes (via next/prev). */
  matchchange: { current: number; total: number };

  /** Fired when zoom/scale changes. */
  zoom: { scale: number };

  /** Fired on error. */
  error: { error: Error; context: string };
};
