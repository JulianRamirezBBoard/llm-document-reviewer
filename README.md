# LLM Document Reviewer

Paste a document, or upload a PDF, and get back structured fields an AI pulled
out of it (an invoice's total, a resume's job history, a contract's dates).
Every field starts as an AI draft. You review and edit it before it counts as
confirmed.

After extraction you see the source document and the extracted fields side by
side. Each field is linked to the passage it came from: focus a field and that
passage lights up in the source. You can edit the source text or any field
value, confirm fields one at a time or all at once, and undo a bulk confirm.

## Tech stack

- Next.js 16 (App Router, Turbopack) + React 19
- TypeScript 5, strict mode
- Tailwind CSS 4, inline utility classes
- Tiptap 3 (`@tiptap/react`, `@tiptap/starter-kit`), the rich-text editor for
  the source document, with a custom extension that draws the field-to-passage
  highlights as ProseMirror decorations
- Zod, to check every piece of data crossing a boundary (the AI's output, the
  API requests)
- The `ai` SDK, for the AI calls, behind a small provider chain that can run
  on Anthropic, OpenAI, Mistral, or OpenRouter (or any OpenAI-compatible
  endpoint) with automatic fallback between them
- `pdfjs-dist`, to read text out of an uploaded PDF on the server
- Jest + React Testing Library, for tests

## How the review works

1. **Add a document.** Paste text into the editor, or choose a PDF. The PDF's
   text is pulled out on the server, then treated the same as pasted text.
2. **Extraction.** The text goes to the AI, which returns a set of
   `{ label, value }` fields suited to that document. Every field starts marked
   **Draft (suggested by AI)**.
3. **Side-by-side review.** The source document sits next to the fields table.
   For each field whose value appears in the source, that passage is
   highlighted. A field whose value is not in the source is marked
   **Not found in source** instead.
4. **Confirm.** Editing a field's value marks it **Confirmed by you**.
   "Confirm all" marks every remaining draft at once; a short-lived notice lets
   you undo that.
5. **Keeping highlights in step.** The first time you edit a field value or the
   source text, a prompt asks how to handle the highlights when things drift:
   update them every time (and stop asking), update once, or leave them.
   Whatever you pick is remembered **for this browser session only** and can be
   changed any time from **Settings**.
6. **Persistence.** The document text, the fields, and each field's
   draft/confirmed state are saved to the browser's local storage, so a refresh
   restores the same screen. The highlight-handling choice is the one thing
   kept in session storage instead, so it never carries over to a future visit.

On a narrow screen the two panes stack, the fields table becomes a stacked
list so no value is clipped, and a dismissible note points out that the app is
easier to use on a wider screen. Out of scope for this stage: the AI review
queue and file export.

## Getting started

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env.local`, then add one provider's API key:
   ```
   ANTHROPIC_API_KEY=your-key-here
   ```
   Any single provider key is enough to run the app. See
   [Model providers](#model-providers) below for the others.
3. Start the dev server:
   ```
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000).

## Testing locally without an API key

Want to try the full app, exactly as a real user would, without setting up an
Anthropic API key? Set one extra variable in `.env.local`:

```
LLM_BACKEND=claude-cli
```

With this set, both AI calls (the safety check and the extraction itself) run
through your own installed [Claude Code](https://claude.com/claude-code) CLI
instead of the Anthropic API. It uses your own Claude Code login, so no
`ANTHROPIC_API_KEY` is needed at all. Everything else about the app works the
same: same routes, same guardrails, same rate limits, same UI.

Requirements:

- The `claude` CLI must be installed and on your `PATH`.
- You must already be logged in (`claude` works from your terminal on its
  own).

This mode calls the real Claude Code CLI for every request, so it does spend
from your own Claude usage, the same as using Claude Code normally. Leave
`LLM_BACKEND` unset (the default) for a real deployment — it should only ever
run against the Anthropic API in production.

## Model providers

Both AI calls (the safety check and the extraction) go through one small
module, `src/lib/extraction/generateStructuredOutput.ts`, that never hardcodes
a vendor. It builds an ordered **fallback chain** from whichever provider keys
are set:

| Provider   | Key                  | Optional model override |
| ---------- | -------------------- | ----------------------- |
| Anthropic  | `ANTHROPIC_API_KEY`  | `ANTHROPIC_MODEL`       |
| OpenAI     | `OPENAI_API_KEY`     | `OPENAI_MODEL`          |
| Mistral    | `MISTRAL_API_KEY`    | `MISTRAL_MODEL`         |
| OpenRouter | `OPENROUTER_API_KEY` | `OPENROUTER_MODEL`      |

Set just one to run the app on a single provider. Set more than one and a
request tries each in order, moving to the next on a network error, timeout,
rate limit, auth failure, or invalid output, so one provider having a bad day
does not take the app down. `LLM_PROVIDER_ORDER` (for example
`anthropic,openai,mistral`) picks the order; unset, it is every provider with a
key, Anthropic first.

OpenRouter (and any other OpenAI-shaped endpoint, including a self-hosted one)
goes through the first-party `@ai-sdk/openai-compatible` package, not a
community OpenRouter package. Point `OPENROUTER_BASE_URL` at a different host
to use that adapter for something other than OpenRouter.

`EXTRACTION_MODEL_ID` and `GUARDRAIL_MODEL_ID` can pin one call to a specific
provider and model with a `provider:model` value (for example
`openai:gpt-5`), or just override the model on whichever provider ends up
handling that call if you leave off the provider prefix.

### Running the safety check on a separate provider

Set `GUARDRAIL_PROVIDER` (a bare provider name, e.g. `mistral`) to send only
the safety check to that provider, with no fallback for that call. Extraction
keeps using the normal chain. This is worth doing if you would rather any
abuse flag from the model that reads raw, occasionally hostile input land on a
provider account you treat as disposable, and keep your main extraction
provider account untouched.

## Scripts

| Command              | What it does                              |
| -------------------- | ----------------------------------------- |
| `npm run dev`        | Start the app in development mode         |
| `npm run build`      | Build the app for production              |
| `npm start`          | Run a production build                    |
| `npm test`           | Run the test suite (Jest)                 |
| `npm run test:watch` | Run tests and re-run them on file changes |
| `npm run typecheck`  | Check types with TypeScript               |
| `npm run lint`       | Check code style and common mistakes      |
| `npm run format`     | Auto-format the code with Prettier        |

## Security guardrails

Both API routes (`/api/extract-fields` and `/api/extract-text`) are public and
have no login. Each request passes through server-side checks before it does
any real work.

### Jailbreak and abuse defence, three layers

`/api/extract-fields` runs submitted text through three checks before it
becomes a trusted extraction result:

1. **A local pre-filter.** Plain string and regex checks for common jailbreak
   and prompt-injection phrasing (`src/lib/extraction/promptInjectionFilter.ts`),
   run in memory with no API call. Blocks the clearest attempts for free,
   without sending them to any model.
2. **A model guardrail.** A small, cheap model reads whatever gets past layer 1
   and decides if it is an ordinary document, or an attempt to make the AI do
   something else (write harmful content, reveal hidden instructions, ignore
   its task). A flagged request never reaches the main extraction model. See
   [Running the safety check on a separate provider](#running-the-safety-check-on-a-separate-provider)
   to isolate this call from your main provider account.
3. **An output-side check.** After extraction, a cheap local test on the
   result: if a field value reads like a refusal, a paragraph of prose, or a
   quote of the system prompt, the result is dropped instead of shown, since
   that shape means the model likely followed an injection instead of
   extracting data.

The extraction prompt also treats document text only as data to read, never as
commands to follow, and wraps it in a `<document_text>` tag so a document
cannot pass a line off as a new instruction.

### Other checks

- **A same-site check.** Each request's `Origin` must match the site it was
  sent to. This stops another website from silently triggering these paid
  endpoints through a visitor's own browser.
- **A document size cap.** Pasted or extracted text over 50,000 characters is
  rejected before it reaches any AI call.
- **Per-visitor rate limits and an abuse counter.** Each visitor gets a capped
  number of requests per 10-minute window. Every time a request is blocked by
  the guardrail, that visitor gets a strike; enough strikes within an hour
  (`ABUSE_BLOCK_THRESHOLD`, default 5) and every further request from them is
  refused until the strikes expire.

### The rate limiter's store

`src/lib/security/rateLimit.ts` identifies a caller by the IP address the
hosting platform reports, run through a salted one-way hash
(`RATE_LIMIT_SALT`) before it is ever used as a key, so the store never holds a
raw IP. With `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` set, those
counters live in Upstash Redis, called over its plain HTTP API, the same code
path on every host. Without them, the app falls back to an in-memory map that
only holds within one warm server instance: fine for local development, not
for a real deployment with more than one instance.

Either way, the store holds nothing but a handful of short-lived integers per
visitor (a request count for the last minute, one for the last hour, and an
abuse-strike count), each expiring on its own within an hour. No document
text, no field values, and no other user data ever reaches it.

## Deploy

The app's Next.js shape (App Router, Node-runtime API routes) is unchanged for
deployment; there is no separate build for a different architecture.

- **Cloudflare Workers.** Adapted with
  [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). Config lives
  in `open-next.config.ts` and `wrangler.jsonc`.
  1. Set provider keys and the Upstash and salt variables as Worker secrets:
     `npx wrangler secret put ANTHROPIC_API_KEY` (repeat for each variable you
     need from `.env.example`).
  2. Build and preview locally: `npm run preview:cf`.
  3. Deploy: `npm run deploy`.

  Creating a symlink is part of that build. On Windows, this needs either
  Developer Mode turned on or an elevated shell; it works without either on
  macOS, Linux, WSL, and CI.

The `claude-cli` backend cannot run on this host (no child processes in a
Worker); the local-only flag in `src/lib/extraction/localBackendFlag.ts` and
the production check already stop it from being reachable there.
