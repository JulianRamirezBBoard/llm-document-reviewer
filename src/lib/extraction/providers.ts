import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createMistral } from '@ai-sdk/mistral'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'

// The one place a vendor is named. Both AI calls (the guardrail check and the
// extraction) run through a chain built here. Each provider joins only when its
// API key is set. Order comes from LLM_PROVIDER_ORDER, else every provider that
// has a key, Anthropic first.

export type LlmRole = 'guardrail' | 'extraction'

export const PROVIDER_NAMES = [
  'anthropic',
  'openai',
  'mistral',
  'openrouter',
] as const
export type ProviderName = (typeof PROVIDER_NAMES)[number]

export const isProviderName = (value: string): value is ProviderName =>
  (PROVIDER_NAMES as readonly string[]).includes(value)

export interface ProviderEntry {
  name: ProviderName
  // A ready LanguageModel for this role. `modelOverride` wins over the
  // per-provider env var and the built-in default.
  model: (role: LlmRole, modelOverride?: string) => LanguageModel
}

// Guardrail wants a small cheap model; extraction wants a capable one. A
// deployer overrides either with <PROVIDER>_MODEL.
const DEFAULT_MODELS: Record<ProviderName, Record<LlmRole, string>> = {
  anthropic: {
    guardrail: 'claude-haiku-4-5-20251001',
    extraction: 'claude-sonnet-4-5',
  },
  openai: {
    guardrail: 'gpt-4o-mini',
    extraction: 'gpt-4o',
  },
  mistral: {
    guardrail: 'mistral-small-latest',
    extraction: 'mistral-large-latest',
  },
  openrouter: {
    guardrail: 'openai/gpt-4o-mini',
    extraction: 'openai/gpt-4o',
  },
}

const MODEL_ENV_VAR: Record<ProviderName, string> = {
  anthropic: 'ANTHROPIC_MODEL',
  openai: 'OPENAI_MODEL',
  mistral: 'MISTRAL_MODEL',
  openrouter: 'OPENROUTER_MODEL',
}

const resolveModelId = (
  name: ProviderName,
  role: LlmRole,
  modelOverride?: string,
): string => {
  if (modelOverride) {
    return modelOverride
  }
  const fromEnv = process.env[MODEL_ENV_VAR[name]]
  if (fromEnv) {
    return fromEnv
  }
  return DEFAULT_MODELS[name][role]
}

const buildEntry = (name: ProviderName): ProviderEntry | null => {
  switch (name) {
    case 'anthropic': {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        return null
      }
      const provider = createAnthropic({ apiKey })
      return {
        name,
        model: (role, override) =>
          provider(resolveModelId(name, role, override)),
      }
    }
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        return null
      }
      const provider = createOpenAI({ apiKey })
      return {
        name,
        model: (role, override) =>
          provider(resolveModelId(name, role, override)),
      }
    }
    case 'mistral': {
      const apiKey = process.env.MISTRAL_API_KEY
      if (!apiKey) {
        return null
      }
      const provider = createMistral({ apiKey })
      return {
        name,
        model: (role, override) =>
          provider(resolveModelId(name, role, override)),
      }
    }
    case 'openrouter': {
      const apiKey = process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        return null
      }
      const provider = createOpenAICompatible({
        name: 'openrouter',
        apiKey,
        baseURL:
          process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
      })
      return {
        name,
        model: (role, override) =>
          provider(resolveModelId(name, role, override)),
      }
    }
  }
}

const resolveOrder = (): ProviderName[] => {
  const configured = process.env.LLM_PROVIDER_ORDER
  if (!configured) {
    return [...PROVIDER_NAMES]
  }
  const named = configured
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(isProviderName)
  return named.length > 0 ? named : [...PROVIDER_NAMES]
}

// The providers to try, in order. A provider named in LLM_PROVIDER_ORDER but
// missing its key is skipped, not an error.
export const buildProviderChain = (): ProviderEntry[] => {
  const seen = new Set<ProviderName>()
  const chain: ProviderEntry[] = []
  for (const name of resolveOrder()) {
    if (seen.has(name)) {
      continue
    }
    seen.add(name)
    const entry = buildEntry(name)
    if (entry) {
      chain.push(entry)
    }
  }
  return chain
}

// A "provider:model" value pins one provider for that call. A bare model id
// (no colon) or an unset value returns null.
export const parseProviderPin = (
  value: string | undefined,
): { name: ProviderName; model: string } | null => {
  if (!value) {
    return null
  }
  const separator = value.indexOf(':')
  if (separator <= 0) {
    return null
  }
  const name = value.slice(0, separator).trim().toLowerCase()
  const model = value.slice(separator + 1).trim()
  if (!isProviderName(name) || model.length === 0) {
    return null
  }
  return { name, model }
}

// Build the chain for one call. Precedence:
//   1. "provider:model" in the id var pins one provider and its model.
//   2. providerPinName (from GUARDRAIL_PROVIDER) pins one provider; a bare id
//      var, if any, is its model. No fallback: a safety gate fails closed.
//   3. otherwise the full chain, with a bare id var as a model override.
export interface ResolvedChain {
  entries: ProviderEntry[]
  modelOverride?: string
}

export const resolveChainForCall = (
  idVar: string | undefined,
  providerPinName?: string,
): ResolvedChain => {
  const pin = parseProviderPin(idVar)
  if (pin) {
    const entry = buildEntry(pin.name)
    return { entries: entry ? [entry] : [], modelOverride: pin.model }
  }

  const modelOverride = idVar && idVar.length > 0 ? idVar : undefined

  if (providerPinName) {
    const name = providerPinName.trim().toLowerCase()
    if (isProviderName(name)) {
      const entry = buildEntry(name)
      return { entries: entry ? [entry] : [], modelOverride }
    }
  }

  return { entries: buildProviderChain(), modelOverride }
}
