import type { PDFSearchViewerOptions, ClassNames, PageData, SpanData } from '../types';
import { DEFAULT_CLASS_NAMES, DEFAULT_SCALE, DEFAULT_PAGE_GAP } from './constants';

// pdfjs-dist types
type PDFDocumentProxy = any;
type PDFPageProxy = any;

/**
 * Renders PDF pages into a container using canvas + text layer.
 *
 * Text layer approach (matching demo):
 * - Extract text content from each page
 * - Create absolutely-positioned <span> elements overlaying the canvas
 * - Position spans using the transform matrix from pdf.js
 * - Spans are transparent (for text selection) but allow DOM-based search/highlight
 */
export class PDFRenderer {
  private container: HTMLElement;
  private scale: number | 'auto';
  private pageGap: number;
  private cls: Required<ClassNames>;
  private workerSrc?: string;
  private pdfDoc: PDFDocumentProxy | null = null;
  private pageData: PageData[] = [];
  private pdfjsLib: any = null;
  private effectiveScale: number = 1;

  constructor(container: HTMLElement, options: PDFSearchViewerOptions) {
    this.container = container;
    this.scale = options.scale ?? DEFAULT_SCALE;
    this.pageGap = options.pageGap ?? DEFAULT_PAGE_GAP;
    this.workerSrc = options.workerSrc;
    this.cls = { ...DEFAULT_CLASS_NAMES, ...options.classNames };
  }

  /**
   * Set the pdfjs-dist library reference.
   * Must be called before loadDocument.
   */
  setPdfjsLib(lib: any): void {
    this.pdfjsLib = lib;
    if (this.workerSrc) {
      lib.GlobalWorkerOptions.workerSrc = this.workerSrc;
    }
  }

  /**
   * Load a PDF from File, ArrayBuffer, URL string, or Uint8Array.
   */
  async loadDocument(
    source: File | ArrayBuffer | Uint8Array | string
  ): Promise<number> {
    if (!this.pdfjsLib) {
      throw new Error(
        'pdfjs-dist not set. Call setPdfjsLib(pdfjsLib) before loading a document.'
      );
    }

    this.cleanup();

    let data: ArrayBuffer | Uint8Array | { url: string };
    if (source instanceof File) {
      data = await source.arrayBuffer();
    } else if (typeof source === 'string') {
      data = { url: source };
    } else {
      data = source;
    }

    const loadingTask = this.pdfjsLib.getDocument({ data });
    this.pdfDoc = await loadingTask.promise;
    return this.pdfDoc.numPages;
  }

  /**
   * Render all pages into the container.
   * Returns PageData[] for search/highlight.
   */
  async renderAllPages(): Promise<PageData[]> {
    if (!this.pdfDoc) throw new Error('No PDF document loaded');

    this.container.innerHTML = '';
    this.container.classList.add(this.cls.container);
    this.pageData = [];

    const numPages = this.pdfDoc.numPages;

    for (let i = 1; i <= numPages; i++) {
      const page = await this.pdfDoc.getPage(i);
      const pd = await this.renderPage(page, i, numPages);
      this.pageData.push(pd);
    }

    return this.pageData;
  }

  private async renderPage(
    page: PDFPageProxy,
    pageNum: number,
    totalPages: number
  ): Promise<PageData> {
    const scale = this.calculateScale(page);
    if (pageNum === 1) this.effectiveScale = scale;
    const vp = page.getViewport({ scale });

    // Page container
    const container = document.createElement('div');
    container.className = this.cls.page;
    container.style.position = 'relative';
    container.style.width = vp.width + 'px';
    container.style.height = vp.height + 'px';
    container.style.margin = '0 auto';
    container.style.marginBottom = this.pageGap + 'px';
    container.style.overflow = 'hidden';
    container.dataset.page = String(pageNum);

    // Canvas (2x for retina)
    const canvas = document.createElement('canvas');
    canvas.className = this.cls.canvas;
    canvas.width = vp.width * 2;
    canvas.height = vp.height * 2;
    canvas.style.width = vp.width + 'px';
    canvas.style.height = vp.height + 'px';
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d')!;
    ctx.scale(2, 2);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;

    // Text layer
    const textLayer = document.createElement('div');
    textLayer.className = this.cls.textLayer;
    textLayer.style.position = 'absolute';
    textLayer.style.top = '0';
    textLayer.style.left = '0';
    textLayer.style.right = '0';
    textLayer.style.bottom = '0';
    textLayer.style.overflow = 'hidden';
    textLayer.style.lineHeight = '1';

    const tc = await page.getTextContent();
    const spans: SpanData[] = [];

    for (const item of tc.items) {
      if (!item.str && !item.hasEOL) continue;

      const tx = this.pdfjsLib.Util.transform(vp.transform, item.transform);
      const span = document.createElement('span');
      span.textContent = item.str || '';
      const fh = Math.hypot(tx[2], tx[3]);
      span.style.position = 'absolute';
      span.style.left = tx[4] + 'px';
      span.style.top = (tx[5] - fh) + 'px';
      span.style.fontSize = fh + 'px';
      span.style.color = 'transparent';
      span.style.whiteSpace = 'pre';
      span.style.cursor = 'text';
      span.style.transformOrigin = '0% 0%';
      if (item.fontName) span.style.fontFamily = item.fontName;

      const sw = tx[0] / fh;
      if (Math.abs(sw - 1) > 0.01) {
        span.style.transform = `scaleX(${sw})`;
      }

      textLayer.appendChild(span);
      spans.push({
        el: span,
        text: item.str || '',
        hasEOL: !!item.hasEOL,
      });
    }

    container.appendChild(canvas);
    container.appendChild(textLayer);
    this.container.appendChild(container);

    // Page label
    const label = document.createElement('div');
    label.className = this.cls.pageLabel;
    label.textContent = `Page ${pageNum} / ${totalPages}`;
    this.container.appendChild(label);

    return { container, spans };
  }

  private calculateScale(page: PDFPageProxy): number {
    if (this.scale !== 'auto' && typeof this.scale === 'number') {
      return this.scale;
    }
    const defaultVp = page.getViewport({ scale: 1 });
    const containerWidth = this.container.clientWidth || 800;
    return Math.min(containerWidth / defaultVp.width, 2);
  }

  /** Set the scale for subsequent renders. */
  setScale(scale: number | 'auto'): void {
    this.scale = scale;
  }

  /** Get the configured scale setting. */
  getScale(): number | 'auto' {
    return this.scale;
  }

  /** Get the actual numeric scale used in the last render. */
  getEffectiveScale(): number {
    return this.effectiveScale;
  }

  /**
   * Download the currently loaded PDF.
   */
  async download(filename: string = 'document.pdf'): Promise<void> {
    if (!this.pdfDoc) throw new Error('No PDF document loaded');

    const data = await this.pdfDoc.getData();
    const blob = new Blob([data as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  getClassNames(): Required<ClassNames> {
    return this.cls;
  }

  getPageData(): PageData[] {
    return this.pageData;
  }

  getPageCount(): number {
    return this.pdfDoc?.numPages ?? 0;
  }

  cleanup(): void {
    this.pdfDoc?.destroy();
    this.pdfDoc = null;
    this.pageData = [];
    this.container.innerHTML = '';
  }
}
