import { z } from 'zod'
import { generateText } from 'ai'
import {
  generateStructuredOutput,
  AllProvidersFailedError,
  InvalidStructuredOutputError,
  MissingApiKeyError,
} from '@/lib/extraction/generateStructuredOutput'
import { runClaudeCli } from '@/lib/extraction/claudeCliClient'

// Stub the ESM-only AI SDK packages so Jest can load the module under test.
// Each provider factory returns a model tagged with its provider name, so the
// generateText stub can tell which provider a call came from.
jest.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: () => (modelId: string) => ({
    __provider: 'anthropic',
    modelId,
  }),
}))
jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: () => (modelId: string) => ({ __provider: 'openai', modelId }),
}))
jest.mock('@ai-sdk/mistral', () => ({
  createMistral: () => (modelId: string) => ({
    __provider: 'mistral',
    modelId,
  }),
}))
jest.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: () => (modelId: string) => ({
    __provider: 'openrouter',
    modelId,
  }),
}))
jest.mock('ai', () => ({
  generateText: jest.fn(),
  Output: { object: jest.fn() },
}))
jest.mock('@/lib/extraction/claudeCliClient', () => ({
  runClaudeCli: jest.fn(),
}))
// This suite exercises the claude-cli path, so the local-only flag is on here.
// The refusal when it is off is covered in local-backend-flag.test.ts.
jest.mock('@/lib/extraction/localBackendFlag', () => ({
  ALLOW_LOCAL_ONLY_BACKENDS: true,
}))

const mockedRunClaudeCli = jest.mocked(runClaudeCli)
// Re-typed loosely: the stub inspects a fake `model` tag the provider mocks
// attach, which the real generateText signature does not describe.
const mockedGenerateText = jest.mocked(generateText) as unknown as jest.Mock
const sampleSchema = z.object({ greeting: z.string() })

const buildRequest = () => ({
  systemPrompt: 'system prompt',
  prompt: 'user prompt',
  schema: sampleSchema,
  schemaName: 'Test',
  schemaDescription: 'a test schema',
  role: 'extraction' as const,
})

const buildGuardrailRequest = () => ({
  ...buildRequest(),
  role: 'guardrail' as const,
})

const PROVIDER_KEYS = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'MISTRAL_API_KEY',
  'OPENROUTER_API_KEY',
]

describe('generateStructuredOutput', () => {
  beforeEach(() => {
    delete process.env.LLM_BACKEND
    delete process.env.LLM_PROVIDER_ORDER
    delete process.env.GUARDRAIL_PROVIDER
    for (const key of PROVIDER_KEYS) {
      delete process.env[key]
    }
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('throws MissingApiKeyError when no provider has a key', async () => {
    await expect(generateStructuredOutput(buildRequest())).rejects.toThrow(
      MissingApiKeyError,
    )
    expect(mockedGenerateText).not.toHaveBeenCalled()
  })

  it('routes to the only provider that has a key', async () => {
    process.env.OPENAI_API_KEY = 'test-openai'
    mockedGenerateText.mockImplementation(async ({ model }) => ({
      output: { greeting: `from ${model.__provider}` },
    }))

    const result = await generateStructuredOutput(buildRequest())

    expect(result).toEqual({ greeting: 'from openai' })
  })

  it('falls back to the next provider in the chain when the first one throws', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic'
    process.env.OPENAI_API_KEY = 'test-openai'
    mockedGenerateText.mockImplementation(async ({ model }) => {
      if (model.__provider === 'anthropic') {
        throw new Error('anthropic is down')
      }
      return { output: { greeting: `from ${model.__provider}` } }
    })

    const result = await generateStructuredOutput(buildRequest())

    expect(result).toEqual({ greeting: 'from openai' })
    expect(mockedGenerateText).toHaveBeenCalledTimes(2)
  })

  it('honours LLM_PROVIDER_ORDER for which provider is tried first', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic'
    process.env.MISTRAL_API_KEY = 'test-mistral'
    process.env.LLM_PROVIDER_ORDER = 'mistral,anthropic'
    mockedGenerateText.mockImplementation(async ({ model }) => ({
      output: { greeting: `from ${model.__provider}` },
    }))

    const result = await generateStructuredOutput(buildRequest())

    expect(result).toEqual({ greeting: 'from mistral' })
  })

  it('sends the guardrail call to GUARDRAIL_PROVIDER while extraction stays on the chain', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic'
    process.env.MISTRAL_API_KEY = 'test-mistral'
    process.env.GUARDRAIL_PROVIDER = 'mistral'
    mockedGenerateText.mockImplementation(async ({ model }) => ({
      output: { greeting: `from ${model.__provider}` },
    }))

    await expect(
      generateStructuredOutput(buildGuardrailRequest()),
    ).resolves.toEqual({ greeting: 'from mistral' })
    await expect(generateStructuredOutput(buildRequest())).resolves.toEqual({
      greeting: 'from anthropic',
    })
  })

  it('throws AllProvidersFailedError when every provider in the chain throws', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic'
    process.env.OPENAI_API_KEY = 'test-openai'
    mockedGenerateText.mockRejectedValue(new Error('provider unavailable'))

    await expect(generateStructuredOutput(buildRequest())).rejects.toThrow(
      AllProvidersFailedError,
    )
    expect(mockedGenerateText).toHaveBeenCalledTimes(2)
  })

  it('uses the claude CLI backend when LLM_BACKEND is set to claude-cli', async () => {
    process.env.LLM_BACKEND = 'claude-cli'
    mockedRunClaudeCli.mockResolvedValue({ greeting: 'hello' })

    const result = await generateStructuredOutput(buildRequest())

    expect(result).toEqual({ greeting: 'hello' })
    expect(mockedRunClaudeCli).toHaveBeenCalledTimes(1)
    expect(mockedGenerateText).not.toHaveBeenCalled()
  })

  it('rejects a claude CLI response that does not match the schema', async () => {
    process.env.LLM_BACKEND = 'claude-cli'
    mockedRunClaudeCli.mockResolvedValue({ wrongField: 'oops' })

    await expect(generateStructuredOutput(buildRequest())).rejects.toThrow(
      InvalidStructuredOutputError,
    )
  })

  it('does not need a provider key when the claude CLI backend is selected', async () => {
    process.env.LLM_BACKEND = 'claude-cli'
    mockedRunClaudeCli.mockResolvedValue({ greeting: 'hi' })

    await expect(generateStructuredOutput(buildRequest())).resolves.toEqual({
      greeting: 'hi',
    })
  })
})
