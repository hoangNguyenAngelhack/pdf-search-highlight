import { useRef, useEffect, useCallback, useState } from 'react';
import { PDFRenderer } from '../core/PDFRenderer';
import type { PDFSearchViewerOptions, PageData, PDFSource } from '../core';

export interface UsePDFRendererReturn {
  /** Ref to attach to the container div */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Rendered page data (available after loading) */
  pages: PageData[];
  /** Number of pages */
  pageCount: number;
  /** Whether PDF is currently loading */
  loading: boolean;
  /** Load a PDF source */
  loadPDF: (source: PDFSource) => Promise<PageData[]>;
  /** Clean up renderer */
  cleanup: () => void;
}

/**
 * Hook for rendering PDF into a container div.
 * Returns pages data that can be passed to useSearchController.
 *
 * ```tsx
 * const { containerRef, pages, loadPDF } = usePDFRenderer(pdfjsLib);
 *
 * return <div ref={containerRef} style={{ height: '80vh', overflow: 'auto' }} />;
 * ```
 */
export function usePDFRenderer(
  pdfjsLib: any,
  options: PDFSearchViewerOptions = {}
): UsePDFRendererReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<PDFRenderer | null>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Init renderer when container is available
  useEffect(() => {
    return () => {
      rendererRef.current?.cleanup();
      rendererRef.current = null;
    };
  }, []);

  const getRenderer = useCallback(() => {
    if (!containerRef.current) throw new Error('Container ref not attached');
    if (!rendererRef.current) {
      const r = new PDFRenderer(containerRef.current, options);
      r.setPdfjsLib(pdfjsLib);
      rendererRef.current = r;
    }
    return rendererRef.current;
  }, [pdfjsLib, options]);

  const loadPDF = useCallback(
    async (source: PDFSource): Promise<PageData[]> => {
      const renderer = getRenderer();
      setLoading(true);
      try {
        const count = await renderer.loadDocument(source);
        const p = await renderer.renderAllPages();
        setPages(p);
        setPageCount(count);
        return p;
      } finally {
        setLoading(false);
      }
    },
    [getRenderer]
  );

  const cleanup = useCallback(() => {
    rendererRef.current?.cleanup();
    rendererRef.current = null;
    setPages([]);
    setPageCount(0);
  }, []);

  return { containerRef, pages, pageCount, loading, loadPDF, cleanup };
}
