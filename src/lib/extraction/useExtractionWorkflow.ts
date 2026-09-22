'use client'

import { useState } from 'react'
import {
  useDocumentSession,
  type UseDocumentSessionResult,
} from '@/lib/storage/useDocumentSession'
import type { DocumentField, DocumentSession } from '@/lib/document/types'
import {
  errorResponseSchema,
  extractFieldsResponseSchema,
  extractTextResponseSchema,
} from '@/lib/api/contracts'

export type ExtractionStatus = 'idle' | 'busy' | 'error'

type LastAction = { type: 'text'; text: string } | { type: 'pdf'; file: File }

export interface UseExtractionWorkflowResult {
  session: DocumentSession
  isLoaded: boolean
  status: ExtractionStatus
  errorMessage: string | null
  canRetry: boolean
  hasSaveError: boolean
  isHighlightStale: boolean
  canUndoConfirmAll: boolean
  submitText: (text: string) => void
  submitPdf: (file: File) => void
  updateField: (id: string, value: string) => void
  confirmField: (id: string) => void
  updateDocumentText: (text: string, keepHighlightsInSync: boolean) => void
  syncHighlightBase: () => void
  confirmAllFields: () => void
  undoConfirmAll: () => void
  dismissConfirmAllUndo: () => void
  startOver: () => void
  retry: () => void
}

const readErrorMessage = (data: unknown, fallback: string): string => {
  const parsed = errorResponseSchema.safeParse(data)
  return parsed.success ? parsed.data.error : fallback
}

const parseJsonSafely = async (response: Response): Promise<unknown> => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export const useExtractionWorkflow = (): UseExtractionWorkflowResult => {
  const {
    session,
    setSession,
    resetSession,
    isLoaded,
    hasSaveError,
  }: UseDocumentSessionResult = useDocumentSession()
  const [status, setStatus] = useState<ExtractionStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<LastAction | null>(null)
  // Kept only for the short "Undo" window right after a bulk confirm.
  const [fieldsBeforeConfirmAll, setFieldsBeforeConfirmAll] = useState<
    DocumentField[] | null
  >(null)

  const runExtraction = async (documentText: string) => {
    setStatus('busy')
    setErrorMessage(null)
    setLastAction({ type: 'text', text: documentText })
    try {
      const response = await fetch('/api/extract-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentText }),
      })
      const data = await parseJsonSafely(response)
      if (!response.ok) {
        setStatus('error')
        setErrorMessage(readErrorMessage(data, 'Extraction failed. Try again.'))
        return
      }
      const parsed = extractFieldsResponseSchema.safeParse(data)
      if (!parsed.success) {
        setStatus('error')
        setErrorMessage('The extraction result was not in the expected shape.')
        return
      }
      const fields: DocumentField[] = parsed.data.fields.map(
        (field, index) => ({
          id: `field-${Date.now()}-${index}`,
          label: field.label,
          value: field.value,
          source: 'ai',
        }),
      )
      setFieldsBeforeConfirmAll(null)
      setSession({
        documentText,
        highlightBaseText: documentText,
        documentType: parsed.data.documentType,
        fields,
      })
      setStatus('idle')
    } catch (error) {
      console.error('Extraction request failed', error)
      setStatus('error')
      setErrorMessage(
        'Could not reach the extraction service. Check your connection and try again.',
      )
    }
  }

  const runPdfExtraction = async (file: File) => {
    setStatus('busy')
    setErrorMessage(null)
    setLastAction({ type: 'pdf', file })
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/extract-text', {
        method: 'POST',
        body: formData,
      })
      const data = await parseJsonSafely(response)
      if (!response.ok) {
        setStatus('error')
        setErrorMessage(readErrorMessage(data, 'Could not read the PDF.'))
        return
      }
      const parsed = extractTextResponseSchema.safeParse(data)
      if (!parsed.success) {
        setStatus('error')
        setErrorMessage('The PDF text result was not in the expected shape.')
        return
      }
      // Re-parsing the PDF just to retry a later failure would be wasteful:
      // once its text is out, a retry from here on can resubmit that text
      // directly (runExtraction records this as the new last action).
      await runExtraction(parsed.data.text)
    } catch (error) {
      console.error('PDF extraction request failed', error)
      setStatus('error')
      setErrorMessage(
        'Could not reach the PDF extraction service. Check your connection and try again.',
      )
    }
  }

  // Editing a value never confirms a field. If the field was already
  // human-confirmed, the edit drops it back to a draft so the user re-confirms
  // the new value. This is also the way to undo a single confirm.
  const updateField = (id: string, value: string) => {
    setFieldsBeforeConfirmAll(null)
    setSession({
      ...session,
      fields: session.fields.map((field) =>
        field.id === id ? { ...field, value, source: 'ai' } : field,
      ),
    })
  }

  const confirmField = (id: string) => {
    setFieldsBeforeConfirmAll(null)
    setSession({
      ...session,
      fields: session.fields.map((field) =>
        field.id === id ? { ...field, source: 'human' } : field,
      ),
    })
  }

  const updateDocumentText = (text: string, keepHighlightsInSync: boolean) => {
    setSession({
      ...session,
      documentText: text,
      // A remembered "update" preference keeps the two in step here, so the
      // document never goes stale and the prompt never fires.
      highlightBaseText: keepHighlightsInSync
        ? text
        : session.highlightBaseText,
    })
  }

  const syncHighlightBase = () => {
    setSession({ ...session, highlightBaseText: session.documentText })
  }

  // Confirms only the fields still in draft. Fields the user already confirmed
  // one at a time are left as they are.
  const confirmAllFields = () => {
    setFieldsBeforeConfirmAll(session.fields)
    setSession({
      ...session,
      fields: session.fields.map((field) =>
        field.source === 'ai' ? { ...field, source: 'human' } : field,
      ),
    })
  }

  const undoConfirmAll = () => {
    if (fieldsBeforeConfirmAll === null) {
      return
    }
    setSession({ ...session, fields: fieldsBeforeConfirmAll })
    setFieldsBeforeConfirmAll(null)
  }

  const startOver = () => {
    setFieldsBeforeConfirmAll(null)
    setLastAction(null)
    setErrorMessage(null)
    setStatus('idle')
    resetSession()
  }

  return {
    session,
    isLoaded,
    status,
    errorMessage,
    canRetry: lastAction !== null,
    hasSaveError,
    isHighlightStale:
      session.fields.length > 0 &&
      session.documentText !== session.highlightBaseText,
    canUndoConfirmAll: fieldsBeforeConfirmAll !== null,
    submitText: (text: string) => void runExtraction(text),
    submitPdf: (file: File) => void runPdfExtraction(file),
    updateField,
    confirmField,
    updateDocumentText,
    syncHighlightBase,
    confirmAllFields,
    undoConfirmAll,
    dismissConfirmAllUndo: () => setFieldsBeforeConfirmAll(null),
    startOver,
    retry: () => {
      if (lastAction?.type === 'text') {
        void runExtraction(lastAction.text)
      } else if (lastAction?.type === 'pdf') {
        void runPdfExtraction(lastAction.file)
      }
    },
  }
}
