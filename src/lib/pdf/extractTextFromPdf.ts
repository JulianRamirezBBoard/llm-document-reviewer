import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

export class PdfTextExtractionError extends Error {}

// A byte-size cap alone does not bound processing cost: a small PDF can
// still have far more pages than is reasonable for one request.
const MAX_PDF_PAGES = 200

const hasStringItem = (item: unknown): item is { str: string } =>
  typeof item === 'object' &&
  item !== null &&
  'str' in item &&
  typeof item.str === 'string'

export const extractTextFromPdf = async (
  bytes: Uint8Array,
): Promise<string> => {
  const pageTexts: string[] = []
  try {
    // pdf.js can move the buffer into its worker and empty it. Pass a copy so
    // the caller keeps ownership of the original bytes.
    const loadingTask = getDocument({ data: bytes.slice() })
    const pdfDocument = await loadingTask.promise
    try {
      if (pdfDocument.numPages > MAX_PDF_PAGES) {
        throw new PdfTextExtractionError(
          `This PDF has too many pages. The limit is ${MAX_PDF_PAGES}.`,
        )
      }
      for (
        let pageNumber = 1;
        pageNumber <= pdfDocument.numPages;
        pageNumber += 1
      ) {
        const page = await pdfDocument.getPage(pageNumber)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item) => (hasStringItem(item) ? item.str : ''))
          .join(' ')
        pageTexts.push(pageText)
      }
    } finally {
      await loadingTask.destroy()
    }
  } catch (error) {
    if (error instanceof PdfTextExtractionError) {
      throw error
    }
    throw new PdfTextExtractionError('Could not open this file as a PDF.', {
      cause: error,
    })
  }

  const fullText = pageTexts.join('\n\n').trim()
  if (fullText.length === 0) {
    throw new PdfTextExtractionError(
      'This PDF has no readable text. It may be a scanned image with no text layer.',
    )
  }
  return fullText
}
