// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes, useParams } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

/**
 * Pins react-router's behaviour under the GitHub Pages base path.
 *
 * The app is served from `/devops-interview-web/`, so every route resolves
 * through `basename` and every generated href has to carry it. Get that wrong
 * and the site still builds, still passes every other test, and then 404s on
 * the first link a candidate clicks — the failure mode that made the version
 * choice in DIA-172 worth a test rather than a promise.
 *
 * Deliberately does not import `App`: that pulls in i18n, the store and Rive,
 * none of which say anything about routing. The route table here mirrors the
 * shapes `App.tsx` actually uses — a static path, a param, a nested param.
 */

const BASENAME = '/devops-interview-web/'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root: Root | undefined
let container: HTMLDivElement | undefined

function renderAt(path: string) {
  window.history.pushState({}, '', BASENAME.replace(/\/$/, '') + path)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)

  act(() => {
    root!.render(
      <BrowserRouter basename={BASENAME}>
        <Routes>
          <Route path="/" element={<span>splash</span>} />
          <Route path="/interview/:interviewerId" element={<Named prefix="interviewer" param="interviewerId" />} />
          <Route path="/pipeline/stage/:stageIndex" element={<Named prefix="stage" param="stageIndex" />} />
          <Route path="/history" element={<Link to="/interview">to selection</Link>} />
        </Routes>
      </BrowserRouter>,
    )
  })

  return container
}

function Named({ prefix, param }: { prefix: string; param: string }) {
  const params = useParams()
  return <span>{`${prefix}:${params[param]}`}</span>
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  root = undefined
  container = undefined
})

describe('routing under the Pages base path', () => {
  it('matches the root route at the base path itself', () => {
    expect(renderAt('/').textContent).toBe('splash')
  })

  it('strips the basename before matching, so a deep link lands on its route', () => {
    expect(renderAt('/interview/marcus').textContent).toBe('interviewer:marcus')
  })

  it('reads params from a nested path', () => {
    expect(renderAt('/pipeline/stage/2').textContent).toBe('stage:2')
  })

  it('prefixes generated hrefs with the basename', () => {
    // The one that breaks silently: a link rendered as `/interview` works in
    // dev and 404s on Pages.
    const anchor = renderAt('/history').querySelector('a')
    expect(anchor?.getAttribute('href')).toBe('/devops-interview-web/interview')
  })
})
