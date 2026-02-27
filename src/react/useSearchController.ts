import { useRef, useEffect, useCallback, useState } from 'react';
import { SearchController } from '../core/SearchController';
import type { SearchOptions, ClassNames, PageData, SearchContext } from '../core';

export interface UseSearchControllerReturn {
  /** Run a search query */
  search: (query: string, options?: SearchOptions) => number;
  /** Search multiple contexts with different highlight colors */
  searchMultiple: (contexts: SearchContext[], options?: SearchOptions) => number;
  /** Go to next match */
  next: () => void;
  /** Go to previous match */
  prev: () => void;
  /** Go to specific match index */
  goTo: (index: number) => void;
  /** Clear all highlights */
  clear: () => void;
  /** Current active match index (0-based), -1 if none */
  current: number;
  /** Total number of matches */
  total: number;
}

export interface UseSearchControllerOptions {
  classNames?: Pick<ClassNames, 'highlight' | 'activeHighlight'>;
}

/**
 * Hook for search + highlight logic (headless).
 * Pass pages from usePDFRenderer to connect them.
 *
 * ```tsx
 * const { containerRef, pages, loadPDF } = usePDFRenderer(pdfjsLib);
 * const { search, searchMultiple, next, prev, current, total } = useSearchController(pages);
 *
 * return (
 *   <>
 *     <input onChange={e => search(e.target.value)} />
 *     <span>{current + 1}/{total}</span>
 *     <button onClick={prev}>Prev</button>
 *     <button onClick={next}>Next</button>
 *     <div ref={containerRef} />
 *   </>
 * );
 * ```
 */
export function useSearchController(
  pages: PageData[],
  options: UseSearchControllerOptions = {}
): UseSearchControllerReturn {
  const controllerRef = useRef<SearchController | null>(null);
  const [current, setCurrent] = useState(-1);
  const [total, setTotal] = useState(0);

  // Create controller once
  if (!controllerRef.current) {
    controllerRef.current = new SearchController(options);
  }

  // Sync onChange callback
  useEffect(() => {
    const ctrl = controllerRef.current!;
    ctrl.onChange = ({ current: c, total: t }) => {
      setCurrent(c);
      setTotal(t);
    };
    return () => {
      ctrl.onChange = null;
    };
  }, []);

  // Update pages when they change
  useEffect(() => {
    controllerRef.current!.setPages(pages);
  }, [pages]);

  const search = useCallback((query: string, opts?: SearchOptions) => {
    return controllerRef.current!.search(query, opts);
  }, []);

  const searchMultiple = useCallback(
    (contexts: SearchContext[], opts?: SearchOptions) => {
      return controllerRef.current!.searchMultiple(contexts, opts);
    },
    []
  );

  const next = useCallback(() => {
    controllerRef.current!.next();
  }, []);

  const prev = useCallback(() => {
    controllerRef.current!.prev();
  }, []);

  const goTo = useCallback((index: number) => {
    controllerRef.current!.goTo(index);
  }, []);

  const clear = useCallback(() => {
    controllerRef.current!.clear();
  }, []);

  return { search, searchMultiple, next, prev, goTo, clear, current, total };
}
