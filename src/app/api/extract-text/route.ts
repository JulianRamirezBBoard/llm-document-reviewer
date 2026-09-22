import { NextResponse } from 'next/server'
import {
  extractTextFromPdf,
  PdfTextExtractionError,
} from '@/lib/pdf/extractTextFromPdf'
import {
  checkRateLimit,
  getClientIp,
  hashClientId,
} from '@/lib/security/rateLimit'
import { isTrustedOrigin } from '@/lib/security/originCheck'

export const runtime = 'nodejs'

const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024
const RATE_LIMIT_MAX_REQUESTS = 20
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: 'Request not allowed.' }, { status: 403 })
  }

  const clientId = hashClientId(getClientIp(request))
  const rateLimitResult = await checkRateLimit(`extract-text:${clientId}`, {
    maxRequests: RATE_LIMIT_MAX_REQUESTS,
    windowMs: RATE_LIMIT_WINDOW_MS,
  })
  if (!rateLimitResult.isAllowed) {
    return NextResponse.json(
      { error: 'Too many requests. Wait a moment before trying again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimitResult.retryAfterSeconds) },
      },
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: 'The request must be multipart form data.' },
      { status: 400 },
    )
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'Attach a PDF file under the "file" field.' },
      { status: 400 },
    )
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json(
      { error: 'Only PDF files are supported here.' },
      { status: 400 },
    )
  }
  if (file.size > MAX_PDF_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'This PDF is too large. Choose a file under 20 MB.' },
      { status: 400 },
    )
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const text = await extractTextFromPdf(bytes)
    return NextResponse.json({ text })
  } catch (error) {
    console.error('extract-text failed', error)
    if (error instanceof PdfTextExtractionError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    return NextResponse.json(
      { error: 'Could not read this PDF.' },
      { status: 500 },
    )
  }
}
