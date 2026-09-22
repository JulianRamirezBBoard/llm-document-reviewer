'use client'

import { useState } from 'react'
import { Button } from '@/components/Button/Button'
import { DocumentInput } from '@/components/DocumentInput/DocumentInput'
import { DocumentReviewView } from '@/components/DocumentReviewView/DocumentReviewView'
import { MobileNotice } from '@/components/MobileNotice/MobileNotice'
import { SettingsPanel } from '@/components/SettingsPanel/SettingsPanel'
import { useExtractionWorkflow } from '@/lib/extraction/useExtractionWorkflow'
import { useStaleHighlightPreference } from '@/lib/storage/useStaleHighlightPreference'

export default function Home() {
  const {
    session,
    isLoaded,
    status,
    errorMessage,
    canRetry,
    hasSaveError,
    canUndoConfirmAll,
    submitText,
    submitPdf,
    updateField,
    confirmField,
    updateDocumentText,
    syncHighlightBase,
    confirmAllFields,
    undoConfirmAll,
    dismissConfirmAllUndo,
    startOver,
    retry,
  } = useExtractionWorkflow()

  const { preference, setPreference } = useStaleHighlightPreference()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [stalePromptOpen, setStalePromptOpen] = useState(false)

  // The settings panel and the highlight prompt are never shown together.
  const openStalePrompt = () => {
    setSettingsOpen(false)
    setStalePromptOpen(true)
  }
  const toggleSettings = () => {
    if (stalePromptOpen) {
      return
    }
    setSettingsOpen((open) => !open)
  }

  const hasFields = session.fields.length > 0
  const fieldCount = session.fields.length
  const statusMessage =
    status === 'busy'
      ? 'Reading the document…'
      : isLoaded && fieldCount > 0
        ? `Process finished. Check the ${fieldCount} extracted field${
            fieldCount === 1 ? '' : 's'
          } below.`
        : ''

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-16 sm:px-8 md:max-w-3xl lg:max-w-4xl lg:px-10">
      <MobileNotice />
      <header className="animate-rise flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <p className="border-stamp font-data text-stamp inline-flex w-fit items-center gap-2 rounded-[2px] border px-2.5 py-1 text-xs tracking-[0.2em] uppercase">
            <span>Draft</span>
            <span aria-hidden="true">&rarr;</span>
            <span className="sr-only">to</span>
            <span>Confirmed</span>
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-w-[6.5rem] md:min-w-0"
            aria-expanded={settingsOpen}
            disabled={stalePromptOpen}
            onClick={toggleSettings}
          >
            Settings
          </Button>
        </div>
        <h1 className="font-display text-ink text-4xl leading-[1.25] tracking-[0.01em] sm:text-5xl">
          Paste a document.
          <br />
          Get back data you can check.
        </h1>
        <p className="text-ink-soft max-w-md text-base leading-relaxed sm:text-lg">
          Every field starts as a pencil draft from AI. Nothing counts until you
          confirm it yourself.
        </p>
      </header>

      {settingsOpen && !stalePromptOpen && (
        <SettingsPanel
          preference={preference}
          onChange={setPreference}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <div
        className="text-ink-soft min-h-6 text-sm"
        role="status"
        aria-live="polite"
        aria-busy={status === 'busy'}
      >
        {statusMessage}
      </div>

      {hasSaveError && (
        <p
          className="font-data text-alert text-xs tracking-[0.05em]"
          role="alert"
        >
          Your edits aren&apos;t being saved on this device. Copy anything
          important before you leave this page.
        </p>
      )}

      {status === 'error' && errorMessage && (
        <div
          className="animate-rise border-alert bg-paper-raised text-ink flex items-start gap-3 rounded-[2px] border p-4 text-sm"
          role="alert"
        >
          <span
            className="bg-alert font-data text-paper-raised flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-bold"
            aria-hidden="true"
          >
            !
          </span>
          <div className="flex flex-col items-start gap-2">
            <p>{errorMessage}</p>
            {canRetry && (
              <Button type="button" variant="outlineAlert" onClick={retry}>
                Try again
              </Button>
            )}
          </div>
        </div>
      )}

      {isLoaded &&
        (hasFields ? (
          <DocumentReviewView
            session={session}
            onDocumentTextChange={updateDocumentText}
            onFieldChange={updateField}
            onConfirmField={confirmField}
            onSyncHighlightBase={syncHighlightBase}
            preference={preference}
            onPreferenceChange={setPreference}
            isStalePromptOpen={stalePromptOpen}
            onOpenStalePrompt={openStalePrompt}
            onCloseStalePrompt={() => setStalePromptOpen(false)}
            onConfirmAll={confirmAllFields}
            onUndoConfirmAll={undoConfirmAll}
            onDismissConfirmAllUndo={dismissConfirmAllUndo}
            canUndoConfirmAll={canUndoConfirmAll}
            onStartOver={startOver}
          />
        ) : (
          <DocumentInput
            onSubmitText={submitText}
            onSubmitPdf={submitPdf}
            isBusy={status === 'busy'}
          />
        ))}
    </main>
  )
}
