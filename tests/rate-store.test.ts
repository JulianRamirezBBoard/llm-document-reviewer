/**
 * @jest-environment node
 */
import { makeRateStore, resetRateStoreForTests } from '@/lib/security/rateStore'

const UPSTASH_ENV = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']

describe('makeRateStore', () => {
  const realFetch = global.fetch

  afterEach(() => {
    for (const key of UPSTASH_ENV) {
      delete process.env[key]
    }
    resetRateStoreForTests()
    global.fetch = realFetch
    jest.restoreAllMocks()
  })

  describe('in-memory fallback (no Upstash config)', () => {
    it('counts up per key and expires after the ttl', async () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000)
      const store = makeRateStore()

      expect(await store.incr('a', 60)).toBe(1)
      expect(await store.incr('a', 60)).toBe(2)
      expect(await store.get('a')).toBe(2)
      expect(await store.get('b')).toBeNull()

      nowSpy.mockReturnValue(1_000 + 61_000)
      expect(await store.get('a')).toBeNull()
      expect(await store.incr('a', 60)).toBe(1)
    })
  })

  describe('Upstash over HTTP (config present)', () => {
    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
      resetRateStoreForTests()
    })

    it('sends INCR then EXPIRE on the first write, and reads with GET', async () => {
      const calls: unknown[][] = []
      global.fetch = jest.fn(async (_url, init) => {
        const args = JSON.parse(String((init as RequestInit).body))
        calls.push(args)
        const command = args[0]
        const result = command === 'INCR' ? 1 : command === 'GET' ? '3' : 'OK'
        return new Response(JSON.stringify({ result }), { status: 200 })
      }) as unknown as typeof fetch

      const store = makeRateStore()

      expect(await store.incr('rl:x', 60)).toBe(1)
      expect(calls).toEqual([
        ['INCR', 'rl:x'],
        ['EXPIRE', 'rl:x', 60],
      ])

      expect(await store.get('rl:x')).toBe(3)
      expect(calls[2]).toEqual(['GET', 'rl:x'])
    })

    it('does not send EXPIRE when the counter is already above 1', async () => {
      const calls: unknown[][] = []
      global.fetch = jest.fn(async (_url, init) => {
        calls.push(JSON.parse(String((init as RequestInit).body)))
        return new Response(JSON.stringify({ result: 4 }), { status: 200 })
      }) as unknown as typeof fetch

      const store = makeRateStore()
      await store.incr('rl:y', 60)

      expect(calls).toEqual([['INCR', 'rl:y']])
    })
  })
})
