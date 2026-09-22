/**
 * @jest-environment node
 */
import { isTrustedOrigin } from '@/lib/security/originCheck'

const buildRequest = (headers: Record<string, string>): Request =>
  new Request('http://localhost', { headers })

describe('isTrustedOrigin', () => {
  it('accepts a request whose Origin matches its Host', () => {
    const request = buildRequest({
      Origin: 'https://example.com',
      Host: 'example.com',
    })
    expect(isTrustedOrigin(request)).toBe(true)
  })

  it('matches Origin and Host including a port', () => {
    const request = buildRequest({
      Origin: 'http://localhost:3000',
      Host: 'localhost:3000',
    })
    expect(isTrustedOrigin(request)).toBe(true)
  })

  it('rejects a request whose Origin does not match its Host', () => {
    const request = buildRequest({
      Origin: 'https://attacker.example',
      Host: 'example.com',
    })
    expect(isTrustedOrigin(request)).toBe(false)
  })

  it('rejects a request with no Origin header', () => {
    const request = buildRequest({ Host: 'example.com' })
    expect(isTrustedOrigin(request)).toBe(false)
  })

  it('rejects a request with no Host header', () => {
    const request = buildRequest({ Origin: 'https://example.com' })
    expect(isTrustedOrigin(request)).toBe(false)
  })

  it('rejects a request with a malformed Origin header', () => {
    const request = buildRequest({ Origin: 'not-a-url', Host: 'example.com' })
    expect(isTrustedOrigin(request)).toBe(false)
  })
})
