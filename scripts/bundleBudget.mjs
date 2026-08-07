/**
 * A size budget for the built bundle, checked as a build step.
 *
 * Vite already warns above 500 kB per chunk, but a warning in a build log is
 * not a gate: the app crossed that line and stayed there, and the warning was
 * simply read past every time. These numbers fail the build instead.
 *
 * Budgets are in gzipped bytes for what users pay on the wire, and in raw bytes
 * for what their device has to parse — a distinction that matters on the phones
 * this app is most likely to be opened on.
 *
 * Raising a number is allowed. Doing it without a sentence saying what got
 * bigger and why is what this file exists to prevent.
 */

import { gzipSync } from 'node:zlib'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const KB = 1024

export const BUDGETS = {
  /**
   * The entry chunk: React, Redux, the router, i18n and the splash screen.
   * Everything else is behind a route-level dynamic import (DIA-134).
   */
  entryGzip: 130 * KB,

  /**
   * Per chunk, matching Vite's own warning threshold so the two never disagree.
   * The heaviest today is the Rive runtime behind the avatars, at ~168 kB.
   */
  chunkRaw: 500 * KB,

  /**
   * Everything a candidate downloads if they walk through every screen —
   * excluding the on-device engine, which no amount of walking around fetches.
   */
  totalGzip: 260 * KB,

  /**
   * MediaPipe's LLM runtime: the glue bundle plus the loader for its WASM.
   *
   * Budgeted apart from everything else because it is paid for on a different
   * occasion. Nothing here loads until someone asks for an on-device answer,
   * and when they do the JS is a rounding error against 27 MB of WebAssembly
   * and half a gigabyte of weights behind it. Folding it into `totalGzip` would
   * have meant raising that number by half, after which it would no longer
   * catch anything going wrong on the screens every candidate actually sees.
   */
  engineGzip: 110 * KB,
}

/** Chunks that only exist once the on-device engine is asked for. */
const ENGINE_CHUNK = /genai/

/** @returns {string[]} one message per breach; empty means the build fits. */
export function checkBudgets(files, budgets = BUDGETS) {
  const failures = []
  const entry = files.find((file) => file.isEntry)

  if (!entry) {
    // Not a size problem — it means index.html stopped pointing at a module
    // script and this check has been measuring nothing.
    return ['no entry chunk found in dist/index.html — the budget check is not looking at the real build']
  }

  if (entry.gzip > budgets.entryGzip) {
    failures.push(over('entry chunk', entry.name, entry.gzip, budgets.entryGzip))
  }

  for (const file of files) {
    if (file.raw > budgets.chunkRaw) {
      failures.push(over('chunk', file.name, file.raw, budgets.chunkRaw, 'raw'))
    }
  }

  const engine = files.filter((file) => ENGINE_CHUNK.test(file.name))
  const rest = files.filter((file) => !ENGINE_CHUNK.test(file.name))

  const total = rest.reduce((sum, file) => sum + file.gzip, 0)
  if (total > budgets.totalGzip) {
    failures.push(over('all chunks together', `${rest.length} files`, total, budgets.totalGzip))
  }

  const engineTotal = engine.reduce((sum, file) => sum + file.gzip, 0)
  if (engineTotal > budgets.engineGzip) {
    failures.push(over('on-device engine', `${engine.length} files`, engineTotal, budgets.engineGzip))
  }

  return failures
}

function over(what, name, actual, budget, unit = 'gzipped') {
  const kb = (bytes) => `${(bytes / KB).toFixed(1)} kB`
  return `${what} (${name}) is ${kb(actual)} ${unit}, over the ${kb(budget)} budget by ${kb(actual - budget)}`
}

/** Measures `dist/`, taking the entry chunk from the module script in index.html. */
export function measureBuild(dist) {
  const html = readFileSync(join(dist, 'index.html'), 'utf8')
  const entryName = /<script[^>]+type="module"[^>]+src="[^"]*\/assets\/([^"]+\.js)"/.exec(html)?.[1]

  return readdirSync(join(dist, 'assets'))
    .filter((name) => name.endsWith('.js'))
    .map((name) => {
      const bytes = readFileSync(join(dist, 'assets', name))
      return { name, raw: bytes.byteLength, gzip: gzipSync(bytes).byteLength, isEntry: name === entryName }
    })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = measureBuild('dist')
  const failures = checkBudgets(files)

  for (const file of [...files].sort((a, b) => b.gzip - a.gzip)) {
    const mark = file.isEntry ? 'entry' : '     '
    console.log(`${mark} ${(file.gzip / KB).toFixed(1).padStart(7)} kB gz  ${file.name}`)
  }

  for (const failure of failures) console.error(`FAIL:  ${failure}`)

  if (failures.length > 0) {
    console.error('Adjust the code, or raise the budget in scripts/bundleBudget.mjs and say why.')
    process.exit(1)
  }

  const engine = files.filter((file) => ENGINE_CHUNK.test(file.name)).reduce((sum, file) => sum + file.gzip, 0)
  const total = files.reduce((sum, file) => sum + file.gzip, 0) - engine
  console.log(
    `bundle budget passed — ${files.length} chunks, ${(total / KB).toFixed(1)} kB gzipped in total, ` +
      `plus ${(engine / KB).toFixed(1)} kB fetched only for an on-device answer.`,
  )
}
