import {
  buildProviderChain,
  parseProviderPin,
  resolveChainForCall,
} from '@/lib/extraction/providers'

jest.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: () => (modelId: string) => ({ p: 'anthropic', modelId }),
}))
jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: () => (modelId: string) => ({ p: 'openai', modelId }),
}))
jest.mock('@ai-sdk/mistral', () => ({
  createMistral: () => (modelId: string) => ({ p: 'mistral', modelId }),
}))
jest.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: () => (modelId: string) => ({
    p: 'openrouter',
    modelId,
  }),
}))

const KEYS = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'MISTRAL_API_KEY',
  'OPENROUTER_API_KEY',
  'ANTHROPIC_MODEL',
  'OPENAI_MODEL',
  'MISTRAL_MODEL',
  'OPENROUTER_MODEL',
  'LLM_PROVIDER_ORDER',
]

describe('provider chain', () => {
  beforeEach(() => {
    for (const key of KEYS) {
      delete process.env[key]
    }
  })

  it('is empty when no provider has a key', () => {
    expect(buildProviderChain()).toEqual([])
  })

  it('includes only providers whose key is set, Anthropic first by default', () => {
    process.env.OPENAI_API_KEY = 'x'
    process.env.ANTHROPIC_API_KEY = 'x'

    expect(buildProviderChain().map((entry) => entry.name)).toEqual([
      'anthropic',
      'openai',
    ])
  })

  it('follows LLM_PROVIDER_ORDER and skips a named provider with no key', () => {
    process.env.ANTHROPIC_API_KEY = 'x'
    process.env.MISTRAL_API_KEY = 'x'
    process.env.LLM_PROVIDER_ORDER = 'mistral, openai, anthropic'

    expect(buildProviderChain().map((entry) => entry.name)).toEqual([
      'mistral',
      'anthropic',
    ])
  })

  it('resolves the model per role, with the per-provider env var winning', () => {
    process.env.ANTHROPIC_API_KEY = 'x'
    const [entry] = buildProviderChain()

    expect(entry.model('guardrail')).toMatchObject({
      p: 'anthropic',
      modelId: 'claude-haiku-4-5-20251001',
    })

    process.env.ANTHROPIC_MODEL = 'claude-custom'
    expect(entry.model('extraction')).toMatchObject({
      modelId: 'claude-custom',
    })
  })
})

describe('parseProviderPin', () => {
  it('returns null for an unset or bare model id', () => {
    expect(parseProviderPin(undefined)).toBeNull()
    expect(parseProviderPin('claude-sonnet-4-5')).toBeNull()
  })

  it('splits a "provider:model" value', () => {
    expect(parseProviderPin('openai:gpt-5')).toEqual({
      name: 'openai',
      model: 'gpt-5',
    })
  })

  it('returns null for an unknown provider name', () => {
    expect(parseProviderPin('unknown:some-model')).toBeNull()
  })
})

describe('resolveChainForCall', () => {
  beforeEach(() => {
    for (const key of KEYS) {
      delete process.env[key]
    }
  })

  it('pins one provider when given "provider:model"', () => {
    process.env.OPENAI_API_KEY = 'x'
    process.env.ANTHROPIC_API_KEY = 'x'

    const resolved = resolveChainForCall('openai:gpt-5')

    expect(resolved.entries.map((entry) => entry.name)).toEqual(['openai'])
    expect(resolved.modelOverride).toBe('gpt-5')
  })

  it('uses the full chain and a bare model override otherwise', () => {
    process.env.ANTHROPIC_API_KEY = 'x'

    const resolved = resolveChainForCall('claude-custom')

    expect(resolved.entries.map((entry) => entry.name)).toEqual(['anthropic'])
    expect(resolved.modelOverride).toBe('claude-custom')
  })

  it('pins the guardrail to GUARDRAIL_PROVIDER with no fallback', () => {
    process.env.ANTHROPIC_API_KEY = 'x'
    process.env.MISTRAL_API_KEY = 'x'

    const resolved = resolveChainForCall(undefined, 'mistral')

    expect(resolved.entries.map((entry) => entry.name)).toEqual(['mistral'])
  })

  it('carries a bare id-var model onto the GUARDRAIL_PROVIDER pin', () => {
    process.env.MISTRAL_API_KEY = 'x'

    const resolved = resolveChainForCall('mistral-small-2409', 'mistral')

    expect(resolved.entries.map((entry) => entry.name)).toEqual(['mistral'])
    expect(resolved.modelOverride).toBe('mistral-small-2409')
  })

  it('lets a "provider:model" id var override GUARDRAIL_PROVIDER', () => {
    process.env.OPENAI_API_KEY = 'x'
    process.env.MISTRAL_API_KEY = 'x'

    const resolved = resolveChainForCall('openai:gpt-4o-mini', 'mistral')

    expect(resolved.entries.map((entry) => entry.name)).toEqual(['openai'])
    expect(resolved.modelOverride).toBe('gpt-4o-mini')
  })
})
