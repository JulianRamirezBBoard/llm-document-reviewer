'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/Button/Button'
import type { DocumentField } from '@/lib/document/types'
import { fieldLabelStyles, sectionHeadingStyles } from '@/lib/styles/textStyles'

interface ExtractedFieldsTableProps {
  fields: DocumentField[]
  onFieldChange: (id: string, value: string) => void
  onConfirmField?: (id: string) => void
  unmatchedFieldIds?: ReadonlySet<string>
  activeFieldId?: string | null
  onActiveFieldChange?: (id: string | null) => void
  onConfirmAll?: () => void
}

// One field is a three-part row: label, editable value, status. It stacks
// vertically on a phone and lines up as columns from `sm` width up, so a
// long value never gets clipped on a narrow screen.
const ROW_GRID =
  'grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[10rem_1fr_auto]'

export function ExtractedFieldsTable({
  fields,
  onFieldChange,
  onConfirmField,
  unmatchedFieldIds,
  activeFieldId = null,
  onActiveFieldChange,
  onConfirmAll,
}: ExtractedFieldsTableProps) {
  const headingId = useId()
  const [announcement, setAnnouncement] = useState('')

  if (fields.length === 0) {
    return null
  }

  const hasDraftFields = fields.some((field) => field.source === 'ai')

  const handleConfirmField = (field: DocumentField) => {
    onConfirmField?.(field.id)
    setAnnouncement(`${field.label} confirmed`)
  }

  const handleConfirmAll = () => {
    onConfirmAll?.()
    setAnnouncement('All draft fields confirmed')
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby={headingId}>
      <div className="flex items-center justify-between gap-4">
        <h2 id={headingId} className={sectionHeadingStyles}>
          Extracted fields
        </h2>
        {onConfirmAll && (
          <Button
            type="button"
            variant="outline"
            onClick={handleConfirmAll}
            disabled={!hasDraftFields}
          >
            Confirm all
          </Button>
        )}
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      <div
        role="table"
        aria-labelledby={headingId}
        className="font-data text-sm"
      >
        <div
          role="row"
          className={`border-paper-line hidden border-b pb-2 sm:grid ${ROW_GRID}`}
        >
          <span role="columnheader" className={fieldLabelStyles}>
            Field
          </span>
          <span role="columnheader" className={fieldLabelStyles}>
            Value
          </span>
          <span role="columnheader" className={fieldLabelStyles}>
            Status
          </span>
        </div>
        {fields.map((field) => {
          const inputId = `field-input-${field.id}`
          const isHumanConfirmed = field.source === 'human'
          const isUnmatched = unmatchedFieldIds?.has(field.id) ?? false
          const isActive = activeFieldId === field.id
          return (
            <div
              role="row"
              key={field.id}
              className={`border-paper-line items-start border-b py-3 ${ROW_GRID} ${
                isActive
                  ? 'bg-[color-mix(in_srgb,var(--color-stamp)_10%,transparent)]'
                  : ''
              }`}
              onMouseEnter={() => onActiveFieldChange?.(field.id)}
              onMouseLeave={() => onActiveFieldChange?.(null)}
            >
              <div role="rowheader" className="pt-1">
                <label htmlFor={inputId} className="text-ink font-medium">
                  {field.label}
                </label>
              </div>
              <div role="cell" className="min-w-0">
                <input
                  id={inputId}
                  className="font-data text-ink hover:border-paper-line focus-visible:border-stamp w-full border-b border-transparent bg-transparent px-0.5 py-1 text-sm focus-visible:outline-none"
                  type="text"
                  value={field.value}
                  onChange={(event) =>
                    onFieldChange(field.id, event.target.value)
                  }
                  onFocus={() => onActiveFieldChange?.(field.id)}
                  onBlur={() => onActiveFieldChange?.(null)}
                />
                {isUnmatched && (
                  <span className="text-ink-soft mt-1 block text-xs tracking-[0.05em]">
                    Not found in source
                  </span>
                )}
              </div>
              <div
                role="cell"
                className="flex flex-wrap items-center gap-2 pt-1"
              >
                {isHumanConfirmed ? (
                  <span className="animate-stamp-in border-stamp font-data text-stamp inline-flex items-center rounded-[2px] border-[1.5px] px-2 py-0.5 text-xs font-medium tracking-[0.1em] uppercase [text-shadow:0_0_1px_color-mix(in_srgb,var(--color-stamp)_40%,transparent)]">
                    Confirmed
                    <span className="sr-only"> by you</span>
                  </span>
                ) : (
                  <>
                    <span className="border-graphite font-data text-graphite inline-flex items-center border-b border-dashed pb-px text-xs tracking-[0.05em]">
                      Draft
                      <span className="sr-only"> suggested by AI</span>
                    </span>
                    {onConfirmField && (
                      <button
                        type="button"
                        onClick={() => handleConfirmField(field)}
                        className="font-data border-stamp text-stamp hover:bg-stamp hover:text-paper-raised active:bg-stamp-deep active:text-paper-raised cursor-pointer rounded-[2px] border px-2 py-1 text-xs tracking-[0.08em] uppercase transition-colors"
                      >
                        Confirm
                        <span className="sr-only"> {field.label}</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
