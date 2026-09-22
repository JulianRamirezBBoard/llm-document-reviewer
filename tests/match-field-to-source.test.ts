import { matchFieldToSource } from '@/lib/editor/matchFieldToSource'

const SOURCE = `Invoice
Vendor: Acme Corp
Total Due: $1,250.00
Bill To: Jane Doe`

describe('matchFieldToSource', () => {
  it('returns the passage range for a value that is in the source text', () => {
    const match = matchFieldToSource(SOURCE, 'Acme Corp')
    expect(match).not.toBeNull()
    expect(SOURCE.slice(match!.from, match!.to)).toBe('Acme Corp')
  })

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    const match = matchFieldToSource(SOURCE, '  acme corp  ')
    expect(match).not.toBeNull()
    expect(SOURCE.slice(match!.from, match!.to)).toBe('Acme Corp')
  })

  it('returns null when the value is not in the source text', () => {
    expect(matchFieldToSource(SOURCE, 'Globex Corporation')).toBeNull()
  })

  it('returns null for an empty value', () => {
    expect(matchFieldToSource(SOURCE, '   ')).toBeNull()
  })

  it('returns the first occurrence when a value appears more than once', () => {
    const text = 'Doe and Doe'
    const match = matchFieldToSource(text, 'Doe')
    expect(match).toEqual({ from: 0, to: 3 })
  })
})
