import { useRef, useEffect, useCallback, useState } from 'react';
import { PDFRenderer } from '../core/PDFRenderer';
import { ZOOM_STEP, MIN_SCALE, MAX_SCALE } from '../core/constants';
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
  /** Current scale value */
  scale: number | 'auto';
  /** Load a PDF source */
  loadPDF: (source: PDFSource) => Promise<PageData[]>;
  /** Set scale and re-render */
  setScale: (scale: number | 'auto') => Promise<PageData[]>;
  /** Zoom in by one step */
  zoomIn: () => Promise<PageData[]>;
  /** Zoom out by one step */
  zoomOut: () => Promise<PageData[]>;
  /** Download the loaded PDF */
  download: (filename?: string) => Promise<void>;
  /** Clean up renderer */
  cleanup: () => void;
}

/**
 * Hook for rendering PDF into a container div.
 * Returns pages data that can be passed to useSearchController.
 *
 * ```tsx
 * const { containerRef, pages, loadPDF, zoomIn, zoomOut, download } = usePDFRenderer(pdfjsLib);
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
  const [scale, setScaleState] = useState<number | 'auto'>(options.scale ?? 'auto');

  // Init renderer when container is available
  useEffect(() => {
    return () => {
      rendererRef.current?.cleanup();
      rendererRef.current = null;
    };
  }, []);

  // Store options in a ref so getRenderer/loadPDF don't depend on object identity
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const getRenderer = useCallback(() => {
    if (!containerRef.current) throw new Error('Container ref not attached');
    if (!rendererRef.current) {
      const r = new PDFRenderer(containerRef.current, optionsRef.current);
      r.setPdfjsLib(pdfjsLib);
      rendererRef.current = r;
    }
    return rendererRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfjsLib]);

  const loadPDF = useCallback(
    async (source: PDFSource): Promise<PageData[]> => {
      const renderer = getRenderer();
      setLoading(true);
      try {
        const count = await renderer.loadDocument(source);
        const p = await renderer.renderAllPages();
        setPages(p);
        setPageCount(count);
        setScaleState(renderer.getScale());
        return p;
      } finally {
        setLoading(false);
      }
    },
    [getRenderer]
  );

  const setScale = useCallback(
    async (newScale: number | 'auto'): Promise<PageData[]> => {
      const renderer = getRenderer();
      renderer.setScale(newScale);
      const p = await renderer.renderAllPages();
      setPages(p);
      setScaleState(newScale);
      return p;
    },
    [getRenderer]
  );

  const zoomIn = useCallback(async (): Promise<PageData[]> => {
    const renderer = getRenderer();
    const current = renderer.getScale() === 'auto'
      ? renderer.getEffectiveScale()
      : (renderer.getScale() as number);
    const newScale = Math.min(current + ZOOM_STEP, MAX_SCALE);
    return setScale(newScale);
  }, [getRenderer, setScale]);

  const zoomOut = useCallback(async (): Promise<PageData[]> => {
    const renderer = getRenderer();
    const current = renderer.getScale() === 'auto'
      ? renderer.getEffectiveScale()
      : (renderer.getScale() as number);
    const newScale = Math.max(current - ZOOM_STEP, MIN_SCALE);
    return setScale(newScale);
  }, [getRenderer, setScale]);

  const download = useCallback(
    async (filename?: string) => {
      const renderer = getRenderer();
      await renderer.download(filename);
    },
    [getRenderer]
  );

  const cleanup = useCallback(() => {
    rendererRef.current?.cleanup();
    rendererRef.current = null;
    setPages([]);
    setPageCount(0);
  }, []);

  return {
    containerRef, pages, pageCount, loading, scale,
    loadPDF, setScale, zoomIn, zoomOut, download, cleanup,
  };
}
