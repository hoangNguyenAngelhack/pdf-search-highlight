# pdf-search-highlight

PDF viewer with text search and highlight. Render PDF, search text with flexible whitespace matching, and navigate between highlighted results. Zoom in/out and download PDF files.

Built on [pdf.js](https://mozilla.github.io/pdf.js/). Works with Vanilla JS and React.

## Install

```bash
npm install pdf-search-highlight pdfjs-dist
```

## Features

- Render PDF pages (canvas + text layer)
- Search with flexible whitespace matching — handles inconsistent PDF text splitting
- Cross-span highlight using `<mark>` elements
- Navigate between matches (next/prev, auto-scroll)
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
search.next();
search.prev();
search.clear();

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
});

await viewer.loadPDF(file);
viewer.search('query');
viewer.nextMatch();

// Zoom
await viewer.zoomIn();
await viewer.zoomOut();
await viewer.setScale(2.0);

// Download
await viewer.download('document.pdf');

// Events
viewer.on('load', ({ pageCount }) => console.log('Pages:', pageCount));
viewer.on('search', ({ query, total }) => console.log('Found:', total));
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
  const { search, next, prev, current, total } = useSearchController(pages);

  return (
    <>
      {/* Search UI — anywhere you want */}
      <input onChange={e => search(e.target.value)} />
      <span>{total > 0 ? `${current + 1}/${total}` : ''}</span>
      <button onClick={prev}>Prev</button>
      <button onClick={next}>Next</button>

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
      onLoad={({ pageCount }) => console.log('Pages:', pageCount)}
      onSearch={({ query, total }) => console.log('Found:', total)}
      onMatchChange={({ current, total }) => console.log(`${current + 1}/${total}`)}
      onZoom={({ scale }) => console.log('Scale:', scale)}
      style={{ height: '80vh', overflow: 'auto' }}
    />
  );

  // Imperative access via ref
  // ref.current.nextMatch()
  // ref.current.zoomIn()
  // ref.current.download('doc.pdf')
}
```

## API

### Core (`pdf-search-highlight`)

| Export | Description |
|---|---|
| `PDFRenderer` | Renders PDF pages into a container (canvas + text layer) |
| `SearchController` | Headless search + highlight controller |
| `PDFSearchViewer` | All-in-one: render + search + highlight + zoom + download |
| `searchPage` | Low-level: search spans with flexible regex |
| `HighlightManager` | Low-level: apply/clear highlights on spans |

### React (`pdf-search-highlight/react`)

| Export | Description |
|---|---|
| `usePDFRenderer(pdfjsLib, options?)` | Hook: render PDF, returns `{ containerRef, pages, loadPDF, scale, setScale, zoomIn, zoomOut, download, ... }` |
| `useSearchController(pages, options?)` | Hook: search + highlight, returns `{ search, next, prev, goTo, clear, current, total }` |
| `PDFSearchViewer` | All-in-one component with ref handle for imperative control |

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
  classNames: { highlight: 'my-hl', activeHighlight: 'my-active' }
});

search.setPages(pages);
search.search('query', { caseSensitive: false, flexibleWhitespace: true });
search.next();
search.prev();
search.goTo(5);
search.clear();
search.onChange = ({ current, total, query }) => {};

search.current  // current match index
search.total    // total matches
search.query    // last query
```

### PDFSearchViewer (Core)

```js
const viewer = new PDFSearchViewer(container, pdfjsLib, options);

await viewer.loadPDF(source);
viewer.search('query', { caseSensitive: true });
viewer.nextMatch();
viewer.prevMatch();
viewer.clearSearch();

await viewer.zoomIn();                     // Zoom in by 0.25
await viewer.zoomOut();                    // Zoom out by 0.25
await viewer.setScale(2.0);               // Set specific scale
viewer.getScale();                         // Get current scale

await viewer.download('file.pdf');         // Download PDF

viewer.on('load', (data) => {});           // { pageCount }
viewer.on('search', (data) => {});         // { query, total }
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
  classNames?: ClassNames;    // Custom CSS class names
}

interface SearchOptions {
  caseSensitive?: boolean;      // Default: false
  flexibleWhitespace?: boolean; // Default: true
}
```

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
.highlight {
  background: rgba(255, 230, 0, 0.45) !important;
}
.highlight.active {
  background: rgba(233, 69, 96, 0.55) !important;
}
```

## How it works

1. **Render**: PDF.js renders each page as `<canvas>` + transparent `<span>` text layer overlay
2. **Search**: Concatenate all span texts into one string per page, build a `charMap` mapping each character back to its source span
3. **Flexible whitespace**: Query `"and expensive"` becomes regex `a\s*n\s*d\s*e\s*x\s*p\s*e\s*n\s*s\s*i\s*v\s*e` — matches regardless of whitespace differences in PDF text
4. **Highlight**: Regex matches on concatenated text → charMap maps back to spans → split span DOM into text nodes + `<mark>` elements
5. **Navigate**: Prev/next with wrap-around, auto-scroll to active match
6. **Zoom**: Re-renders all pages at new scale, search highlights are automatically re-applied

## License

MIT
