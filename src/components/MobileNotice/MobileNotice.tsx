'use client'

import { useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'doc-reviewer:desktop-hint-dismissed'

const wasDismissedBefore = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function MobileNotice() {
  // Start hidden so a visitor who dismissed it before never sees it flash in.
  const [isDismissed, setIsDismissed] = useState(true)
  const hasCheckedRef = useRef(false)

  useEffect(() => {
    if (hasCheckedRef.current) {
      return
    }
    hasCheckedRef.current = true
    setIsDismissed(wasDismissedBefore())
  }, [])

  if (isDismissed) {
    return null
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // A private window can block storage; the notice just returns next visit.
    }
  }

  return (
    <aside
      aria-label="Screen size note"
      className="border-paper-line bg-paper-raised text-ink-soft flex items-center gap-6 rounded-[2px] border p-3 text-xs md:hidden"
    >
      <p className="flex-1 text-justify leading-relaxed">
        Built for a wider screen. This works on a phone, but reviewing fields
        next to the source document is easier on a desktop.
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        className="font-data text-ink-soft hover:text-ink active:text-ink shrink-0 cursor-pointer py-1 tracking-[0.08em] uppercase transition-colors"
      >
        Dismiss
        <span className="sr-only"> this note</span>
      </button>
    </aside>
  )
}
