# pdf-search-highlight

PDF viewer with text search and highlight. Render PDF, search text with flexible whitespace matching or fuzzy (approximate) matching, and navigate between highlighted results. Supports multi-context search with different highlight colors. Zoom in/out and download PDF files.

Built on [pdf.js](https://mozilla.github.io/pdf.js/). Works with Vanilla JS and React.

## Install

```bash
npm install pdf-search-highlight pdfjs-dist
```

## Features

- Render PDF pages (canvas + text layer)
- Search with flexible whitespace matching — handles inconsistent PDF text splitting
- Fuzzy (approximate) search — find text even with typos or OCR errors
- **Multi-context search** — search multiple queries simultaneously, each highlighted with a different color
- Cross-span highlight using `<mark>` elements
- Navigate between matches (next/prev, auto-scroll)
- Toggle auto-scroll on/off — disable scrolling to active match when needed
- Zoom in/out with configurable scale
- Download loaded PDF files
- Case sensitive toggle
- Custom CSS class names
- Separate UI and PDF rendering — put search bar anywhere
- Search highlights preserved across zoom changes

## Usage

### Vanilla JS

```js
import { PDFRenderer, SearchController } from 'pdf-search-highlight';
import 'pdf-search-highlight/styles.css';

// Render PDF
const renderer = new PDFRenderer(document.getElementById('pdf'), {});
renderer.setPdfjsLib(pdfjsLib);
await renderer.loadDocument(file);
const pages = await renderer.renderAllPages();

// Search (headless — no UI)
const search = new SearchController();
search.setPages(pages);

search.onChange = ({ current, total }) => {
  console.log(`Match ${current + 1} of ${total}`);
};

search.search('hello world');
search.search('helo wrld', { fuzzy: true, fuzzyThreshold: 0.6 }); // approximate match
search.next();
search.prev();
search.clear();

// Multi-context search — each query gets a different highlight color
search.searchMultiple([
  { query: 'contract' },
  { query: 'payment' },
  { query: 'deadline' },
]);

// With per-context options
search.searchMultiple([
  { query: 'contract' },
  { query: 'payement', options: { fuzzy: true, fuzzyThreshold: 0.7 } },
]);

// Zoom
renderer.setScale(1.5);
const newPages = await renderer.renderAllPages();
search.setPages(newPages); // re-applies search highlights automatically

// Download
await renderer.download('document.pdf');
```

### Vanilla JS (All-in-One)

```js
import { PDFSearchViewer } from 'pdf-search-highlight';
import 'pdf-search-highlight/styles.css';

const viewer = new PDFSearchViewer(container, pdfjsLib, {
  scale: 'auto', // or a number like 1.5
  pageGap: 20,
  autoScroll: true, // set false to disable scroll-to-match
});

await viewer.loadPDF(file);
viewer.search('query');
viewer.nextMatch();

// Multi-context search
viewer.searchMultiple([
  { query: 'contract' },
  { query: 'payment' },
  { query: 'deadline' },
]);
viewer.nextMatch(); // navigates through ALL matches in document order

// Zoom
await viewer.zoomIn();
await viewer.zoomOut();
await viewer.setScale(2.0);

// Download
await viewer.download('document.pdf');

// Events
viewer.on('load', ({ pageCount }) => console.log('Pages:', pageCount));
viewer.on('search', ({ query, total }) => console.log('Found:', total));
viewer.on('searchmultiple', ({ contexts, total, totalsPerContext }) => {
  console.log('Multi-search:', total, 'total matches');
});
viewer.on('matchchange', ({ current, total }) => console.log(`${current + 1}/${total}`));
viewer.on('zoom', ({ scale }) => console.log('Scale:', scale));
viewer.on('error', ({ error, context }) => console.error(context, error));
```

### React (Hooks)

```tsx
import { usePDFRenderer, useSearchController } from 'pdf-search-highlight/react';
import 'pdf-search-highlight/styles.css';

function App() {
  const { containerRef, pages, loadPDF, zoomIn, zoomOut, download, scale } =
    usePDFRenderer(pdfjsLib);
  const { search, searchMultiple, next, prev, current, total } =
    useSearchController(pages);

  return (
    <>
      {/* Single search */}
      <input onChange={e => search(e.target.value)} />
      <span>{total > 0 ? `${current + 1}/${total}` : ''}</span>
      <button onClick={prev}>Prev</button>
      <button onClick={next}>Next</button>

      {/* Multi-context search */}
      <button onClick={() => searchMultiple([
        { query: 'contract' },
        { query: 'payment' },
      ])}>
        Search Multiple
      </button>

      {/* Zoom & download */}
      <button onClick={zoomOut}>-</button>
      <button onClick={zoomIn}>+</button>
      <button onClick={() => download('doc.pdf')}>Download</button>

      {/* PDF container */}
      <div ref={containerRef} style={{ height: '80vh', overflow: 'auto' }} />
    </>
  );
}
```

### React (All-in-One Component)

```tsx
import { useRef } from 'react';
import { PDFSearchViewer, PDFSearchViewerHandle } from 'pdf-search-highlight/react';
import 'pdf-search-highlight/styles.css';

function App() {
  const ref = useRef<PDFSearchViewerHandle>(null);

  return (
    <PDFSearchViewer
      ref={ref}
      pdfjsLib={pdfjsLib}
      source={file}
      searchQuery={query}
      // OR multi-context search:
      // searchContexts={[{ query: 'contract' }, { query: 'payment' }]}
      onLoad={({ pageCount }) => console.log('Pages:', pageCount)}
      onSearch={({ query, total }) => console.log('Found:', total)}
      onSearchMultiple={({ contexts, total }) => console.log('Multi:', total)}
      onMatchChange={({ current, total }) => console.log(`${current + 1}/${total}`)}
      onZoom={({ scale }) => console.log('Scale:', scale)}
      style={{ height: '80vh', overflow: 'auto' }}
    />
  );

  // Imperative access via ref
  // ref.current.nextMatch()
  // ref.current.searchMultiple([{ query: 'a' }, { query: 'b' }])
  // ref.current.zoomIn()
  // ref.current.download('doc.pdf')
}
```

## API

### Core (`pdf-search-highlight`)

| Export | Description |
|---|---|
| `PDFRenderer` | Renders PDF pages into a container (canvas + text layer) |
| `SearchController` | Headless search + highlight controller. `search()` for single query, `searchMultiple()` for multi-context |
| `PDFSearchViewer` | All-in-one: render + search + highlight + zoom + download. `search()` + `searchMultiple()` |
| `searchPage` | Low-level: search spans with flexible regex |
| `HighlightManager` | Low-level: apply/clear highlights on spans |
| `SearchContext` | Type: `{ query: string; options?: SearchOptions }` — used with `searchMultiple()` |

### React (`pdf-search-highlight/react`)

| Export | Description |
|---|---|
| `usePDFRenderer(pdfjsLib, options?)` | Hook: render PDF, returns `{ containerRef, pages, loadPDF, scale, setScale, zoomIn, zoomOut, download, ... }` |
| `useSearchController(pages, options?)` | Hook: search + highlight, returns `{ search, searchMultiple, next, prev, goTo, clear, current, total }` |
| `PDFSearchViewer` | All-in-one component. Props: `searchQuery` (single) or `searchContexts` (multi). Ref handle: `nextMatch`, `prevMatch`, `searchMultiple`, `clearSearch`, ... |
| `SearchContext` | Type re-exported from core |

### PDFRenderer

```js
const renderer = new PDFRenderer(container, options);
renderer.setPdfjsLib(pdfjsLib);

await renderer.loadDocument(source);       // Load PDF (File | ArrayBuffer | Uint8Array | string URL)
const pages = await renderer.renderAllPages(); // Render all pages

renderer.setScale(1.5);                    // Set zoom level (number or 'auto')
renderer.getScale();                       // Get configured scale
renderer.getEffectiveScale();              // Get actual numeric scale used

await renderer.download('file.pdf');       // Download loaded PDF
renderer.getPageCount();                   // Total page count
renderer.cleanup();                        // Release resources
```

### SearchController

```js
const search = new SearchController({
  classNames: { highlight: 'my-hl', activeHighlight: 'my-active' },
  autoScroll: true, // set false to disable scroll-to-match
});

search.setPages(pages);

// Toggle auto-scroll at runtime
search.autoScroll = false;

// Single search
search.search('query', { caseSensitive: false, flexibleWhitespace: true });
search.search('query', { fuzzy: true, fuzzyThreshold: 0.6 });

// Multi-context search
search.searchMultiple([
  { query: 'contract' },
  { query: 'payment' },
  { query: 'deadline', options: { fuzzy: true } },
]);

search.next();
search.prev();
search.goTo(5);
search.clear();
search.onChange = ({ current, total, query }) => {};

search.current   // current match index
search.total     // total matches
search.query     // last single query
search.contexts  // last multi-context queries
```

### PDFSearchViewer (Core)

```js
const viewer = new PDFSearchViewer(container, pdfjsLib, options);

await viewer.loadPDF(source);

// Single search
viewer.search('query', { caseSensitive: true });

// Multi-context search — each context highlighted with a different color
viewer.searchMultiple([
  { query: 'contract' },
  { query: 'payment' },
  { query: 'deadline', options: { fuzzy: true } },
]);

// Navigation — works for both single and multi-context
viewer.nextMatch();                        // Next match (all contexts, document order)
viewer.prevMatch();                        // Previous match
viewer.clearSearch();                      // Clear all highlights

await viewer.zoomIn();                     // Zoom in by 0.25
await viewer.zoomOut();                    // Zoom out by 0.25
await viewer.setScale(2.0);               // Set specific scale
viewer.getScale();                         // Get current scale

await viewer.download('file.pdf');         // Download PDF

viewer.on('load', (data) => {});           // { pageCount }
viewer.on('search', (data) => {});         // { query, total }
viewer.on('searchmultiple', (data) => {}); // { contexts, total, totalsPerContext }
viewer.on('matchchange', (data) => {});    // { current, total }
viewer.on('zoom', (data) => {});           // { scale }
viewer.on('error', (data) => {});          // { error, context }

viewer.destroy();
```

### Options

```ts
interface PDFSearchViewerOptions {
  scale?: number | 'auto';    // Default: 'auto' (fit container width)
  workerSrc?: string;         // Path to pdf.js worker
  pageGap?: number;           // Gap between pages in px (default: 20)
  autoScroll?: boolean;       // Auto-scroll to active match (default: true)
  classNames?: ClassNames;    // Custom CSS class names
}

interface SearchOptions {
  caseSensitive?: boolean;      // Default: false
  flexibleWhitespace?: boolean; // Default: true (ignored when fuzzy is true)
  fuzzy?: boolean;              // Default: false — enable approximate matching
  fuzzyThreshold?: number;      // Default: 0.6 — similarity 0.0–1.0
}

interface SearchContext {
  query: string;                // The search query
  options?: SearchOptions;      // Optional per-context overrides
}
```

### Multi-Context Search

Search for multiple terms simultaneously, each highlighted with a different color:

```js
// Each context gets an auto-assigned color (highlight-0 through highlight-7, cycles)
search.searchMultiple([
  { query: 'contract' },          // Yellow
  { query: 'payment' },           // Cyan
  { query: 'deadline' },          // Green
  { query: 'penalty' },           // Orange
]);

// Per-context options override shared options
search.searchMultiple(
  [
    { query: 'contract' },
    { query: 'payement', options: { fuzzy: true, fuzzyThreshold: 0.7 } },
  ],
  { caseSensitive: false } // shared options
);

// Navigate through ALL matches in document order
search.next();  // goes to next match regardless of which context
search.prev();  // goes to previous match
```

8 colors are provided by default (CSS classes `highlight-0` through `highlight-7`). Colors cycle for more than 8 contexts.

### Custom CSS

Override any class name:

```js
const renderer = new PDFRenderer(container, {
  classNames: {
    container: 'my-container',
    page: 'my-page',
    canvas: 'my-canvas',
    textLayer: 'my-text-layer',
    pageLabel: 'my-label',
    highlight: 'my-highlight',
    activeHighlight: 'my-active',
  }
});
```

Default styles:

```css
/* Single search */
.highlight {
  background: rgba(255, 230, 0, 0.45) !important;
}
.highlight.active {
  background: rgba(233, 69, 96, 0.55) !important;
}

/* Multi-context search (8 colors) */
.highlight-0 { /* Yellow  */ }
.highlight-1 { /* Cyan    */ }
.highlight-2 { /* Green   */ }
.highlight-3 { /* Orange  */ }
.highlight-4 { /* Purple  */ }
.highlight-5 { /* Pink    */ }
.highlight-6 { /* Blue    */ }
.highlight-7 { /* Lime    */ }
```

## How it works

1. **Render**: PDF.js renders each page as `<canvas>` + transparent `<span>` text layer overlay
2. **Search**: Concatenate all span texts into one string per page, build a `charMap` mapping each character back to its source span
3. **Flexible whitespace**: Query `"and expensive"` becomes regex `a\s*n\s*d\s*e\s*x\s*p\s*e\s*n\s*s\s*i\s*v\s*e` — matches regardless of whitespace differences in PDF text
4. **Fuzzy search**: Semi-global Levenshtein alignment finds substrings within edit distance ≤ `queryLength × (1 - threshold)` — handles typos, OCR errors, and garbled text extraction
5. **Highlight**: Regex/fuzzy matches on concatenated text → charMap maps back to spans → split span DOM into text nodes + `<mark>` elements
6. **Multi-context**: Each context runs independently, matches are sorted by document position, and each context's `<mark>` elements receive a distinct CSS class (`highlight-0`, `highlight-1`, ...)
7. **Navigate**: Prev/next with wrap-around, auto-scroll to active match — in multi-context mode, navigation cycles through all matches across all contexts
8. **Zoom**: Re-renders all pages at new scale, search highlights are automatically re-applied

## License

MIT
