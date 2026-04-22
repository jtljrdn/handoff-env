import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { CliError } from './errors'

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000

export interface DeviceFlowResult {
  token: string
}

export async function runDeviceFlow(apiUrl: string): Promise<DeviceFlowResult> {
  const state = randomBytes(24).toString('base64url')

  const { port, waitForCallback, close } = await startCallbackServer(state)

  const authorizeUrl = buildAuthorizeUrl(apiUrl, port, state)
  openInBrowser(authorizeUrl)
  process.stdout.write(`\nOpen this URL in your browser if it did not open automatically:\n  ${authorizeUrl}\n\n`)
  process.stdout.write('Waiting for authorization...\n')

  try {
    const token = await waitForCallback()
    return { token }
  } finally {
    close()
  }
}

function buildAuthorizeUrl(apiUrl: string, port: number, state: string): string {
  const base = apiUrl.replace(/\/$/, '')
  const params = new URLSearchParams({ port: String(port), state })
  return `${base}/cli/authorize?${params.toString()}`
}

interface CallbackServer {
  port: number
  waitForCallback(): Promise<string>
  close(): void
}

async function startCallbackServer(expectedState: string): Promise<CallbackServer> {
  let resolveToken: ((token: string) => void) | null = null
  let rejectToken: ((err: Error) => void) | null = null

  const server = createServer((req, res) => {
    handleRequest(req, res, expectedState, (err, token) => {
      if (err) rejectToken?.(err)
      else if (token) resolveToken?.(token)
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new CliError('Failed to allocate a local port for login.', 1)
  }
  const port = address.port

  const tokenPromise = new Promise<string>((resolve, reject) => {
    resolveToken = resolve
    rejectToken = reject
  })

  const timeout = setTimeout(() => {
    rejectToken?.(
      new CliError(
        'Login timed out. Run `handoff login` again to retry.',
        1,
      ),
    )
  }, LOGIN_TIMEOUT_MS)

  return {
    port,
    waitForCallback: () => tokenPromise,
    close: () => {
      clearTimeout(timeout)
      server.close()
    },
  }
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  expectedState: string,
  cb: (err: Error | null, token: string | null) => void,
): void {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.url !== '/callback' || req.method !== 'POST') {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
    return
  }

  const chunks: Buffer[] = []
  req.on('data', (chunk: Buffer) => chunks.push(chunk))
  req.on('end', () => {
    try {
      const raw = Buffer.concat(chunks).toString('utf8')
      const parsed = JSON.parse(raw) as { token?: unknown; state?: unknown }
      if (typeof parsed.token !== 'string' || typeof parsed.state !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid payload' }))
        return
      }
      if (parsed.state !== expectedState) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'State mismatch' }))
        cb(new CliError('Login failed: state mismatch.', 1), null)
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
      cb(null, parsed.token)
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid JSON' }))
      cb(err instanceof Error ? err : new Error(String(err)), null)
    }
  })
}

function openInBrowser(url: string): void {
  const platform = process.platform
  let cmd: string
  let args: string[]
  if (platform === 'darwin') {
    cmd = 'open'
    args = [url]
  } else if (platform === 'win32') {
    cmd = 'cmd'
    args = ['/c', 'start', '""', url]
  } else {
    cmd = 'xdg-open'
    args = [url]
  }
  try {
    const child = spawn(cmd, args, {
      stdio: 'ignore',
      detached: true,
    })
    child.unref()
    child.on('error', () => {
      // Silently ignore; the URL is also printed to stdout.
    })
  } catch {
    // Silently ignore; the URL is also printed to stdout.
  }
}
