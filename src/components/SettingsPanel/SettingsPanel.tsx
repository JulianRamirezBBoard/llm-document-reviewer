'use client'

import { useEffect, useId } from 'react'
import { sectionHeadingStyles } from '@/lib/styles/textStyles'
import type { StaleHighlightPreference } from '@/lib/storage/useStaleHighlightPreference'

interface SettingsPanelProps {
  preference: StaleHighlightPreference | null
  onChange: (preference: StaleHighlightPreference | null) => void
  onClose: () => void
}

const CHOICES: {
  value: StaleHighlightPreference | null
  label: string
}[] = [
  { value: null, label: 'Ask me each time' },
  { value: 'update-all', label: 'Update all and don’t ask again' },
  { value: 'update-once', label: 'Update once' },
  { value: 'dont-update', label: 'Don’t update' },
]

export function SettingsPanel({
  preference,
  onChange,
  onClose,
}: SettingsPanelProps) {
  const titleId = useId()
  const groupId = useId()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <section
      aria-labelledby={titleId}
      className="border-paper-line bg-paper-raised flex flex-col gap-4 rounded-[3px] border p-6 shadow-[0_2px_8px_color-mix(in_srgb,var(--color-ink)_12%,transparent)]"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id={titleId} className={sectionHeadingStyles}>
          Highlight updates
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="font-data text-ink-soft hover:text-ink active:text-ink cursor-pointer text-xs tracking-[0.08em] uppercase transition-colors"
        >
          Close
        </button>
      </div>
      <p className="text-ink-soft text-sm leading-relaxed">
        When you edit a field value or the source text, this is what happens to
        the highlights that link them. Kept for this browser session only.
      </p>
      <div
        role="group"
        aria-labelledby={groupId}
        className="flex flex-col gap-2"
      >
        <span id={groupId} className="sr-only">
          Highlight update choice
        </span>
        {CHOICES.map((choice) => {
          const isActive = preference === choice.value
          return (
            <button
              key={choice.label}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(choice.value)}
              className={`font-data cursor-pointer rounded-[2px] border px-4 py-2.5 text-left text-xs tracking-[0.08em] uppercase transition-colors ${
                isActive
                  ? 'border-stamp bg-stamp text-paper-raised active:bg-stamp-deep'
                  : 'border-paper-line text-ink-soft hover:border-ink-soft hover:text-ink active:bg-paper-line active:text-ink'
              }`}
            >
              {choice.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}
