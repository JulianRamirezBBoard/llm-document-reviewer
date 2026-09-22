import { spawn } from 'node:child_process'

// Runs a single, non-interactive structured-output request through the
// installed Claude Code CLI, instead of the Anthropic API. Local testing
// only: it bills to the machine's own Claude Code login (a subscription),
// not an ANTHROPIC_API_KEY, so a developer can try the full app without one.
// See LLM_BACKEND in generateStructuredOutput.ts.

const CLAUDE_CLI_TIMEOUT_MS = 60_000

export class ClaudeCliError extends Error {}

interface ClaudeCliRequest {
  systemPrompt: string
  prompt: string
  jsonSchema: unknown
  modelId: string
}

// Field names match the CLI's actual --output-format json envelope, which
// uses snake_case (confirmed against a live run, not assumed).
interface ClaudeCliResultEnvelope {
  is_error: boolean
  result: string
  structured_output: unknown
}

const isClaudeCliResultEnvelope = (
  value: unknown,
): value is ClaudeCliResultEnvelope => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return (
    'is_error' in value && 'structured_output' in value && 'result' in value
  )
}

// The CLI accepts either a short alias ("sonnet", "haiku", "opus") or a full
// model name. Our internal model ids are tuned for the direct Anthropic API
// and do not always match a CLI-recognized name, so map to the closest alias
// instead of passing the id through as-is.
const toClaudeCliModelAlias = (modelId: string): string => {
  if (modelId.includes('haiku')) {
    return 'haiku'
  }
  if (modelId.includes('opus')) {
    return 'opus'
  }
  return 'sonnet'
}

export const runClaudeCli = (request: ClaudeCliRequest): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const args = [
      '-p',
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(request.jsonSchema),
      '--append-system-prompt',
      request.systemPrompt,
      '--model',
      toClaudeCliModelAlias(request.modelId),
      // Skip this repo's own CLAUDE.md, hooks, and skills: they are written
      // for coding tasks in this project, not for a document-extraction call.
      '--safe-mode',
      // No file, shell, or web access needed for a plain text-in, JSON-out call.
      '--tools=',
      '--no-session-persistence',
      '--permission-prompts',
      'none',
    ]

    // No shell: the installed CLI is a real executable, and Node passes each
    // array element through as its own argument without a shell re-parsing
    // (and potentially corrupting) the JSON payloads above.
    const child = spawn('claude', args, { windowsHide: true })

    let stdout = ''
    let stderr = ''

    const timeout = setTimeout(() => {
      child.kill()
      reject(new ClaudeCliError('The claude CLI did not respond in time.'))
    }, CLAUDE_CLI_TIMEOUT_MS)

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })

    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(
        new ClaudeCliError(
          'Could not start the claude CLI. Is it installed and on PATH?',
          {
            cause: error,
          },
        ),
      )
    })

    child.on('close', (exitCode) => {
      clearTimeout(timeout)
      if (exitCode !== 0) {
        reject(
          new ClaudeCliError(
            `claude CLI exited with code ${exitCode}: ${stderr || stdout}`,
          ),
        )
        return
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(stdout)
      } catch (error) {
        reject(
          new ClaudeCliError('The claude CLI did not return valid JSON.', {
            cause: error,
          }),
        )
        return
      }

      if (!isClaudeCliResultEnvelope(parsed)) {
        reject(
          new ClaudeCliError(
            'The claude CLI response had an unexpected shape.',
          ),
        )
        return
      }
      if (parsed.is_error) {
        reject(
          new ClaudeCliError(
            `The claude CLI reported an error: ${parsed.result}`,
          ),
        )
        return
      }
      resolve(parsed.structured_output)
    })

    child.stdin.write(request.prompt)
    child.stdin.end()
  })
