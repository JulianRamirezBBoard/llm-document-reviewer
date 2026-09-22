'use client'

import { useEffect, useId, useRef } from 'react'
import { Button } from '@/components/Button/Button'
import { sectionHeadingStyles } from '@/lib/styles/textStyles'
import type { StaleHighlightPreference } from '@/lib/storage/useStaleHighlightPreference'

interface StaleHighlightPromptProps {
  onChoose: (preference: StaleHighlightPreference) => void
}

export function StaleHighlightPrompt({ onChoose }: StaleHighlightPromptProps) {
  const titleId = useId()
  const bodyId = useId()
  const firstButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    firstButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onChoose('dont-update')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onChoose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--color-ink)_45%,transparent)] p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="border-paper-line bg-paper-raised flex w-full max-w-md flex-col gap-4 rounded-[3px] border p-6 shadow-[0_8px_24px_color-mix(in_srgb,var(--color-ink)_20%,transparent)]"
      >
        <h2 id={titleId} className={sectionHeadingStyles}>
          Keep highlights in sync?
        </h2>
        <p id={bodyId} className="text-ink text-sm leading-relaxed">
          As you edit field values or the source text, the highlights that link
          them can go out of date. Update them to match? Your answer is kept for
          this browser session only. It will not carry over to a future visit.
        </p>
        <div className="flex flex-col gap-2">
          <Button
            ref={firstButtonRef}
            type="button"
            variant="primary"
            onClick={() => onChoose('update-all')}
          >
            Update all and don&apos;t ask again
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onChoose('update-once')}
          >
            Update once
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onChoose('dont-update')}
          >
            Don&apos;t update
          </Button>
        </div>
      </div>
    </div>
  )
}
