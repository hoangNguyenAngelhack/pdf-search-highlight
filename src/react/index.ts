// Hooks (recommended — full control over UI layout)
export { usePDFRenderer } from './usePDFRenderer';
export type { UsePDFRendererReturn } from './usePDFRenderer';
export { useSearchController } from './useSearchController';
export type { UseSearchControllerReturn, UseSearchControllerOptions } from './useSearchController';

// All-in-one component (convenience)
export { PDFSearchViewer } from './PDFSearchViewer';
export type { PDFSearchViewerProps, PDFSearchViewerHandle } from './PDFSearchViewer';

// Re-export core types
export type {
  PDFSearchViewerOptions,
  SearchOptions,
  ClassNames,
  SearchMatch,
  PageData,
  PDFSource,
} from '../core';
