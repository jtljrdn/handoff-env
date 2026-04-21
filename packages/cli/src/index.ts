#!/usr/bin/env node
import { Command } from 'commander'
import { loadAuth } from './lib/config'
import { handleFatal } from './lib/errors'
import {
  diffCommand,
  initCommand,
  loginCommand,
  logoutCommand,
  pullCommand,
  pushCommand,
  runCommand,
  whoamiCommand,
} from './commands'

const VERSION = '0.1.0'

async function resolveApiUrlForErrors(): Promise<string | undefined> {
  const auth = await loadAuth()
  return auth?.apiUrl
}

function wrap<A extends unknown[]>(
  fn: (...args: A) => Promise<void>,
): (...args: A) => Promise<void> {
  return async (...args: A) => {
    try {
      await fn(...args)
    } catch (err) {
      const apiUrl = await resolveApiUrlForErrors().catch(() => undefined)
      handleFatal(err, apiUrl)
    }
  }
}

const program = new Command('handoff')
  .description('Handoff env — CLI for managing environment variables')
  .version(VERSION)
  .enablePositionalOptions()

program
  .command('login')
  .description('Sign in via the browser, or with --token for CI.')
  .option('--token <token>', 'API token (hnd_...) — skips the browser flow')
  .option('--api-url <url>', 'Handoff API base URL')
  .action(wrap((opts) => loginCommand(opts)))

program
  .command('logout')
  .description('Clear the saved auth token.')
  .action(wrap(() => logoutCommand()))

program
  .command('whoami')
  .description('Show the signed-in user, org, and plan.')
  .action(wrap(() => whoamiCommand()))

program
  .command('init')
  .description('Link the current directory to a Handoff project.')
  .option('-p, --project <slug>', 'project slug')
  .option('-e, --env <name>', 'default environment')
  .option('--force', 'overwrite an existing .handoff/config.json')
  .action(wrap((opts) => initCommand(opts)))

program
  .command('pull')
  .description('Download an environment as a .env file.')
  .option('-e, --env <name>', 'environment name (defaults to project default)')
  .option('-o, --out <path>', 'output path (default: .env.<envName>)')
  .option('--force', 'overwrite the output file if it exists')
  .action(wrap((opts) => pullCommand(opts)))

program
  .command('push')
  .description('Upload a .env file to an environment.')
  .option('-e, --env <name>', 'environment name (defaults to project default)')
  .option('-f, --file <path>', 'input path (default: .env.<envName>)')
  .option('-y, --yes', 'skip the confirmation prompt')
  .action(wrap((opts) => pushCommand(opts)))

program
  .command('diff')
  .description('Show the difference between a local .env and the remote environment.')
  .option('-e, --env <name>', 'environment name (defaults to project default)')
  .option('-f, --file <path>', 'local path (default: .env.<envName>)')
  .action(wrap((opts) => diffCommand(opts)))

program
  .command('run')
  .description('Run a command with env vars injected at runtime — no .env written to disk.')
  .argument('<cmd...>', 'command to run, e.g. handoff run -- bun src/server.ts')
  .option('-e, --env <name>', 'environment name (defaults to project default)')
  .option(
    '--no-override',
    'do not overwrite env vars already set in the parent process',
  )
  .allowUnknownOption(true)
  .passThroughOptions(true)
  .action(
    wrap(async (cmd: string[], opts: { env?: string; override?: boolean }) => {
      await runCommand(cmd, opts)
    }),
  )

program.parseAsync().catch((err) => {
  void resolveApiUrlForErrors()
    .catch(() => undefined)
    .then((apiUrl) => handleFatal(err, apiUrl))
})
