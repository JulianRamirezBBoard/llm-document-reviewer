export const FIELD_SOURCES = ['ai', 'human'] as const
export type FieldSource = (typeof FIELD_SOURCES)[number]

export const isFieldSource = (value: string): value is FieldSource =>
  (FIELD_SOURCES as readonly string[]).includes(value)

export interface DocumentField {
  id: string
  label: string
  value: string
  source: FieldSource
}

export interface DocumentSession {
  documentText: string
  // The text the field-to-passage highlights are matched against. Normally
  // the same as documentText. It falls behind only when the user edits the
  // source after extraction and chooses "don't update" for the highlights.
  highlightBaseText: string
  documentType: string | null
  fields: DocumentField[]
}

export const createEmptyDocumentSession = (): DocumentSession => ({
  documentText: '',
  highlightBaseText: '',
  documentType: null,
  fields: [],
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const isDocumentField = (value: unknown): value is DocumentField => {
  if (!isRecord(value)) {
    return false
  }
  return (
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    typeof value.value === 'string' &&
    typeof value.source === 'string' &&
    isFieldSource(value.source)
  )
}

export const isDocumentSession = (value: unknown): value is DocumentSession => {
  if (!isRecord(value)) {
    return false
  }
  if (typeof value.documentText !== 'string') {
    return false
  }
  if (typeof value.highlightBaseText !== 'string') {
    return false
  }
  if (value.documentType !== null && typeof value.documentType !== 'string') {
    return false
  }
  if (!Array.isArray(value.fields)) {
    return false
  }
  return value.fields.every(isDocumentField)
}
