'use client'

import { useId, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button, getButtonClassNames } from '@/components/Button/Button'
import { DocumentEditor } from '@/components/DocumentEditor/DocumentEditor'
import { SAMPLE_DOCUMENT } from '@/lib/document/sampleDocument'
import { fieldLabelStyles, sectionHeadingStyles } from '@/lib/styles/textStyles'

interface DocumentInputProps {
  onSubmitText: (text: string) => void
  onSubmitPdf: (file: File) => void
  isBusy: boolean
}

const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024

export function DocumentInput({
  onSubmitText,
  onSubmitPdf,
  isBusy,
}: DocumentInputProps) {
  const headingId = useId()
  const fileInputId = useId()
  const fileErrorId = useId()
  const [pastedText, setPastedText] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  // True only while the built-in sample runs, so the spinner sits on the
  // sample button and not on the main submit button.
  const [isSampleRunning, setIsSampleRunning] = useState(false)

  // With nothing pasted yet there is nothing to read, so the sample button
  // takes the loud primary style and leads the row. Once the user pastes
  // text, "Read the document" takes over that role.
  const sampleLeads = pastedText.trim().length === 0 || isSampleRunning

  const handleTextSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = pastedText.trim()
    if (trimmed.length === 0) {
      return
    }
    setIsSampleRunning(false)
    onSubmitText(trimmed)
  }

  const handleShowSample = () => {
    setFileError(null)
    setIsSampleRunning(true)
    setPastedText(SAMPLE_DOCUMENT)
    onSubmitText(SAMPLE_DOCUMENT.trim())
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    if (file.type !== 'application/pdf') {
      setFileError('Choose a PDF file.')
      return
    }
    if (file.size > MAX_PDF_SIZE_BYTES) {
      setFileError('This PDF is too large. Choose a file under 20 MB.')
      return
    }
    setFileError(null)
    setIsSampleRunning(false)
    onSubmitPdf(file)
  }

  return (
    <section
      className="border-paper-line border-t-stamp bg-paper-raised relative flex flex-col gap-4 rounded-[3px] border border-t-[3px] p-6 shadow-[0_1px_2px_color-mix(in_srgb,var(--color-ink)_8%,transparent)] sm:p-7 md:p-8"
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className={sectionHeadingStyles}>
        Add a document
      </h2>
      <form className="flex flex-col gap-3" onSubmit={handleTextSubmit}>
        <p className={fieldLabelStyles}>Paste document text</p>
        <div className="paper-ruled-tight border-paper-line bg-paper focus-within:outline-stamp min-h-[15rem] rounded-[2px] border focus-within:outline focus-within:outline-2 focus-within:outline-offset-1">
          <DocumentEditor
            value={pastedText}
            onChange={setPastedText}
            ariaLabel="Paste document text"
            disabled={isBusy}
          />
        </div>
        {sampleLeads && !isBusy && (
          <p className="text-ink-soft text-sm">New here? Try a sample first.</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            variant={sampleLeads ? 'outline' : 'primary'}
            className={sampleLeads ? 'order-2' : undefined}
            isLoading={isBusy && !isSampleRunning}
            disabled={isBusy || pastedText.trim().length === 0}
          >
            Read the document
          </Button>
          <Button
            type="button"
            variant={sampleLeads ? 'primary' : 'outline'}
            className={sampleLeads ? 'order-1' : undefined}
            onClick={handleShowSample}
            isLoading={isBusy && isSampleRunning}
            disabled={isBusy}
          >
            Show me a sample
          </Button>
        </div>
      </form>
      <div className="border-paper-line flex flex-col items-start gap-3 border-t pt-4">
        <span
          className={`flex w-full items-center gap-3 ${fieldLabelStyles} after:bg-paper-line after:h-px after:flex-1`}
        >
          Or attach a PDF
        </span>
        <div className="relative">
          <input
            id={fileInputId}
            className="peer absolute h-px w-px overflow-hidden p-0 whitespace-nowrap [clip:rect(0,0,0,0)]"
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            disabled={isBusy}
            aria-invalid={fileError ? true : undefined}
            aria-describedby={fileError ? fileErrorId : undefined}
          />
          <label
            htmlFor={fileInputId}
            className={getButtonClassNames(
              'outline',
              'peer-focus-visible:outline-stamp hover:border-ink hover:text-ink active:bg-paper-line active:text-ink inline-flex cursor-pointer items-center peer-focus-visible:outline-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
            )}
          >
            Choose a PDF file
          </label>
        </div>
        {fileError && (
          <p id={fileErrorId} className="text-alert text-xs" role="alert">
            {fileError}
          </p>
        )}
      </div>
    </section>
  )
}
