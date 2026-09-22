import { NextResponse } from 'next/server'
import { extractFieldsRequestSchema } from '@/lib/api/contracts'
import { MAX_DOCUMENT_TEXT_LENGTH } from '@/lib/extraction/schema'
import {
  extractStructuredFields,
  GuardrailBlockedError,
  MissingApiKeyError,
} from '@/lib/extraction/provider'
import {
  checkRateLimit,
  getClientIp,
  hashClientId,
  isAbusiveCaller,
  noteAbuse,
} from '@/lib/security/rateLimit'
import { isTrustedOrigin } from '@/lib/security/originCheck'
import type { z } from 'zod'

export const runtime = 'nodejs'

// This route calls a paid LLM twice (a safety check, then the extraction
// itself), so it gets the tightest limit of the two API routes.
const RATE_LIMIT_MAX_REQUESTS = 10
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000

const describeRequestError = (error: z.ZodError): string => {
  const isTooLong = error.issues.some((issue) => issue.code === 'too_big')
  if (isTooLong) {
    return `Document text must be ${MAX_DOCUMENT_TEXT_LENGTH.toLocaleString()} characters or fewer.`
  }
  return 'Provide non-empty document text.'
}

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ error: 'Request not allowed.' }, { status: 403 })
  }

  const clientId = hashClientId(getClientIp(request))

  if (await isAbusiveCaller(clientId)) {
    return NextResponse.json(
      { error: 'Too many requests. Wait a moment before trying again.' },
      { status: 429, headers: { 'Retry-After': '3600' } },
    )
  }

  const rateLimitResult = await checkRateLimit(`extract-fields:${clientId}`, {
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'The request body must be valid JSON.' },
      { status: 400 },
    )
  }

  const parsedRequest = extractFieldsRequestSchema.safeParse(body)
  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: describeRequestError(parsedRequest.error) },
      { status: 400 },
    )
  }

  try {
    const result = await extractStructuredFields(
      parsedRequest.data.documentText,
    )
    return NextResponse.json(result)
  } catch (error) {
    console.error('extract-fields failed', error)
    if (error instanceof MissingApiKeyError) {
      // The specific env var name is already in the server-side log above;
      // an unauthenticated caller does not need to know it.
      return NextResponse.json(
        { error: 'The service is temporarily unavailable. Try again later.' },
        { status: 500 },
      )
    }
    if (error instanceof GuardrailBlockedError) {
      // A blocked request is a strike against this caller.
      await noteAbuse(clientId)
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    return NextResponse.json(
      {
        error:
          'The AI could not extract structured fields from this document. Try again.',
      },
      { status: 502 },
    )
  }
}
