// Shared recipes for the small tracked-letter label style used across
// section headings, form labels, and table headers. Kept as plain strings
// (not components) since every usage is plain text, not an interactive
// element.

// A section heading, like "Add a document" or "Extracted fields".
export const sectionHeadingStyles =
  'font-data text-xs tracking-[0.15em] text-ink-soft uppercase'

// A smaller label, like a form field label or a table column header.
export const fieldLabelStyles =
  'font-data text-xs tracking-[0.1em] text-ink-soft uppercase'
