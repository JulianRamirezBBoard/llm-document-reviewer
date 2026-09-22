/**
 * @jest-environment node
 */
import {
  checkRateLimit,
  getClientIp,
  hashClientId,
} from '@/lib/security/rateLimit'

describe('checkRateLimit', () => {
  it('allows requests up to the limit', async () => {
    const key = 'allow-up-to-limit'
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await checkRateLimit(key, {
        maxRequests: 3,
        windowMs: 60_000,
      })
      expect(result.isAllowed).toBe(true)
    }
  })

  it('blocks a request once the limit is reached', async () => {
    const key = 'block-over-limit'
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await checkRateLimit(key, { maxRequests: 3, windowMs: 60_000 })
    }

    const result = await checkRateLimit(key, {
      maxRequests: 3,
      windowMs: 60_000,
    })

    expect(result.isAllowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('resets the count once the window has passed', async () => {
    const key = 'reset-after-window'
    const nowSpy = jest.spyOn(Date, 'now')
    try {
      nowSpy.mockReturnValue(1_000)
      await checkRateLimit(key, { maxRequests: 1, windowMs: 1_000 })

      nowSpy.mockReturnValue(5_000)
      const result = await checkRateLimit(key, {
        maxRequests: 1,
        windowMs: 1_000,
      })

      expect(result.isAllowed).toBe(true)
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('tracks separate keys independently', async () => {
    await checkRateLimit('independent-a', { maxRequests: 1, windowMs: 60_000 })
    const resultForOtherKey = await checkRateLimit('independent-b', {
      maxRequests: 1,
      windowMs: 60_000,
    })

    expect(resultForOtherKey.isAllowed).toBe(true)
  })
})

describe('getClientIp', () => {
  it('prefers cf-connecting-ip', () => {
    const request = new Request('http://localhost', {
      headers: {
        'cf-connecting-ip': '198.51.100.7',
        'x-forwarded-for': '203.0.113.5',
      },
    })

    expect(getClientIp(request)).toBe('198.51.100.7')
  })

  it('reads the first address from x-forwarded-for', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.5, 70.41.3.18' },
    })

    expect(getClientIp(request)).toBe('203.0.113.5')
  })

  it('falls back to "unknown" when no address header is present', () => {
    const request = new Request('http://localhost')

    expect(getClientIp(request)).toBe('unknown')
  })
})

describe('hashClientId', () => {
  it('is stable for the same ip and hides the raw address', () => {
    const first = hashClientId('203.0.113.5')
    const second = hashClientId('203.0.113.5')

    expect(first).toBe(second)
    expect(first).not.toContain('203.0.113.5')
    expect(first).toMatch(/^[0-9a-f]{32}$/)
  })

  it('differs for a different ip', () => {
    expect(hashClientId('203.0.113.5')).not.toBe(hashClientId('203.0.113.6'))
  })
})
