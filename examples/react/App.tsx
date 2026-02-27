import { useState, useCallback, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { usePDFRenderer, useSearchController } from 'pdf-search-highlight/react';
import type { SearchContext } from 'pdf-search-highlight/react';
import 'pdf-search-highlight/styles.css';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Colors matching CSS highlight-0 through highlight-7
const CONTEXT_COLORS = [
  'rgba(255, 230, 0, 0.7)',
  'rgba(0, 200, 255, 0.65)',
  'rgba(0, 230, 120, 0.65)',
  'rgba(255, 150, 0, 0.7)',
  'rgba(190, 100, 255, 0.65)',
  'rgba(255, 100, 150, 0.65)',
  'rgba(130, 190, 255, 0.65)',
  'rgba(200, 220, 100, 0.7)',
];

export default function App() {
  const [query, setQuery] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [fuzzy, setFuzzy] = useState(false);
  const [fuzzyThreshold, setFuzzyThreshold] = useState(0.6);
  const [isMultiMode, setIsMultiMode] = useState(false);
  const [contexts, setContexts] = useState<string[]>(['', '']);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // PDF renderer
  const { containerRef, pages, loadPDF, zoomIn, zoomOut, download, scale } = usePDFRenderer(pdfjsLib);

  // Search controller
  const { search, searchMultiple, next, prev, clear, current, total } = useSearchController(pages);

  // Load PDF when file changes
  useEffect(() => {
    if (file) loadPDF(file);
  }, [file, loadPDF]);

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const opts = { caseSensitive, fuzzy, fuzzyThreshold };
      if (isMultiMode) {
        const searchContexts: SearchContext[] = contexts.map((q) => ({ query: q }));
        if (searchContexts.every((c) => !c.query.trim())) {
          clear();
        } else {
          searchMultiple(searchContexts, opts);
        }
      } else {
        search(query, opts);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, contexts, isMultiMode, caseSensitive, fuzzy, fuzzyThreshold, search, searchMultiple, clear]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.shiftKey ? prev() : next();
      }
    },
    [next, prev]
  );

  const hasActiveQuery = isMultiMode
    ? contexts.some((c) => c.trim())
    : query.trim();

  const matchInfo = total > 0
    ? `${current + 1}/${total}`
    : hasActiveQuery ? '0 results' : '';

  const updateContext = (index: number, value: string) => {
    setContexts((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const removeContext = (index: number) => {
    setContexts((prev) => prev.filter((_, i) => i !== index));
  };

  const addContext = () => {
    setContexts((prev) => [...prev, '']);
  };

  const toggleMultiMode = () => {
    clear();
    setIsMultiMode((prev) => !prev);
    setContexts(['', '']);
    setQuery('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* Toolbar */}
      <div
        style={{
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: '#16213e',
          color: '#fff',
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ fontSize: 16, color: '#e94560', margin: 0 }}>
          PDF Search Highlight
        </h1>

        {/* Single search input */}
        {!isMultiMode && (
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search in PDF..."
            disabled={!file}
            style={{
              background: '#0f3460',
              border: 'none',
              borderRadius: 8,
              padding: '6px 12px',
              color: '#fff',
              fontSize: 14,
              flex: 1,
              maxWidth: 400,
            }}
          />
        )}

        <button onClick={prev} disabled={total === 0}>&#9664;</button>
        <span style={{ color: '#aaa', minWidth: 60, textAlign: 'center' }}>
          {matchInfo}
        </span>
        <button onClick={next} disabled={total === 0}>&#9654;</button>

        <label style={{ fontSize: 12, color: '#aaa', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          />{' '}
          Case sensitive
        </label>

        <label style={{ fontSize: 12, color: '#aaa', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={fuzzy}
            onChange={(e) => setFuzzy(e.target.checked)}
          />{' '}
          Fuzzy
        </label>

        <label style={{ fontSize: 12, color: '#aaa' }}>
          Threshold{' '}
          <select
            value={fuzzyThreshold}
            onChange={(e) => setFuzzyThreshold(parseFloat(e.target.value))}
            disabled={!fuzzy}
            style={{
              background: '#0f3460',
              color: '#e0e0e0',
              border: '1px solid #0f3460',
              borderRadius: 4,
              padding: '2px 4px',
              fontSize: 12,
            }}
          >
            <option value={0.9}>0.9</option>
            <option value={0.7}>0.7</option>
            <option value={0.6}>0.6</option>
            <option value={0.4}>0.4</option>
          </select>
        </label>

        <button
          onClick={toggleMultiMode}
          style={{
            background: isMultiMode ? '#0f3460' : '#e94560',
            border: isMultiMode ? '1px solid #e94560' : 'none',
            color: '#fff',
            borderRadius: 6,
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Multi
        </button>

        <button onClick={zoomOut} disabled={!file}>-</button>
        <span style={{ color: '#aaa', fontSize: 12, minWidth: 40, textAlign: 'center' }}>
          {typeof scale === 'number' ? `${Math.round(scale * 100)}%` : 'auto'}
        </span>
        <button onClick={zoomIn} disabled={!file}>+</button>

        <button
          onClick={() => download(file?.name)}
          disabled={!file}
          style={{ fontSize: 13 }}
        >
          Download
        </button>

        <label
          style={{
            background: '#e94560',
            padding: '6px 12px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Choose PDF
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
            }}
            hidden
          />
        </label>
      </div>

      {/* Multi-context search panel */}
      {isMultiMode && (
        <div
          style={{
            background: '#16213e',
            padding: '8px 20px 12px',
            borderBottom: '1px solid #0f3460',
          }}
        >
          <div style={{ fontSize: 13, color: '#aaa', marginBottom: 8 }}>
            Multi-context search — each query highlighted with a different color
          </div>
          {contexts.map((ctx, i) => (
            <div
              key={i}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  flexShrink: 0,
                  background: CONTEXT_COLORS[i % CONTEXT_COLORS.length],
                }}
              />
              <input
                type="text"
                value={ctx}
                onChange={(e) => updateContext(i, e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Search context ${i + 1}...`}
                disabled={!file}
                style={{
                  background: '#0f3460',
                  border: 'none',
                  borderRadius: 6,
                  padding: '5px 10px',
                  color: '#fff',
                  fontSize: 13,
                  flex: 1,
                  maxWidth: 300,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => removeContext(i)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#666',
                  cursor: 'pointer',
                  fontSize: 16,
                  padding: '0 4px',
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>
          ))}
          <button
            onClick={addContext}
            style={{
              background: 'none',
              border: '1px dashed #555',
              color: '#888',
              borderRadius: 6,
              padding: '4px 12px',
              cursor: 'pointer',
              fontSize: 12,
              marginTop: 4,
            }}
          >
            + Add context
          </button>
        </div>
      )}

      {/* PDF container */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          background: '#1a1a2e',
        }}
      />
    </div>
  );
}
