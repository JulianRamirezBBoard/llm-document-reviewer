import { EventEmitter } from 'node:events'
import { spawn, type ChildProcess } from 'node:child_process'
import { runClaudeCli } from '@/lib/extraction/claudeCliClient'

jest.mock('node:child_process', () => ({ spawn: jest.fn() }))

const mockedSpawn = jest.mocked(spawn)

// A minimal stand-in for Node's ChildProcess. The real type has many
// properties this client never touches; this test only needs the ones it
// does (stdout/stderr/stdin/kill), so it is deliberately loosely typed
// rather than implementing the full ambient interface.
const buildFakeChild = () => {
  const child = new EventEmitter() as unknown as ChildProcess
  Object.assign(child, {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    stdin: { write: jest.fn(), end: jest.fn() },
    kill: jest.fn(),
  })
  return child
}

const emitCliResult = (
  child: ChildProcess,
  envelope: Record<string, unknown>,
) => {
  child.stdout?.emit('data', Buffer.from(JSON.stringify(envelope)))
  child.emit('close', 0)
}

describe('runClaudeCli', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('spawns the CLI with tool access disabled and no interactive prompts', async () => {
    const child = buildFakeChild()
    mockedSpawn.mockReturnValue(child)

    const resultPromise = runClaudeCli({
      systemPrompt: 'system',
      prompt: 'prompt',
      jsonSchema: { type: 'object' },
      modelId: 'claude-haiku-4-5-20251001',
    })

    // Flush microtasks so spawn() has run before we inspect its call.
    await Promise.resolve()

    const [command, args] = mockedSpawn.mock.calls[0]
    expect(command).toBe('claude')
    expect(args).toEqual(
      expect.arrayContaining([
        '--safe-mode',
        '--tools=',
        '--permission-prompts',
        'none',
      ]),
    )

    emitCliResult(child, {
      is_error: false,
      result: '{}',
      structured_output: { ok: true },
    })

    await expect(resultPromise).resolves.toEqual({ ok: true })
  })

  it('never runs with a shell', async () => {
    const child = buildFakeChild()
    mockedSpawn.mockReturnValue(child)

    const resultPromise = runClaudeCli({
      systemPrompt: 'system',
      prompt: 'prompt',
      jsonSchema: {},
      modelId: 'claude-sonnet-4-5',
    })
    await Promise.resolve()

    const [, , options] = mockedSpawn.mock.calls[0]
    expect(options).not.toHaveProperty('shell', true)

    emitCliResult(child, {
      is_error: false,
      result: '{}',
      structured_output: {},
    })
    await resultPromise
  })

  it('rejects when the CLI process cannot start', async () => {
    const child = buildFakeChild()
    mockedSpawn.mockReturnValue(child)

    const resultPromise = runClaudeCli({
      systemPrompt: 'system',
      prompt: 'prompt',
      jsonSchema: {},
      modelId: 'claude-sonnet-4-5',
    })
    await Promise.resolve()

    child.emit('error', new Error('ENOENT'))

    await expect(resultPromise).rejects.toThrow(
      'Could not start the claude CLI',
    )
  })

  it('rejects when the CLI reports an error result', async () => {
    const child = buildFakeChild()
    mockedSpawn.mockReturnValue(child)

    const resultPromise = runClaudeCli({
      systemPrompt: 'system',
      prompt: 'prompt',
      jsonSchema: {},
      modelId: 'claude-sonnet-4-5',
    })
    await Promise.resolve()

    emitCliResult(child, {
      is_error: true,
      result: 'something went wrong',
      structured_output: null,
    })

    await expect(resultPromise).rejects.toThrow('something went wrong')
  })
})
