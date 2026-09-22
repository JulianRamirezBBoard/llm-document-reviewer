import { act, renderHook, waitFor } from '@testing-library/react'
import { useDocumentSession } from '@/lib/storage/useDocumentSession'
import type { DocumentSession } from '@/lib/document/types'

const sampleSession: DocumentSession = {
  documentText: 'Invoice #123',
  highlightBaseText: 'Invoice #123',
  documentType: 'invoice',
  fields: [{ id: 'field-1', label: 'Total', value: '$100.00', source: 'ai' }],
}

describe('useDocumentSession', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('starts empty and marks itself loaded', async () => {
    const { result } = renderHook(() => useDocumentSession())
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(result.current.session.fields).toHaveLength(0)
  })

  it('saves a session and reloads the same data after a simulated refresh', async () => {
    const { result, unmount } = renderHook(() => useDocumentSession())
    await waitFor(() => expect(result.current.isLoaded).toBe(true))

    act(() => {
      result.current.setSession(sampleSession)
    })

    await waitFor(() => {
      expect(window.localStorage.getItem('doc-reviewer:v1')).not.toBeNull()
    })

    unmount()

    const { result: resultAfterRefresh } = renderHook(() =>
      useDocumentSession(),
    )
    await waitFor(() => expect(resultAfterRefresh.current.isLoaded).toBe(true))
    expect(resultAfterRefresh.current.session).toEqual(sampleSession)
  })

  it('falls back to an empty session when local storage holds corrupted data', async () => {
    window.localStorage.setItem('doc-reviewer:v1', 'not valid json')
    const { result } = renderHook(() => useDocumentSession())
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(result.current.session.fields).toHaveLength(0)
  })

  it('resetSession clears the current session', async () => {
    const { result } = renderHook(() => useDocumentSession())
    await waitFor(() => expect(result.current.isLoaded).toBe(true))

    act(() => {
      result.current.setSession(sampleSession)
    })
    await waitFor(() => expect(result.current.session.fields).toHaveLength(1))

    act(() => {
      result.current.resetSession()
    })
    expect(result.current.session.fields).toHaveLength(0)
  })
})
