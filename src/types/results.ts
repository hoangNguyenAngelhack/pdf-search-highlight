/**
 * A single search match, potentially spanning multiple spans.
 * Each match contains an array of <mark> elements that highlight
 * the matched text across one or more text layer spans.
 */
export interface SearchMatch {
  /** The <mark> elements for this match (may span multiple spans). */
  marks: HTMLElement[];
}

/**
 * Internal span data for a rendered page.
 */
export interface SpanData {
  /** The DOM element in the text layer. */
  el: HTMLElement;
  /** Original text content. */
  text: string;
  /** Whether this span has end-of-line. */
  hasEOL: boolean;
}

/**
 * Internal page data after rendering.
 */
export interface PageData {
  /** Page wrapper container element. */
  container: HTMLElement;
  /** All text spans on this page. */
  spans: SpanData[];
}

/**
 * A single search context for multi-context search.
 * Each context represents a separate query highlighted with a distinct color.
 */
export interface SearchContext {
  /** The query string to search for. */
  query: string;
  /** Optional per-context search options (overrides shared options). */
  options?: import('./options').SearchOptions;
}
