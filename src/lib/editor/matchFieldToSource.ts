// Finds where a field's extracted value sits inside the source text, so the
// source view can highlight that passage. The AI often reformats a value
// (trims it, changes case), so the match is case-insensitive and ignores
// surrounding whitespace. Returns null when the value is not in the text at
// all, which the table then shows plainly instead of a highlight.

export interface SourceMatch {
  from: number
  to: number
}

export const matchFieldToSource = (
  sourceText: string,
  fieldValue: string,
): SourceMatch | null => {
  const needle = fieldValue.trim()
  if (needle.length === 0) {
    return null
  }
  const from = sourceText.toLowerCase().indexOf(needle.toLowerCase())
  if (from === -1) {
    return null
  }
  return { from, to: from + needle.length }
}
