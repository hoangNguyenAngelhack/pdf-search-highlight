# pdf-search-highlight

PDF viewer with text search and highlight. Render PDF, search text with flexible whitespace matching, and navigate between highlighted results.

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
- Case sensitive toggle
- Custom CSS class names
- Separate UI and PDF rendering — put search bar anywhere

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
```

### React

```tsx
import { usePDFRenderer, useSearchController } from 'pdf-search-highlight/react';
import 'pdf-search-highlight/styles.css';

function App() {
  const { containerRef, pages, loadPDF } = usePDFRenderer(pdfjsLib);
  const { search, next, prev, current, total } = useSearchController(pages);

  return (
    <>
      {/* Search UI — anywhere you want */}
      <input onChange={e => search(e.target.value)} />
      <span>{total > 0 ? `${current + 1}/${total}` : ''}</span>
      <button onClick={prev}>Prev</button>
      <button onClick={next}>Next</button>

      {/* PDF container — anywhere else */}
      <div ref={containerRef} style={{ height: '80vh', overflow: 'auto' }} />
    </>
  );
}
```

## API

### Core (`pdf-search-highlight`)

| Export | Description |
|---|---|
| `PDFRenderer` | Renders PDF pages into a container (canvas + text layer) |
| `SearchController` | Headless search + highlight controller |
| `PDFSearchViewer` | All-in-one (render + search + highlight) |
| `searchPage` | Low-level: search spans with flexible regex |
| `HighlightManager` | Low-level: apply/clear highlights on spans |

### React (`pdf-search-highlight/react`)

| Export | Description |
|---|---|
| `usePDFRenderer(pdfjsLib, options?)` | Hook: render PDF, returns `{ containerRef, pages, loadPDF }` |
| `useSearchController(pages, options?)` | Hook: search + highlight, returns `{ search, next, prev, current, total }` |
| `PDFSearchViewer` | All-in-one component |

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

## License

MIT
