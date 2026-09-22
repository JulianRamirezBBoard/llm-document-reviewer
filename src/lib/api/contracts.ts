import { z } from 'zod'
import {
  extractionResultSchema,
  MAX_DOCUMENT_TEXT_LENGTH,
} from '@/lib/extraction/schema'

export const extractFieldsRequestSchema = z.object({
  documentText: z.string().trim().min(1).max(MAX_DOCUMENT_TEXT_LENGTH),
})

export type ExtractFieldsRequest = z.infer<typeof extractFieldsRequestSchema>

export const extractFieldsResponseSchema = extractionResultSchema

export type ExtractFieldsResponse = z.infer<typeof extractFieldsResponseSchema>

export const extractTextResponseSchema = z.object({
  text: z.string(),
})

export type ExtractTextResponse = z.infer<typeof extractTextResponseSchema>

export const errorResponseSchema = z.object({
  error: z.string(),
})

export type ErrorResponse = z.infer<typeof errorResponseSchema>
