'use client'

import { useEffect, useRef, useState } from 'react'

export const STALE_HIGHLIGHT_PREFERENCES = [
  'update-all',
  'update-once',
  'dont-update',
] as const

export type StaleHighlightPreference =
  (typeof STALE_HIGHLIGHT_PREFERENCES)[number]

const isStaleHighlightPreference = (
  value: string,
): value is StaleHighlightPreference =>
  (STALE_HIGHLIGHT_PREFERENCES as readonly string[]).includes(value)

// sessionStorage, not localStorage, on purpose: the spec wants this choice to
// last only for the current browser session and never carry into a future
// visit. sessionStorage clears itself when the tab or window closes.
const STORAGE_KEY = 'doc-reviewer:stale-highlight-pref'

const loadPreference = (): StaleHighlightPreference | null => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (raw && isStaleHighlightPreference(raw)) {
      return raw
    }
    return null
  } catch (error) {
    console.error('Failed to load the stale-highlight preference', error)
    return null
  }
}

const savePreference = (preference: StaleHighlightPreference | null): void => {
  if (typeof window === 'undefined') {
    return
  }
  try {
    if (preference === null) {
      window.sessionStorage.removeItem(STORAGE_KEY)
    } else {
      window.sessionStorage.setItem(STORAGE_KEY, preference)
    }
  } catch (error) {
    console.error('Failed to save the stale-highlight preference', error)
  }
}

export interface UseStaleHighlightPreferenceResult {
  preference: StaleHighlightPreference | null
  setPreference: (preference: StaleHighlightPreference | null) => void
  isLoaded: boolean
}

export const useStaleHighlightPreference =
  (): UseStaleHighlightPreferenceResult => {
    const [preference, setPreferenceState] =
      useState<StaleHighlightPreference | null>(null)
    const [isLoaded, setIsLoaded] = useState(false)
    const hasLoadedRef = useRef(false)

    useEffect(() => {
      if (hasLoadedRef.current) {
        return
      }
      hasLoadedRef.current = true
      setPreferenceState(loadPreference())
      setIsLoaded(true)
    }, [])

    const setPreference = (next: StaleHighlightPreference | null) => {
      setPreferenceState(next)
      savePreference(next)
    }

    return { preference, setPreference, isLoaded }
  }
