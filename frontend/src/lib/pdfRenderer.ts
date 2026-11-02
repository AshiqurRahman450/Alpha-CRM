/**
 * High-performance PDF Page Renderer using PDF.js
 * Renders uploaded PDF pages to high-resolution images and detects text coordinates for live editing overlays
 */

export interface DetectedTextMatch {
  page: number; // 1-indexed
  key: 'clientName' | 'projectCity' | 'model' | 'offerNo' | 'price' | 'dearSalutation';
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  originalText: string;
}

export interface RenderedPdfResult {
  numPages: number;
  pageImages: string[];
  matches: DetectedTextMatch[];
}

export async function renderUploadedPdfPages(file: File): Promise<RenderedPdfResult> {
  const arrayBuffer = await file.arrayBuffer();

  // Load PDF.js dynamically if not already on window
  let pdfjs: any = (window as any).pdfjsLib;

  if (!pdfjs) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        const loaded = (window as any).pdfjsLib;
        if (loaded) {
          loaded.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          pdfjs = loaded;
          resolve();
        } else {
          reject(new Error('PDF.js failed to load'));
        }
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  const pageImages: string[] = [];
  const matches: DetectedTextMatch[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    // 2x scale for crystal-clear retina rendering
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) continue;

    await page.render({
      canvasContext: ctx,
      viewport: viewport,
    }).promise;

    pageImages.push(canvas.toDataURL('image/png'));

    // Detect text items for name & field overlay positioning
    try {
      const textContent = await page.getTextContent();
      const items = textContent.items as any[];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const str = item.str || '';

        // Detect CLIENT NAME
        if (/CLIENT\s*NAME/i.test(str)) {
          const pt = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
          matches.push({
            page: pageNum,
            key: 'clientName',
            xPercent: Math.max(0, (pt[0] / viewport.width) * 100),
            yPercent: Math.max(0, ((pt[1] - 25) / viewport.height) * 100),
            widthPercent: 50,
            heightPercent: 4,
            originalText: str,
          });
        }
        // Detect Project City
        else if (/Project\s*City/i.test(str)) {
          const pt = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
          matches.push({
            page: pageNum,
            key: 'projectCity',
            xPercent: Math.max(0, (pt[0] / viewport.width) * 100),
            yPercent: Math.max(0, ((pt[1] - 20) / viewport.height) * 100),
            widthPercent: 45,
            heightPercent: 3.5,
            originalText: str,
          });
        }
        // Detect MODEL :
        else if (/MODEL\s*:/i.test(str)) {
          const pt = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
          matches.push({
            page: pageNum,
            key: 'model',
            xPercent: Math.max(0, (pt[0] / viewport.width) * 100),
            yPercent: Math.max(0, ((pt[1] - 20) / viewport.height) * 100),
            widthPercent: 45,
            heightPercent: 3.5,
            originalText: str,
          });
        }
        // Detect Offer No:
        else if (/(?:Offer\s*No|OFFER\s*NO)/i.test(str)) {
          const pt = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
          matches.push({
            page: pageNum,
            key: 'offerNo',
            xPercent: Math.max(0, (pt[0] / viewport.width) * 100),
            yPercent: Math.max(0, ((pt[1] - 20) / viewport.height) * 100),
            widthPercent: 45,
            heightPercent: 3.5,
            originalText: str,
          });
        }
        // Detect Dear [Name] on Page 2
        else if (/^Dear\s+/i.test(str) && pageNum === 2) {
          const pt = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
          matches.push({
            page: pageNum,
            key: 'dearSalutation',
            xPercent: Math.max(0, (pt[0] / viewport.width) * 100),
            yPercent: Math.max(0, ((pt[1] - 20) / viewport.height) * 100),
            widthPercent: 40,
            heightPercent: 3.5,
            originalText: str,
          });
        }
      }
    } catch (e) {
      // Ignore text detection error
    }
  }

  return {
    numPages,
    pageImages,
    matches,
  };
}
