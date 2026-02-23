import {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  type Ref,
  type CSSProperties,
} from 'react';
import {
  PDFSearchViewer as CorePDFSearchViewer,
  type PDFSearchViewerOptions,
  type SearchOptions,
  type PDFSource,
} from '../core';

export interface PDFSearchViewerProps {
  /** pdfjs-dist library instance. Must be passed by consumer. */
  pdfjsLib: any;

  /** PDF source: URL string, File, ArrayBuffer, or Uint8Array. */
  source?: PDFSource | null;

  /** Search query string. Empty/undefined clears the search. */
  searchQuery?: string;

  /** Search options. */
  searchOptions?: SearchOptions;

  /** Viewer options (applied once on mount). */
  viewerOptions?: PDFSearchViewerOptions;

  /** Called when PDF finishes loading. */
  onLoad?: (data: { pageCount: number }) => void;

  /** Called when search completes. */
  onSearch?: (data: { query: string; total: number }) => void;

  /** Called when active match changes. */
  onMatchChange?: (data: { current: number; total: number }) => void;

  /** Called on error. */
  onError?: (data: { error: Error; context: string }) => void;

  /** Additional className for the container div. */
  className?: string;

  /** Inline style for the container div. */
  style?: CSSProperties;
}

export interface PDFSearchViewerHandle {
  /** Navigate to next match. Returns new index. */
  nextMatch: () => number;
  /** Navigate to previous match. Returns new index. */
  prevMatch: () => number;
  /** Clear all search highlights. */
  clearSearch: () => void;
  /** Get total match count. */
  getMatchCount: () => number;
  /** Get current match index. */
  getCurrentMatchIndex: () => number;
  /** Get underlying core instance. */
  getCore: () => CorePDFSearchViewer | null;
}

export const PDFSearchViewer = forwardRef(function PDFSearchViewer(
  props: PDFSearchViewerProps,
  ref: Ref<PDFSearchViewerHandle>
) {
  const {
    pdfjsLib,
    source,
    searchQuery,
    searchOptions,
    viewerOptions,
    onLoad,
    onSearch,
    onMatchChange,
    onError,
    className,
    style,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<CorePDFSearchViewer | null>(null);

  // Store latest callbacks in refs to avoid re-subscribing
  const callbackRefs = useRef({ onLoad, onSearch, onMatchChange, onError });
  callbackRefs.current = { onLoad, onSearch, onMatchChange, onError };

  // Initialize core on mount
  useEffect(() => {
    if (!containerRef.current || !pdfjsLib) return;

    const core = new CorePDFSearchViewer(
      containerRef.current,
      pdfjsLib,
      viewerOptions ?? {}
    );

    core.on('load', (data) => callbackRefs.current.onLoad?.(data));
    core.on('search', (data) => callbackRefs.current.onSearch?.(data));
    core.on('matchchange', (data) => callbackRefs.current.onMatchChange?.(data));
    core.on('error', (data) => callbackRefs.current.onError?.(data));

    coreRef.current = core;

    return () => {
      core.destroy();
      coreRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfjsLib]);

  // Load PDF when source changes
  useEffect(() => {
    if (!coreRef.current || !source) return;
    coreRef.current.loadPDF(source).catch(() => {
      // Error already emitted via 'error' event
    });
  }, [source]);

  // Run search when query or options change
  useEffect(() => {
    if (!coreRef.current) return;

    if (searchQuery && searchQuery.trim().length > 0) {
      coreRef.current.search(searchQuery, searchOptions);
    } else {
      coreRef.current.clearSearch();
    }
  }, [searchQuery, searchOptions]);

  // Expose imperative methods via ref
  useImperativeHandle(ref, () => ({
    nextMatch: () => coreRef.current?.nextMatch() ?? -1,
    prevMatch: () => coreRef.current?.prevMatch() ?? -1,
    clearSearch: () => coreRef.current?.clearSearch(),
    getMatchCount: () => coreRef.current?.getMatchCount() ?? 0,
    getCurrentMatchIndex: () => coreRef.current?.getCurrentMatchIndex() ?? -1,
    getCore: () => coreRef.current,
  }));

  return <div ref={containerRef} className={className} style={style} />;
});
