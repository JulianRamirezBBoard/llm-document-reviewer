import { generateText, Output } from 'ai'
import { z } from 'zod'
import { runClaudeCli } from '@/lib/extraction/claudeCliClient'
import { ALLOW_LOCAL_ONLY_BACKENDS } from '@/lib/extraction/localBackendFlag'
import {
  resolveChainForCall,
  type LlmRole,
  type ProviderEntry,
} from '@/lib/extraction/providers'

// One call site for both structured-output calls this app makes (the guardrail
// check and the main extraction). It owns the provider chain and the choice of
// backend, so provider.ts and guardrail.ts never name a vendor or a model.

export class MissingApiKeyError extends Error {}
export class InvalidStructuredOutputError extends Error {}
// Thrown when every provider in the chain failed.
export class AllProvidersFailedError extends Error {}

interface GenerateStructuredOutputRequest<T> {
  systemPrompt: string
  prompt: string
  schema: z.ZodType<T>
  schemaName: string
  schemaDescription: string
  role: LlmRole
}

// LLM_BACKEND=claude-cli is a local-testing convenience only (see README.md):
// it shells out to a developer's own Claude Code login instead of a provider
// API. Refuse it unless the hard-coded flag in localBackendFlag.ts is on, and
// always in production, so a stray env var cannot silently swap a real API
// call for this dev-only path.
const isUsingClaudeCli = (): boolean => {
  if (process.env.LLM_BACKEND !== 'claude-cli') {
    return false
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'LLM_BACKEND=claude-cli is not allowed when NODE_ENV is production.',
    )
  }
  if (!ALLOW_LOCAL_ONLY_BACKENDS) {
    throw new Error(
      'LLM_BACKEND=claude-cli is refused. Set ALLOW_LOCAL_ONLY_BACKENDS to true in src/lib/extraction/localBackendFlag.ts to use it in local development.',
    )
  }
  return true
}

const idVarForRole = (role: LlmRole): string | undefined =>
  role === 'guardrail'
    ? process.env.GUARDRAIL_MODEL_ID
    : process.env.EXTRACTION_MODEL_ID

// GUARDRAIL_PROVIDER lets a deployer run the safety check on a different
// provider from the extraction, so an abuse flag on that key cannot reach the
// main provider account. It applies to the guardrail call only.
const providerPinForRole = (role: LlmRole): string | undefined =>
  role === 'guardrail' ? process.env.GUARDRAIL_PROVIDER : undefined

const generateViaProvider = async <T>(
  entry: ProviderEntry,
  request: GenerateStructuredOutputRequest<T>,
  modelOverride: string | undefined,
): Promise<T> => {
  const { output } = await generateText({
    model: entry.model(request.role, modelOverride),
    output: Output.object({
      schema: request.schema,
      name: request.schemaName,
      description: request.schemaDescription,
    }),
    system: request.systemPrompt,
    prompt: request.prompt,
  })
  return output
}

// Try each provider once, in order. Any thrown error moves to the next one; a
// GuardrailBlockedError is a real answer and never reaches this layer. The
// last error is logged and re-thrown once the chain is exhausted.
const generateViaChain = async <T>(
  request: GenerateStructuredOutputRequest<T>,
): Promise<T> => {
  const { entries, modelOverride } = resolveChainForCall(
    idVarForRole(request.role),
    providerPinForRole(request.role),
  )
  if (entries.length === 0) {
    throw new MissingApiKeyError(
      'No LLM provider is configured. Set at least one provider API key (see .env.example).',
    )
  }
  let lastError: unknown
  for (const entry of entries) {
    try {
      return await generateViaProvider(entry, request, modelOverride)
    } catch (error) {
      lastError = error
      console.error(
        `Provider "${entry.name}" failed for the ${request.role} call`,
        error,
      )
    }
  }
  throw new AllProvidersFailedError(
    `Every configured provider failed for the ${request.role} call.`,
    { cause: lastError },
  )
}

// The CLI's --json-schema flag rejects a top-level "$schema" meta reference
// (it tries to resolve it as a ref rather than recognize it as the standard
// draft marker), so strip it from what z.toJSONSchema produces.
const toCliJsonSchema = (schema: z.ZodType): Record<string, unknown> => {
  const jsonSchema: Record<string, unknown> = { ...z.toJSONSchema(schema) }
  delete jsonSchema.$schema
  return jsonSchema
}

// The CLI maps a model id to an alias ("haiku"/"sonnet"/"opus"), so an
// Anthropic-style id per role is enough here.
const CLI_MODEL_BY_ROLE: Record<LlmRole, string> = {
  guardrail: 'claude-haiku-4-5-20251001',
  extraction: 'claude-sonnet-4-5',
}

const generateViaClaudeCli = async <T>(
  request: GenerateStructuredOutputRequest<T>,
): Promise<T> => {
  const rawOutput = await runClaudeCli({
    systemPrompt: request.systemPrompt,
    prompt: request.prompt,
    jsonSchema: toCliJsonSchema(request.schema),
    modelId: CLI_MODEL_BY_ROLE[request.role],
  })
  const parsedOutput = request.schema.safeParse(rawOutput)
  if (!parsedOutput.success) {
    throw new InvalidStructuredOutputError(
      'The claude CLI response did not match the expected shape.',
    )
  }
  return parsedOutput.data
}

export const generateStructuredOutput = async <T>(
  request: GenerateStructuredOutputRequest<T>,
): Promise<T> => {
  if (isUsingClaudeCli()) {
    return generateViaClaudeCli(request)
  }
  return generateViaChain(request)
}
