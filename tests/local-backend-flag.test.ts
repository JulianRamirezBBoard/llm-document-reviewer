import { z } from 'zod'
import {
  generateStructuredOutput,
  MissingApiKeyError,
} from '@/lib/extraction/generateStructuredOutput'
import { runClaudeCli } from '@/lib/extraction/claudeCliClient'
import { ALLOW_LOCAL_ONLY_BACKENDS } from '@/lib/extraction/localBackendFlag'

jest.mock('@ai-sdk/anthropic', () => ({ createAnthropic: () => jest.fn() }))
jest.mock('@ai-sdk/openai', () => ({ createOpenAI: () => jest.fn() }))
jest.mock('@ai-sdk/mistral', () => ({ createMistral: () => jest.fn() }))
jest.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: () => jest.fn(),
}))
jest.mock('ai', () => ({
  generateText: jest.fn(),
  Output: { object: jest.fn() },
}))
jest.mock('@/lib/extraction/claudeCliClient', () => ({
  runClaudeCli: jest.fn(),
}))
// No mock of localBackendFlag here: this suite checks the real shipped value.

const mockedRunClaudeCli = jest.mocked(runClaudeCli)

const buildRequest = () => ({
  systemPrompt: 'system prompt',
  prompt: 'user prompt',
  schema: z.object({ greeting: z.string() }),
  schemaName: 'Test',
  schemaDescription: 'a test schema',
  role: 'extraction' as const,
})

describe('ALLOW_LOCAL_ONLY_BACKENDS', () => {
  beforeEach(() => {
    delete process.env.LLM_BACKEND
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.MISTRAL_API_KEY
    delete process.env.OPENROUTER_API_KEY
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('ships off', () => {
    expect(ALLOW_LOCAL_ONLY_BACKENDS).toBe(false)
  })

  it('refuses LLM_BACKEND=claude-cli while it ships off, without spawning the CLI', async () => {
    process.env.LLM_BACKEND = 'claude-cli'

    await expect(generateStructuredOutput(buildRequest())).rejects.toThrow(
      /ALLOW_LOCAL_ONLY_BACKENDS/,
    )
    expect(mockedRunClaudeCli).not.toHaveBeenCalled()
  })

  it('falls through to the provider chain when LLM_BACKEND is unset', async () => {
    await expect(generateStructuredOutput(buildRequest())).rejects.toThrow(
      MissingApiKeyError,
    )
  })
})
