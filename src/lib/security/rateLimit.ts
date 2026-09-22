import { createHash } from 'node:crypto'
import { makeRateStore } from '@/lib/security/rateStore'

// Per-caller request limiting, backed by a shared counter store (Upstash Redis
// over HTTP, or an in-memory map for local dev; see rateStore.ts). The store
// holds only integer counters keyed by a salted hash of the caller's IP, each
// with a short time-to-live.

interface RateLimitOptions {
  maxRequests: number
  windowMs: number
}

interface RateLimitResult {
  isAllowed: boolean
  retryAfterSeconds: number
}

const store = makeRateStore()

export const checkRateLimit = async (
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> => {
  const ttlSeconds = Math.ceil(options.windowMs / 1000)
  const count = await store.incr(`rl:${key}`, ttlSeconds)
  if (count > options.maxRequests) {
    return { isAllowed: false, retryAfterSeconds: ttlSeconds }
  }
  return { isAllowed: true, retryAfterSeconds: 0 }
}

// Per-caller strike counter. noteAbuse is called on every refusal (a guardrail
// block). Once a caller crosses the threshold within the hour, checkAbuse
// blocks all their requests until the counter expires.
const ABUSE_TTL_SECONDS = 3600
const DEFAULT_ABUSE_THRESHOLD = 5

export const noteAbuse = async (id: string): Promise<void> => {
  await store.incr(`abuse:${id}`, ABUSE_TTL_SECONDS)
}

export const isAbusiveCaller = async (id: string): Promise<boolean> => {
  const threshold =
    Number(process.env.ABUSE_BLOCK_THRESHOLD) || DEFAULT_ABUSE_THRESHOLD
  const count = await store.get(`abuse:${id}`)
  return count !== null && count >= threshold
}

// The IP the hosting platform reports. cf-connecting-ip is set by Cloudflare
// at its own edge; the forwarded headers are a fallback for local dev and any
// other proxy in front of the app. All of these can be spoofed when the app
// runs with no proxy in front, which is why this must not be used as an
// identity outside a trusted host.
export const getClientIp = (request: Request): string => {
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp.trim()
  }
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }
  return 'unknown'
}

// A salted one-way hash of the IP, so the store never holds a raw address.
export const hashClientId = (ip: string): string => {
  const salt = process.env.RATE_LIMIT_SALT ?? 'doc-reviewer-dev-salt'
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}
