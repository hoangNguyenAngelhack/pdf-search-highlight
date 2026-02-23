// All-in-one (PDF render + search + highlight)
export { PDFSearchViewer } from './PDFSearchViewer';
export type { PDFSource } from './PDFSearchViewer';

// Headless search controller (recommended for custom UI)
export { SearchController } from './SearchController';
export type { SearchControllerOptions } from './SearchController';

// Individual modules — for full control
export { PDFRenderer } from './PDFRenderer';
export { searchPage } from './SearchEngine';
export type { MatchRange } from './SearchEngine';
export { HighlightManager } from './HighlightManager';
export { EventEmitter } from './EventEmitter';
export { DEFAULT_CLASS_NAMES, DEFAULT_SCALE, DEFAULT_PAGE_GAP } from './constants';

// Types
export type {
  PDFSearchViewerOptions,
  SearchOptions,
  ClassNames,
  PDFSearchViewerEventMap,
  SearchMatch,
  PageData,
  SpanData,
} from '../types';
