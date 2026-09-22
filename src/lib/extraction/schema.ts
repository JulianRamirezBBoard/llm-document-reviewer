import { z } from 'zod'

// Shared by the API request schema and the provider functions, so the cap
// holds even if something other than the API route ever calls them directly.
export const MAX_DOCUMENT_TEXT_LENGTH = 50_000

export const extractedFieldSchema = z.object({
  label: z.string().min(1),
  value: z.string(),
})

export type ExtractedFieldFromModel = z.infer<typeof extractedFieldSchema>

export const extractionResultSchema = z.object({
  documentType: z.string().min(1),
  fields: z.array(extractedFieldSchema).min(1),
})

export type ExtractionResult = z.infer<typeof extractionResultSchema>
