/**
 * Custom CSS class names for each part of the viewer.
 * All are optional — defaults are applied if omitted.
 */
export interface ClassNames {
  /** Root container. Default: 'psh-container' */
  container?: string;
  /** Each page wrapper. Default: 'psh-page' */
  page?: string;
  /** Canvas element. Default: 'psh-canvas' */
  canvas?: string;
  /** Text layer overlay. Default: 'psh-text-layer' */
  textLayer?: string;
  /** Page label (e.g. "Page 1 / 5"). Default: 'psh-page-label' */
  pageLabel?: string;
  /** Highlight <mark>. Default: 'highlight' */
  highlight?: string;
  /** Active highlight modifier. Default: 'active' */
  activeHighlight?: string;
}

export interface PDFSearchViewerOptions {
  /** Scale factor. 'auto' = fit container width. Defaults to 'auto'. */
  scale?: number | 'auto';

  /** Path or URL to pdf.js worker script. */
  workerSrc?: string;

  /** Gap in pixels between rendered pages. Defaults to 20. */
  pageGap?: number;

  /**
   * Custom CSS class names for viewer elements.
   * Override any or all to apply your own styles.
   *
   * ```js
   * classNames: {
   *   page: 'my-page',
   *   highlight: 'my-highlight',
   *   activeHighlight: 'my-active',
   * }
   * ```
   */
  classNames?: ClassNames;
}

export interface SearchOptions {
  /** Case-sensitive matching. Defaults to false. */
  caseSensitive?: boolean;

  /**
   * Flexible whitespace matching: insert \s* between every character.
   * Handles PDF text split inconsistencies. Defaults to true.
   * Only applies for queries < 200 chars (performance).
   */
  flexibleWhitespace?: boolean;
}
