import { describe, expect, it } from 'vitest'
import { BUDGETS, checkBudgets } from './bundleBudget.mjs'

const KB = 1024

/** A build that fits comfortably, used as the base for each breach below. */
const fitting = [
  { name: 'index-abc.js', raw: 320 * KB, gzip: 104 * KB, isEntry: true },
  { name: 'AvatarTile-def.js', raw: 168 * KB, gzip: 49 * KB, isEntry: false },
]

describe('checkBudgets', () => {
  it('passes a build inside every budget', () => {
    expect(checkBudgets(fitting)).toEqual([])
  })

  it('fails when the entry chunk outgrows its gzipped budget', () => {
    const files = [{ ...fitting[0], gzip: BUDGETS.entryGzip + KB }, fitting[1]]

    const [failure] = checkBudgets(files)
    expect(failure).toContain('entry chunk')
    expect(failure).toContain('over the')
  })

  it('fails on a single oversized chunk, at the same threshold Vite warns on', () => {
    const files = [fitting[0], { ...fitting[1], raw: BUDGETS.chunkRaw + KB }]

    expect(checkBudgets(files)[0]).toContain('AvatarTile-def.js')
  })

  it('fails when the chunks are each fine but add up past the total', () => {
    // The regression a per-chunk limit alone would miss: splitting a bundle in
    // half twice looks like progress and moves nothing off the wire.
    const files = [
      fitting[0],
      ...Array.from({ length: 8 }, (_, index) => ({
        name: `chunk-${index}.js`,
        raw: 60 * KB,
        gzip: 20 * KB,
        isEntry: false,
      })),
    ]

    expect(checkBudgets(files).some((failure) => failure.includes('all chunks together'))).toBe(true)
  })

  it('fails loudly when it cannot find the entry chunk at all', () => {
    // Silent success on an empty measurement is how a budget check quietly
    // stops checking anything.
    const [failure] = checkBudgets(fitting.map((file) => ({ ...file, isEntry: false })))

    expect(failure).toContain('not looking at the real build')
  })
})
