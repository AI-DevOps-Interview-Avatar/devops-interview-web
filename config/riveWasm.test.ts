import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * A build-time check, which is why it lives beside the build config rather than
 * next to `src/shared/ui/riveRuntime.ts`: it is about which copy of a package
 * npm hands the bundler, not about anything the app does at run time.
 */
describe('@rive-app/canvas resolution', () => {
  const require = createRequire(import.meta.url)
  const version = (path: string) => JSON.parse(readFileSync(path, 'utf8')).version as string

  it('gives our .wasm import and the React wrapper the same installed copy', () => {
    // `riveRuntime.ts` imports the binary from `@rive-app/canvas`, while
    // `useRive` comes from `@rive-app/react-canvas`, which depends on an exact
    // version of it. If our range in package.json ever stops matching that pin,
    // npm nests a second copy — and the app then instantiates one version's
    // WebAssembly with another version's JavaScript. Nothing else in the
    // toolchain would notice: both resolve, both type-check, and the failure
    // surfaces as avatars that do not draw.
    const wrapper = createRequire(require.resolve('@rive-app/react-canvas'))

    expect(version(require.resolve('@rive-app/canvas/package.json'))).toBe(
      version(wrapper.resolve('@rive-app/canvas/package.json')),
    )
  })

  it('ships both the primary and the fallback binary', () => {
    // Vite emits whatever these resolve to; a rename upstream would otherwise
    // fail the build with a bare "cannot resolve" and no hint as to why.
    for (const file of ['rive.wasm', 'rive_fallback.wasm']) {
      expect(() => require.resolve(`@rive-app/canvas/${file}`)).not.toThrow()
    }
  })
})
