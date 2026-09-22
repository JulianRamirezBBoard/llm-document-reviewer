// A lightweight CSRF defense for a public, unauthenticated POST endpoint. A
// normal same-origin request from this app's own frontend always carries an
// Origin header that matches the Host it was sent to. A page on another site
// cannot forge a matching Origin, so this blocks it from silently triggering
// paid AI calls through a visitor's browser. This needs no per-environment
// setup: Origin and Host are both whatever the app is actually being
// accessed as, in local development, a preview deployment, or production.
export const isTrustedOrigin = (request: Request): boolean => {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (!origin || !host) {
    return false
  }
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}
