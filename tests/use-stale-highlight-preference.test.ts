import { act, renderHook, waitFor } from '@testing-library/react'
import { useStaleHighlightPreference } from '@/lib/storage/useStaleHighlightPreference'

const STORAGE_KEY = 'doc-reviewer:stale-highlight-pref'

describe('useStaleHighlightPreference', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('starts with no preference when nothing is stored', async () => {
    const { result } = renderHook(() => useStaleHighlightPreference())
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(result.current.preference).toBeNull()
  })

  it('loads a valid stored preference from sessionStorage', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, 'update-all')
    const { result } = renderHook(() => useStaleHighlightPreference())
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(result.current.preference).toBe('update-all')
  })

  it('ignores an unknown stored value', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, 'nonsense')
    const { result } = renderHook(() => useStaleHighlightPreference())
    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(result.current.preference).toBeNull()
  })

  it('writes a chosen preference to sessionStorage', async () => {
    const { result } = renderHook(() => useStaleHighlightPreference())
    await waitFor(() => expect(result.current.isLoaded).toBe(true))

    act(() => result.current.setPreference('dont-update'))

    expect(result.current.preference).toBe('dont-update')
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBe('dont-update')
  })

  it('a change made later is the value the next reader loads', async () => {
    const first = renderHook(() => useStaleHighlightPreference())
    await waitFor(() => expect(first.result.current.isLoaded).toBe(true))
    act(() => first.result.current.setPreference('update-once'))

    const second = renderHook(() => useStaleHighlightPreference())
    await waitFor(() => expect(second.result.current.isLoaded).toBe(true))
    expect(second.result.current.preference).toBe('update-once')
  })

  it('clearing the preference removes it from sessionStorage', async () => {
    window.sessionStorage.setItem(STORAGE_KEY, 'update-all')
    const { result } = renderHook(() => useStaleHighlightPreference())
    await waitFor(() => expect(result.current.isLoaded).toBe(true))

    act(() => result.current.setPreference(null))

    expect(result.current.preference).toBeNull()
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
