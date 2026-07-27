import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { headersFile, metaPolicy } from './config/csp.ts'

/**
 * Adds the CSP meta tag to the built `index.html` and drops a `_headers` file
 * next to it.
 *
 * Build-only on purpose. The dev server injects React Fast Refresh as an inline
 * script and serves CSS through inline `<style>` tags, both of which this policy
 * forbids — applying it in dev would break the thing it is meant to protect and
 * teach everyone to ignore console violations.
 *
 * The deploy workflow copies `index.html` to `404.html` for SPA fallback, so
 * deep links inherit the same policy without any extra step.
 */
function securityHeaders(): Plugin {
  return {
    name: 'security-headers',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) => {
        // Placed by hand rather than with `injectTo: 'head-prepend'`, which
        // would push `<meta charset>` down. Encoding has to be declared inside
        // the document's first 1024 bytes, and this policy is ~600 of them — a
        // couple more origins and the title's em dash would start decoding as
        // mojibake. So: charset first, policy immediately after, still ahead of
        // every script and stylesheet the document pulls in.
        const meta = `<meta http-equiv="Content-Security-Policy" content="${metaPolicy()}" />`
        const withPolicy = html.replace(/(<meta\s+charset=[^>]*>)/i, `$1\n    ${meta}`)
        if (withPolicy === html) {
          // Failing the build beats shipping a site that silently lost its policy.
          throw new Error('security-headers: no <meta charset> in index.html to anchor the CSP tag to')
        }
        return withPolicy
      },
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: headersFile() })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/devops-interview-web/',
  plugins: [react(), securityHeaders()],
})
