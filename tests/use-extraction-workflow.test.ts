import { act, renderHook, waitFor } from '@testing-library/react'
import { useExtractionWorkflow } from '@/lib/extraction/useExtractionWorkflow'

const extractionResponse = {
  documentType: 'invoice',
  fields: [
    { label: 'Vendor', value: 'Acme Corp' },
    { label: 'Total', value: '$1,250.00' },
  ],
}

const mockFetchOnce = () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => extractionResponse,
  }) as unknown as typeof fetch
}

const loadWithFields = async () => {
  const hook = renderHook(() => useExtractionWorkflow())
  await waitFor(() => expect(hook.result.current.isLoaded).toBe(true))
  act(() =>
    hook.result.current.submitText('Vendor: Acme Corp\nTotal: $1,250.00'),
  )
  await waitFor(() =>
    expect(hook.result.current.session.fields).toHaveLength(2),
  )
  return hook
}

describe('useExtractionWorkflow', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mockFetchOnce()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('sets the highlight base to the extracted text and starts un-stale', async () => {
    const { result } = await loadWithFields()
    expect(result.current.session.highlightBaseText).toBe(
      result.current.session.documentText,
    )
    expect(result.current.isHighlightStale).toBe(false)
    expect(
      result.current.session.fields.every((field) => field.source === 'ai'),
    ).toBe(true)
  })

  it('confirmAllFields marks every field human, and undo restores them', async () => {
    const { result } = await loadWithFields()

    act(() => result.current.confirmAllFields())
    expect(
      result.current.session.fields.every((field) => field.source === 'human'),
    ).toBe(true)
    expect(result.current.canUndoConfirmAll).toBe(true)

    act(() => result.current.undoConfirmAll())
    expect(
      result.current.session.fields.every((field) => field.source === 'ai'),
    ).toBe(true)
    expect(result.current.canUndoConfirmAll).toBe(false)
  })

  it('dismissConfirmAllUndo ends the undo window without restoring', async () => {
    const { result } = await loadWithFields()

    act(() => result.current.confirmAllFields())
    act(() => result.current.dismissConfirmAllUndo())

    expect(result.current.canUndoConfirmAll).toBe(false)
    expect(
      result.current.session.fields.every((field) => field.source === 'human'),
    ).toBe(true)
  })

  it('editing a field changes its value but does not confirm it', async () => {
    const { result } = await loadWithFields()
    const targetId = result.current.session.fields[0].id

    act(() => result.current.updateField(targetId, 'Globex'))

    const field = result.current.session.fields.find((f) => f.id === targetId)
    expect(field?.value).toBe('Globex')
    expect(field?.source).toBe('ai')
  })

  it('confirmField confirms one field and leaves the rest as drafts', async () => {
    const { result } = await loadWithFields()
    const [first, second] = result.current.session.fields

    act(() => result.current.confirmField(first.id))

    expect(
      result.current.session.fields.find((f) => f.id === first.id)?.source,
    ).toBe('human')
    expect(
      result.current.session.fields.find((f) => f.id === second.id)?.source,
    ).toBe('ai')
  })

  it('editing a confirmed field returns it to draft', async () => {
    const { result } = await loadWithFields()
    const targetId = result.current.session.fields[0].id

    act(() => result.current.confirmField(targetId))
    act(() => result.current.updateField(targetId, 'New value'))

    expect(
      result.current.session.fields.find((f) => f.id === targetId)?.source,
    ).toBe('ai')
  })

  it('confirmAllFields confirms only the draft fields, and undo restores the mix', async () => {
    const { result } = await loadWithFields()
    const firstId = result.current.session.fields[0].id

    act(() => result.current.confirmField(firstId))
    act(() => result.current.confirmAllFields())
    expect(
      result.current.session.fields.every((field) => field.source === 'human'),
    ).toBe(true)
    expect(result.current.canUndoConfirmAll).toBe(true)

    act(() => result.current.undoConfirmAll())
    expect(
      result.current.session.fields.find((f) => f.id === firstId)?.source,
    ).toBe('human')
    expect(
      result.current.session.fields.filter((f) => f.source === 'ai'),
    ).toHaveLength(1)
  })

  it('editing the source text goes stale, and syncing clears it', async () => {
    const { result } = await loadWithFields()

    act(() =>
      result.current.updateDocumentText('Vendor: Globex\nTotal: $9', false),
    )
    expect(result.current.isHighlightStale).toBe(true)

    act(() => result.current.syncHighlightBase())
    expect(result.current.isHighlightStale).toBe(false)
    expect(result.current.session.highlightBaseText).toBe(
      'Vendor: Globex\nTotal: $9',
    )
  })
})
