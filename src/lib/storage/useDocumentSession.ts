'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createEmptyDocumentSession,
  isDocumentSession,
  type DocumentSession,
} from '@/lib/document/types'

const STORAGE_KEY = 'doc-reviewer:v1'

const loadSession = (): DocumentSession => {
  if (typeof window === 'undefined') {
    return createEmptyDocumentSession()
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return createEmptyDocumentSession()
    }
    const parsed: unknown = JSON.parse(raw)
    if (!isDocumentSession(parsed)) {
      return createEmptyDocumentSession()
    }
    return parsed
  } catch (error) {
    console.error('Failed to load the saved document session', error)
    return createEmptyDocumentSession()
  }
}

// Returns whether the save succeeded, so the caller can tell the user their
// edits are not being kept instead of only logging it.
const saveSession = (session: DocumentSession): boolean => {
  if (typeof window === 'undefined') {
    return true
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    return true
  } catch (error) {
    console.error('Failed to save the document session', error)
    return false
  }
}

export interface UseDocumentSessionResult {
  session: DocumentSession
  setSession: (session: DocumentSession) => void
  resetSession: () => void
  isLoaded: boolean
  hasSaveError: boolean
}

export const useDocumentSession = (): UseDocumentSessionResult => {
  const [session, setSessionState] = useState<DocumentSession>(
    createEmptyDocumentSession,
  )
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasSaveError, setHasSaveError] = useState(false)
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    if (hasLoadedRef.current) {
      return
    }
    hasLoadedRef.current = true
    setSessionState(loadSession())
    setIsLoaded(true)
  }, [])

  // Saves as part of the update itself, rather than reactively in an effect
  // keyed on `session` - that would call setState from inside an effect body
  // on every save, which risks cascading renders.
  const setSession = (nextSession: DocumentSession) => {
    setSessionState(nextSession)
    setHasSaveError(!saveSession(nextSession))
  }

  return {
    session,
    setSession,
    resetSession: () => setSession(createEmptyDocumentSession()),
    isLoaded,
    hasSaveError,
  }
}
