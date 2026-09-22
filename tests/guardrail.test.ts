import {
  assessDocumentSafety,
  GuardrailCheckError,
} from '@/lib/extraction/guardrail'
import { generateStructuredOutput } from '@/lib/extraction/generateStructuredOutput'
import { looksLikeInjection } from '@/lib/extraction/promptInjectionFilter'
import {
  JAILBREAK_PROMPTS,
  ORDINARY_DOCUMENTS,
} from './fixtures/jailbreak-prompts'

jest.mock('@/lib/extraction/generateStructuredOutput', () => ({
  generateStructuredOutput: jest.fn(),
  MissingApiKeyError: class extends Error {},
}))

const mockedGenerate = jest.mocked(generateStructuredOutput)

describe('assessDocumentSafety (layer 2 plumbing)', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('fences the document text before the model sees it', async () => {
    mockedGenerate.mockResolvedValue({ isSafeDocument: true, reason: 'ok' })

    await assessDocumentSafety('Invoice total: $100')

    const call = mockedGenerate.mock.calls[0][0] as { prompt: string }
    expect(call.prompt).toContain('<document_text>')
    expect(call.prompt).toContain('Invoice total: $100')
  })

  it('returns the model verdict unchanged', async () => {
    mockedGenerate.mockResolvedValue({
      isSafeDocument: false,
      reason: 'looks like an override attempt',
    })

    await expect(assessDocumentSafety('whatever')).resolves.toEqual({
      isSafeDocument: false,
      reason: 'looks like an override attempt',
    })
  })

  it('maps a model failure to GuardrailCheckError (fail closed)', async () => {
    mockedGenerate.mockRejectedValue(new Error('model unavailable'))

    await expect(assessDocumentSafety('whatever')).rejects.toBeInstanceOf(
      GuardrailCheckError,
    )
  })
})

describe('jailbreak corpus fixture', () => {
  it('has a non-empty text and category for every entry', () => {
    for (const prompt of JAILBREAK_PROMPTS) {
      expect(prompt.text.trim().length).toBeGreaterThan(0)
      expect(prompt.category.trim().length).toBeGreaterThan(0)
    }
  })

  it('has at least one ordinary document to check for over-blocking', () => {
    expect(ORDINARY_DOCUMENTS.length).toBeGreaterThan(0)
  })
})

// Opt-in: hits the real model for every corpus entry. Costs money and needs a
// provider key, so it never runs in the default suite or the pre-commit hook.
const runLive = process.env.RUN_LIVE_GUARDRAIL_TESTS === '1'

;(runLive ? describe : describe.skip)('live guardrail vs. the corpus', () => {
  jest.unmock('@/lib/extraction/generateStructuredOutput')

  it('blocks every jailbreak prompt (layer 1 or layer 2)', async () => {
    for (const prompt of JAILBREAK_PROMPTS) {
      if (looksLikeInjection(prompt.text)) {
        continue
      }
      const verdict = await assessDocumentSafety(prompt.text)
      expect(verdict.isSafeDocument).toBe(false)
    }
  }, 120_000)

  it('passes every ordinary document', async () => {
    for (const doc of ORDINARY_DOCUMENTS) {
      expect(looksLikeInjection(doc)).toBe(false)
      const verdict = await assessDocumentSafety(doc)
      expect(verdict.isSafeDocument).toBe(true)
    }
  }, 120_000)
})
