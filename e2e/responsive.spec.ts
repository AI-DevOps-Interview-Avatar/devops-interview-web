import { expect, test, type Locator, type Page } from '@playwright/test'
import { installSpeechStub } from './speechStub'
import { seedLanguage, seedPipelineProgress, waitForQuestion } from './session'

/**
 * The acceptance criteria of DIA-161, as assertions.
 *
 * Every screen but the session used to be laid out with the same inline object
 * — `padding: 2rem`, `maxWidth: 640`, headings pinned at 28px — so a 320px
 * phone got 256px of usable width and the persona grid, whose columns had a
 * 260px minimum, overflowed it. None of that was visible to a unit test or to
 * the build; it needed a real viewport, which is what this file brings.
 *
 * The widths are the ones named in the ticket: the two common phone widths, a
 * tablet, a laptop, and two desktop sizes.
 */

const WIDTHS = [320, 375, 768, 1024, 1440, 1920] as const

/** Height matters as little as it can here: 640 is a short phone, and short is the harder case. */
const VIEWPORT_HEIGHT = 640

/** Every route that renders without seeded state. */
const STATIC_ROUTES = [
  'interview',
  'pipeline',
  'practice',
  'resume-review',
  'resources',
  'developers',
  'history',
] as const

/**
 * Overflow of the *document*, which is what produces a horizontal scrollbar.
 * Elements that legitimately scroll inside themselves (the transcript, a long
 * caption) do not count, and neither does a sub-pixel rounding difference.
 */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement
    return Math.max(0, doc.scrollWidth - doc.clientWidth)
  })
}

/** Widest element sticking out past the viewport — the message when something does. */
async function widestOffender(page: Page): Promise<string> {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth
    let worst = { tag: 'none', right: limit }
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const box = el.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue
      if (box.right > worst.right + 1) {
        const id = el.getAttribute('data-testid') ?? el.className.toString().split(' ')[0] ?? ''
        worst = { tag: `${el.tagName.toLowerCase()}${id ? `.${id}` : ''}`, right: box.right }
      }
    }
    return `${worst.tag} reaches ${Math.round(worst.right)}px of ${limit}px`
  })
}

async function expectNoHorizontalScroll(page: Page, where: string) {
  const overflow = await horizontalOverflow(page)
  expect(overflow, `${where}: ${await widestOffender(page)}`).toBeLessThanOrEqual(1)
}

/** WCAG 2.2 target size (minimum) is 24px; the ticket asks for the 44px comfort size. */
async function expectTapTarget(control: Locator, name: string) {
  const box = await control.boundingBox()
  expect(box, `${name} has no box`).not.toBeNull()
  expect(Math.round(box!.width), `${name} width`).toBeGreaterThanOrEqual(44)
  expect(Math.round(box!.height), `${name} height`).toBeGreaterThanOrEqual(44)
}

test.describe('every screen fits the viewport it is given', () => {
  for (const width of WIDTHS) {
    test(`static routes have no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT })
      await installSpeechStub(page, { voices: 'chrome' })
      await seedLanguage(page, 'ua')

      for (const route of STATIC_ROUTES) {
        await page.goto(route)
        await expect(page.locator('main')).toBeVisible()
        await expectNoHorizontalScroll(page, `${route} @ ${width}px`)
      }
    })
  }

  // Ukrainian is the wider locale in almost every label on these screens, and
  // it is the one the layout was never checked against.
  test('the persona grid stays inside a 320px phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: VIEWPORT_HEIGHT })
    await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'ua')

    await page.goto('interview')
    const cards = page.getByTestId('interviewer-card')
    await expect(cards).toHaveCount(4)

    const limit = 320
    for (const card of await cards.all()) {
      const box = await card.boundingBox()
      expect(box!.x + box!.width).toBeLessThanOrEqual(limit + 1)
    }
    await expectNoHorizontalScroll(page, 'interviewer selection @ 320px')
  })
})

test.describe('the five pipeline stages on three classes of device', () => {
  // Phone, tablet, desktop — the three the ticket names.
  const DEVICES = [
    { name: 'phone', width: 320, height: 640 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
  ] as const

  for (const device of DEVICES) {
    test(`stages and the offer fit a ${device.name}`, async ({ page }) => {
      await page.setViewportSize({ width: device.width, height: device.height })
      await installSpeechStub(page, { voices: 'chrome' })
      await seedLanguage(page, 'ua')
      // Everything unlocked, so each stage can be opened directly instead of
      // answering 42 questions to reach the last one.
      await seedPipelineProgress(page, [0, 1, 2, 3, 4], {
        fullName: 'Олександра Ковальчук',
        salaryExpectations: '5000 USD',
      })

      await page.goto('pipeline')
      await expect(page.getByTestId('stage-card')).toHaveCount(5)
      await expectNoHorizontalScroll(page, `pipeline home @ ${device.name}`)

      for (const stageIndex of [0, 1, 2, 3]) {
        await page.goto(`pipeline/stage/${stageIndex}`)
        await waitForQuestion(page)
        await expectNoHorizontalScroll(page, `stage ${stageIndex} @ ${device.name}`)
      }

      await page.goto('pipeline/offer')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expectNoHorizontalScroll(page, `offer @ ${device.name}`)
    })
  }
})

test.describe('the session toolbar on a phone', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'ua')
  })

  test('keeps the functional controls at a usable size and hides the stubs', async ({ page }) => {
    await page.goto('interview/hr')
    await waitForQuestion(page)

    for (const id of ['mic', 'captions', 'hangup', 'chat-toggle']) {
      await expectTapTarget(page.getByTestId(id), id)
    }

    // Present/More/Info/People do nothing and are permanently disabled; on a
    // phone they are display:none rather than four dead 48px circles.
    const decorative = page.locator('.control-btn--decorative')
    await expect(decorative).toHaveCount(4)
    for (const stub of await decorative.all()) {
      await expect(stub).toBeHidden()
    }

    await expectNoHorizontalScroll(page, 'session @ 320px')
  })

  test('Back/Home never lands on top of the language switcher', async ({ page }) => {
    await page.goto('interview/hr')
    await waitForQuestion(page)

    const nav = await page.locator('.meet-chrome .page-nav').boundingBox()
    const langs = await page.locator('.meet-chrome .lang-switcher').boundingBox()

    const overlaps =
      nav!.x < langs!.x + langs!.width &&
      langs!.x < nav!.x + nav!.width &&
      nav!.y < langs!.y + langs!.height &&
      langs!.y < nav!.y + nav!.height
    expect(overlaps, 'page nav overlaps the language switcher').toBe(false)
  })
})

test.describe('captions and the microphone are reachable without a mouse', () => {
  test('both carry a name and a pressed state, and take focus visibly', async ({ page }) => {
    await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'en')
    await page.goto('interview/hr')
    await waitForQuestion(page)

    const captions = page.getByTestId('captions')
    const mic = page.getByTestId('mic')

    // The accessible name is what a screen reader announces; both are icon-only
    // buttons, so without it they are "button".
    await expect(captions).toHaveAttribute('aria-label', /caption/i)
    await expect(mic).toHaveAttribute('aria-label', /(microphone|record|mic)/i)

    await captions.focus()
    await expect(captions).toBeFocused()
    const ring = await captions.evaluate((el) => {
      const style = getComputedStyle(el)
      return { width: style.outlineWidth, style: style.outlineStyle }
    })
    expect(ring.style).not.toBe('none')
    expect(parseFloat(ring.width)).toBeGreaterThanOrEqual(2)

    // Space is the keyboard activation for a button, and the caption overlay is
    // the visible outcome of it.
    await expect(page.getByTestId('caption')).toBeVisible()
    await captions.press(' ')
    await expect(page.getByTestId('caption')).toBeHidden()
    await captions.press(' ')
    await expect(page.getByTestId('caption')).toBeVisible()
  })
})

test.describe('text keeps its contrast', () => {
  /** Relative luminance per WCAG 2.1, from an `rgb(r, g, b)` string. */
  function luminance(rgb: string): number {
    const [r, g, b] = rgb.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number)
    const channel = (value: number) => {
      const c = value / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }

  function ratio(foreground: string, background: string): number {
    const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
    return (light + 0.05) / (dark + 0.05)
  }

  /**
   * Every visible run of text on a screen, paired with the first ancestor that
   * actually paints a background. Disabled controls and anything already hidden
   * from assistive tech are skipped — WCAG exempts both, and this app has four
   * permanently-dead toolbar stubs and a decorated hero backdrop.
   *
   * Where nothing opaque is found the page background stands in, which is the
   * honest answer for the two screens whose backdrop is a gradient: both are
   * darker than the fallback, so the real ratio can only be better.
   */
  async function textContrastViolations(page: Page, fallbackBg: string): Promise<string[]> {
    return page.evaluate((fallback: string) => {
      const opaque = (color: string) => !/rgba\([^)]*,\s*0(\.\d+)?\)$/.test(color) && color !== 'transparent'

      const surfaceOf = (node: Element): string => {
        let el: Element | null = node
        while (el) {
          const bg = getComputedStyle(el).backgroundColor
          if (opaque(bg)) return bg
          el = el.parentElement
        }
        return fallback
      }

      const channel = (value: number) => {
        const c = value / 255
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      }
      const luminance = (rgb: string) => {
        const [r, g, b] = rgb.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number)
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
      }
      const ratio = (fg: string, bg: string) => {
        const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
        return (light + 0.05) / (dark + 0.05)
      }

      const failures: string[] = []
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        if (el.closest('[disabled]') || (el as HTMLButtonElement).disabled) continue
        // Decoration, not text: the hero's drifting keywords and its ∞ mark are
        // already out of the accessibility tree, and the mark is painted with a
        // clipped gradient over `color: transparent`.
        if (el.closest('[aria-hidden="true"]')) continue
        // Only leaves that carry their own text; a wrapper would be counted
        // once per level of nesting for the same words.
        const ownText = Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent ?? '')
          .join('')
          .trim()
        if (!ownText) continue

        const style = getComputedStyle(el)
        if (style.visibility === 'hidden' || style.display === 'none') continue
        if (Number(style.opacity) < 1) continue
        const box = el.getBoundingClientRect()
        if (box.width === 0 || box.height === 0) continue

        // Large text (>=24px, or >=18.66px bold) passes AA at 3:1.
        const size = parseFloat(style.fontSize)
        const bold = Number(style.fontWeight) >= 700
        const floor = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5

        const got = ratio(style.color, surfaceOf(el))
        if (got < floor) {
          failures.push(`"${ownText.slice(0, 40)}" ${style.color} on ${surfaceOf(el)} = ${got.toFixed(2)} (needs ${floor})`)
        }
      }
      return failures
    }, fallbackBg)
  }

  for (const route of STATIC_ROUTES) {
    test(`${route} holds AA on every run of text`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: VIEWPORT_HEIGHT })
      await installSpeechStub(page, { voices: 'chrome' })
      await seedLanguage(page, 'ua')

      await page.goto(route)
      await expect(page.locator('main')).toBeVisible()

      const violations = await textContrastViolations(page, 'rgb(22, 23, 29)')
      expect(violations, `${route}:\n${violations.join('\n')}`).toEqual([])
    })
  }

  test('the three pipeline stage states all clear AA', async ({ page }) => {
    await installSpeechStub(page, { voices: 'chrome' })
    await seedLanguage(page, 'ua')
    // One stage done leaves all three states on screen at once: completed,
    // unlocked, and the locked ones behind it.
    await seedPipelineProgress(page, [0])

    await page.goto('pipeline')
    const cards = page.getByTestId('stage-card')
    await expect(cards).toHaveCount(5)

    const seen = new Set<string>()
    for (const card of await cards.all()) {
      const status = (await card.getAttribute('data-stage-status'))!
      seen.add(status)

      const surface = await card.evaluate((el) => getComputedStyle(el).backgroundColor)
      // A locked card used to be the unlocked one at opacity 0.5, which took
      // its own text to 2.9:1 — the reason this assertion exists.
      const opacity = await card.evaluate((el) => Number(getComputedStyle(el).opacity))
      expect(opacity, `${status} card opacity`).toBe(1)

      for (const text of await card.locator('p, h2, span').all()) {
        if (!(await text.isVisible())) continue
        if (!(await text.innerText()).trim()) continue
        const color = await text.evaluate((el) => getComputedStyle(el).color)
        expect(ratio(color, surface), `${status}: ${color} on ${surface}`).toBeGreaterThanOrEqual(4.5)
      }
    }

    expect(Array.from(seen).sort()).toEqual(['completed', 'locked', 'unlocked'])
  })
})
