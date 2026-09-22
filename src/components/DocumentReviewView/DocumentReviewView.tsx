'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/Button/Button'
import { DocumentEditor } from '@/components/DocumentEditor/DocumentEditor'
import { ExtractedFieldsTable } from '@/components/ExtractedFieldsTable/ExtractedFieldsTable'
import { StaleHighlightPrompt } from '@/components/StaleHighlightPrompt/StaleHighlightPrompt'
import type { DocumentSession } from '@/lib/document/types'
import type { HighlightField } from '@/lib/editor/fieldHighlightExtension'
import { matchFieldToSource } from '@/lib/editor/matchFieldToSource'
import { sectionHeadingStyles } from '@/lib/styles/textStyles'
import type { StaleHighlightPreference } from '@/lib/storage/useStaleHighlightPreference'

interface DocumentReviewViewProps {
  session: DocumentSession
  onDocumentTextChange: (text: string, keepHighlightsInSync: boolean) => void
  onFieldChange: (id: string, value: string) => void
  onConfirmField: (id: string) => void
  onSyncHighlightBase: () => void
  preference: StaleHighlightPreference | null
  onPreferenceChange: (preference: StaleHighlightPreference | null) => void
  isStalePromptOpen: boolean
  onOpenStalePrompt: () => void
  onCloseStalePrompt: () => void
  onConfirmAll: () => void
  onUndoConfirmAll: () => void
  onDismissConfirmAllUndo: () => void
  canUndoConfirmAll: boolean
  onStartOver: () => void
}

const UNDO_NOTICE_MS = 7000

export function DocumentReviewView({
  session,
  onDocumentTextChange,
  onFieldChange,
  onConfirmField,
  onSyncHighlightBase,
  preference,
  onPreferenceChange,
  isStalePromptOpen,
  onOpenStalePrompt,
  onCloseStalePrompt,
  onConfirmAll,
  onUndoConfirmAll,
  onDismissConfirmAllUndo,
  canUndoConfirmAll,
  onStartOver,
}: DocumentReviewViewProps) {
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null)
  const [rebuildToken, setRebuildToken] = useState(0)
  // Tiptap can emit one change event while it parses the restored document.
  // The prompt only arms after a real key press or click inside this view, so
  // that parse never counts as the user's first edit.
  const hasUserInteractedRef = useRef(false)
  const armUserInteraction = () => {
    hasUserInteractedRef.current = true
  }

  const highlightFields = useMemo<HighlightField[]>(
    () =>
      session.fields.map((field) => ({
        id: field.id,
        value: field.value,
        source: field.source,
      })),
    [session.fields],
  )

  const unmatchedFieldIds = useMemo(() => {
    const ids = new Set<string>()
    for (const field of session.fields) {
      if (matchFieldToSource(session.highlightBaseText, field.value) === null) {
        ids.add(field.id)
      }
    }
    return ids
  }, [session.fields, session.highlightBaseText])

  // A remembered "update" preference keeps highlights in step as the user
  // types, so the document never goes stale and the prompt never appears.
  const keepHighlightsInSync =
    preference === 'update-all' || preference === 'update-once'

  useEffect(() => {
    if (!canUndoConfirmAll) {
      return
    }
    const timer = window.setTimeout(onDismissConfirmAllUndo, UNDO_NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [canUndoConfirmAll, onDismissConfirmAllUndo])

  // The first edit that can pull a highlight out of line, a field value or the
  // source text, opens the prompt once. After that a preference is set for the
  // session and it never opens again.
  const openStalePromptIfUnset = () => {
    if (hasUserInteractedRef.current && preference === null) {
      onOpenStalePrompt()
    }
  }

  const handleDocumentTextChange = (text: string) => {
    if (text === session.documentText) {
      return
    }
    onDocumentTextChange(text, keepHighlightsInSync)
    if (keepHighlightsInSync) {
      setRebuildToken((token) => token + 1)
      return
    }
    openStalePromptIfUnset()
  }

  const handleFieldChange = (id: string, value: string) => {
    onFieldChange(id, value)
    openStalePromptIfUnset()
  }

  const handleStaleChoice = (choice: StaleHighlightPreference) => {
    onPreferenceChange(choice)
    onCloseStalePrompt()
    if (choice !== 'dont-update') {
      onSyncHighlightBase()
      setRebuildToken((token) => token + 1)
    }
  }

  const showStalePrompt = isStalePromptOpen && preference === null

  return (
    <div
      className="flex flex-col gap-6"
      onKeyDownCapture={armUserInteraction}
      onPointerDownCapture={armUserInteraction}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="font-data text-ink-soft text-xs tracking-[0.08em] uppercase">
          Review
        </p>
        <Button type="button" variant="outline" onClick={onStartOver}>
          Start over
        </Button>
      </div>

      {/* Side by side only from desktop width up. Phones and tablets held
          upright get the two panes stacked instead, which fits a narrow
          screen without cramming both columns together. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <section
          aria-label="Source document"
          className="flex min-w-0 flex-1 flex-col gap-3"
        >
          <h2 className={sectionHeadingStyles}>Source document</h2>
          <div className="paper-ruled-tight border-paper-line bg-paper focus-within:outline-stamp min-h-[15rem] rounded-[2px] border focus-within:outline focus-within:outline-2 focus-within:outline-offset-1">
            <DocumentEditor
              value={session.documentText}
              onChange={handleDocumentTextChange}
              ariaLabel="Source document"
              highlightFields={highlightFields}
              activeFieldId={activeFieldId}
              highlightRebuildToken={rebuildToken}
            />
          </div>
        </section>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <ExtractedFieldsTable
            fields={session.fields}
            onFieldChange={handleFieldChange}
            onConfirmField={onConfirmField}
            unmatchedFieldIds={unmatchedFieldIds}
            activeFieldId={activeFieldId}
            onActiveFieldChange={setActiveFieldId}
            onConfirmAll={onConfirmAll}
          />
          {canUndoConfirmAll && (
            <div
              role="status"
              className="border-paper-line bg-paper-raised flex items-center justify-between gap-3 rounded-[2px] border px-3 py-2 text-sm"
            >
              <span className="text-ink-soft">All fields confirmed.</span>
              <button
                type="button"
                onClick={onUndoConfirmAll}
                className="font-data text-stamp hover:text-stamp-deep active:text-stamp-deep cursor-pointer text-xs tracking-[0.08em] uppercase transition-colors"
              >
                Undo
              </button>
            </div>
          )}
        </div>
      </div>

      {showStalePrompt && <StaleHighlightPrompt onChoose={handleStaleChoice} />}
    </div>
  )
}
