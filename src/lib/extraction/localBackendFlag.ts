// Hard-coded switch for local-only LLM backends. It ships off.
//
// The current provider wiring, and the claude-cli backend in particular, is
// meant for local testing, not a real deployment. A developer who wants to run
// the app locally without an API key flips this to true and does not commit
// that change. Turning it into real configuration is deployment work, not part
// of this flag.
export const ALLOW_LOCAL_ONLY_BACKENDS = false
