import { useState, useCallback, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { usePDFRenderer, useSearchController } from 'pdf-search-highlight/react';
import 'pdf-search-highlight/styles.css';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export default function App() {
  const [query, setQuery] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // PDF renderer — renders into containerRef
  const { containerRef, pages, loadPDF } = usePDFRenderer(pdfjsLib);

  // Search controller — headless, connected to rendered pages
  const { search, next, prev, current, total } = useSearchController(pages);

  // Load PDF when file changes
  useEffect(() => {
    if (file) loadPDF(file);
  }, [file, loadPDF]);

  // Debounced search when query changes
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(query, { caseSensitive });
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, caseSensitive, search]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.shiftKey ? prev() : next();
      }
    },
    [next, prev]
  );

  const matchInfo = total > 0
    ? `${current + 1}/${total}`
    : query.trim() ? '0 results' : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* Search UI — completely separate from PDF container */}
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

      {/* PDF container — just a div with a ref, can be placed anywhere */}
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
