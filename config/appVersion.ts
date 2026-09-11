import { readFileSync } from 'node:fs'

/**
 * The version the built site puts in its footer.
 *
 * One source, and it is `package.json`. The alternative — `git describe` — is
 * more precise about which release is deployed, but it needs the tag history,
 * and the Pages workflow checks out with `fetch-depth: 1`. A footer that reads
 * "v" on production and the right number on a developer's machine is worse than
 * no footer at all, so the manifest wins.
 *
 * Read at config time rather than imported, because `vite.config.ts` and
 * `vitest.config.ts` resolve JSON imports under different module settings and
 * this file has to work unchanged in both.
 */
export function appVersion(): string {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version?: string
  }

  // Failing the build beats shipping a footer that says "undefined".
  if (!manifest.version) throw new Error('appVersion: package.json has no "version" field')

  return manifest.version
}
