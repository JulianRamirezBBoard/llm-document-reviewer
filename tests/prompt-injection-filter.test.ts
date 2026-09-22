import {
  looksLikeInjection,
  looksLikeInjectedResult,
} from '@/lib/extraction/promptInjectionFilter'
import {
  JAILBREAK_PROMPTS,
  ORDINARY_DOCUMENTS,
} from './fixtures/jailbreak-prompts'

describe('looksLikeInjection (layer 1)', () => {
  it('catches every corpus entry marked "obvious"', () => {
    const missed = JAILBREAK_PROMPTS.filter(
      (prompt) => prompt.obvious && !looksLikeInjection(prompt.text),
    ).map((prompt) => `${prompt.category}: ${prompt.text}`)

    expect(missed).toEqual([])
  })

  it('does not fire on ordinary documents with instruction-like wording', () => {
    const tripped = ORDINARY_DOCUMENTS.filter((doc) => looksLikeInjection(doc))

    expect(tripped).toEqual([])
  })

  it('leaves at least one subtle entry for the model guardrail', () => {
    expect(JAILBREAK_PROMPTS.some((prompt) => !prompt.obvious)).toBe(true)
  })
})

describe('looksLikeInjectedResult (layer 3)', () => {
  const systemPrompt =
    'You extract structured data from documents such as invoices, resumes, contracts, and policies.'

  const fieldsOf = (...values: string[]) => ({
    fields: values.map((value) => ({ value })),
  })

  it('passes an ordinary extraction result', () => {
    const result = fieldsOf('Northwind Trading Co.', 'NW-2048', '$3,456.00')

    expect(looksLikeInjectedResult(result, systemPrompt)).toBe(false)
  })

  it('flags a field value that starts with a refusal', () => {
    const result = fieldsOf('Acme Corp', 'I cannot help with that request.')

    expect(looksLikeInjectedResult(result, systemPrompt)).toBe(true)
  })

  it('flags a field value that quotes the system prompt', () => {
    const result = fieldsOf(
      'You extract structured data from documents such as invoices, resumes',
    )

    expect(looksLikeInjectedResult(result, systemPrompt)).toBe(true)
  })

  it('flags a field value that quotes the document fence', () => {
    const result = fieldsOf('<document_text> pasted here </document_text>')

    expect(looksLikeInjectedResult(result, systemPrompt)).toBe(true)
  })

  it('flags a field value that is a paragraph of prose', () => {
    const prose =
      'The document appears to describe a transaction. It lists several parties. ' +
      'It also mentions dates and amounts. There is a signature block near the end. ' +
      'Overall it reads like a standard commercial contract between two companies.'
    const result = fieldsOf(prose)

    expect(looksLikeInjectedResult(result, systemPrompt)).toBe(true)
  })
})
