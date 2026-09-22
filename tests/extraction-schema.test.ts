import { extractionResultSchema } from '@/lib/extraction/schema'

describe('extractionResultSchema', () => {
  it('accepts a valid extraction result', () => {
    const result = extractionResultSchema.safeParse({
      documentType: 'invoice',
      fields: [{ label: 'Total', value: '$100.00' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a result with no fields', () => {
    const result = extractionResultSchema.safeParse({
      documentType: 'invoice',
      fields: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a result missing the document type', () => {
    const result = extractionResultSchema.safeParse({
      fields: [{ label: 'Total', value: '$100.00' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a field with no label', () => {
    const result = extractionResultSchema.safeParse({
      documentType: 'invoice',
      fields: [{ label: '', value: '$100.00' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects malformed, unrelated data', () => {
    const result = extractionResultSchema.safeParse('not an object')
    expect(result.success).toBe(false)
  })
})
