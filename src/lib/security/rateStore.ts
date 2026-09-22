// A tiny shared-counter store for the rate limiter and the abuse counter. It
// uses Upstash Redis over its plain HTTP API when configured, which works from
// a Cloudflare Worker since it is just a fetch call. Without Upstash it falls
// back to an in-memory map, which only holds within one warm instance and is
// meant for local development.
//
// It never stores document text or field values, only short-lived integer
// counters keyed by a salted hash of the caller's IP.

export interface RateStore {
  // Increment a counter. On the first write it also sets the time-to-live.
  // Returns the new count.
  incr(key: string, ttlSeconds: number): Promise<number>
  // Read a counter without changing it. Returns null when it is absent.
  get(key: string): Promise<number | null>
}

const redisCommand = async (
  baseUrl: string,
  token: string,
  args: (string | number)[],
): Promise<unknown> => {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  })
  if (!response.ok) {
    throw new Error(`Upstash command failed with status ${response.status}`)
  }
  const data = (await response.json()) as { result?: unknown }
  return data.result
}

const makeUpstashStore = (baseUrl: string, token: string): RateStore => ({
  async incr(key, ttlSeconds) {
    const count = Number(await redisCommand(baseUrl, token, ['INCR', key]))
    if (count === 1) {
      await redisCommand(baseUrl, token, ['EXPIRE', key, ttlSeconds])
    }
    return count
  },
  async get(key) {
    const value = await redisCommand(baseUrl, token, ['GET', key])
    return value == null ? null : Number(value)
  },
})

interface MemoryEntry {
  count: number
  expiresAtMs: number
}

// Drop expired keys once the map grows past this, so a long-lived instance
// serving many distinct callers does not leak memory.
const MEMORY_SWEEP_AT = 500

const makeMemoryStore = (): RateStore => {
  const entries = new Map<string, MemoryEntry>()

  const sweep = (nowMs: number) => {
    if (entries.size < MEMORY_SWEEP_AT) {
      return
    }
    for (const [key, entry] of entries) {
      if (entry.expiresAtMs <= nowMs) {
        entries.delete(key)
      }
    }
  }

  return {
    async incr(key, ttlSeconds) {
      const now = Date.now()
      sweep(now)
      const entry = entries.get(key)
      if (!entry || entry.expiresAtMs <= now) {
        entries.set(key, { count: 1, expiresAtMs: now + ttlSeconds * 1000 })
        return 1
      }
      entry.count += 1
      return entry.count
    },
    async get(key) {
      const entry = entries.get(key)
      if (!entry || entry.expiresAtMs <= Date.now()) {
        return null
      }
      return entry.count
    },
  }
}

let cached: RateStore | null = null

export const makeRateStore = (): RateStore => {
  if (cached) {
    return cached
  }
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  cached = url && token ? makeUpstashStore(url, token) : makeMemoryStore()
  return cached
}

// Test seam: drop the cached store so a test can re-pick it up with different
// env vars.
export const resetRateStoreForTests = (): void => {
  cached = null
}
