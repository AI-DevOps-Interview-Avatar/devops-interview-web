// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { TranscriptMessage } from './TranscriptMessage'
import type { ChatMessage } from '../../store/interviewSlice'

/**
 * The transcript bubble, and the one thing it says that the acceptance suite
 * cannot reach.
 *
 * A model-generated remark needs an on-device model, which needs a WebGPU
 * adapter and 528 MB of weights — neither of which exists on a CI runner, so
 * `e2e/localization.spec.ts` can prove that bank questions re-translate on a
 * language switch but can never produce a line that does not. That case is
 * asserted here instead, from a plain message object.
 *
 * Deliberately does not import i18n: the note's wording is looked up by the
 * page and handed over as a string, so this stays a test about rendering.
 */

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root: Root | undefined
let container: HTMLDivElement | undefined

function render(props: Parameters<typeof TranscriptMessage>[0]) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => root!.render(<TranscriptMessage {...props} />))
  return container
}

const REMARK: ChatMessage = { author: 'interviewer', remark: 'That is a solid answer.', lang: 'en' }

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  root = undefined
  container = undefined
})

describe('a line that cannot follow the language switcher', () => {
  it('says which language it was said in', () => {
    const el = render({
      message: REMARK,
      text: REMARK.author === 'interviewer' && 'remark' in REMARK ? REMARK.remark : undefined,
      accentColor: '#4ade80',
      isTask: false,
      languageNote: 'Сказано англійською',
    })

    expect(el.querySelector('[data-testid="message-language"]')?.textContent).toBe('Сказано англійською')
    // The note is an addition, not a replacement: the words the model produced
    // are still the point of the bubble.
    expect(el.textContent).toContain('That is a solid answer.')
  })

  it('stays quiet when the transcript is being read in the language it was said in', () => {
    const el = render({
      message: REMARK,
      text: 'That is a solid answer.',
      accentColor: '#4ade80',
      isTask: false,
      languageNote: undefined,
    })

    expect(el.querySelector('[data-testid="message-language"]')).toBeNull()
  })
})

describe('the ordinary turns', () => {
  it('renders the candidate’s own text, which no note is ever attached to', () => {
    const el = render({
      message: { author: 'user', text: 'Four years with Kubernetes.' },
      text: undefined,
      accentColor: '#4ade80',
      isTask: false,
    })

    expect(el.querySelector('[data-testid="message"]')?.getAttribute('data-author')).toBe('user')
    expect(el.textContent).toBe('Four years with Kubernetes.')
  })

  it('renders a bank question from the text the page localized for it', () => {
    // The page passes the already-translated string, so switching language is
    // a re-render with a different `text` and nothing else.
    const el = render({
      message: { author: 'interviewer', questionIndex: 2 },
      text: 'Що таке DevOps?',
      accentColor: '#4ade80',
      isTask: false,
    })

    expect(el.textContent).toBe('Що таке DevOps?')
    expect(el.querySelector('[data-testid="message-language"]')).toBeNull()
  })

  it('gives a Stage 3 task prompt the full width and a monospace face', () => {
    const el = render({
      message: { author: 'interviewer', questionIndex: 0 },
      text: 'apiVersion: apps/v1',
      accentColor: '#4ade80',
      isTask: true,
    })

    const bubble = el.querySelector<HTMLElement>('[data-testid="message"]')
    expect(bubble?.style.maxWidth).toBe('100%')
    expect(bubble?.style.fontFamily).toBe('monospace')
  })
})
