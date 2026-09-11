import { describe, expect, it } from 'vitest'
import { localStorageStub } from '../test/localStorageStub'
import {
  isProUnlocked,
  PRO_ENTITLEMENT_KEY,
  PRO_FEATURE_ROUTES,
  PRO_FEATURES,
  PRO_PLANS,
  proFeatureOf,
  readProEntitlement,
  savingPercent,
} from './pro'
import { STORAGE_PREFIX } from '../store/localData'

describe('the plans', () => {
  it('marks exactly one plan as the recommended one', () => {
    // Two "best value" flags is a price list nobody trusts; none is a grid with
    // no answer to "which one should I take".
    expect(PRO_PLANS.filter((plan) => plan.recommended)).toHaveLength(1)
  })

  it('costs less per month the longer the plan runs', () => {
    const perMonth = PRO_PLANS.filter((plan) => plan.months !== null).map(
      (plan) => plan.priceUsd / plan.months!,
    )

    expect([...perMonth].sort((a, b) => b - a)).toEqual(perMonth)
  })

  it('quotes the yearly saving against twelve monthly payments', () => {
    const yearly = PRO_PLANS.find((plan) => plan.id === 'yearly')!
    const monthly = PRO_PLANS.find((plan) => plan.id === 'monthly')!

    const expected = Math.floor(((monthly.priceUsd * 12 - yearly.priceUsd) / (monthly.priceUsd * 12)) * 100)
    expect(savingPercent(yearly)).toBe(expected)
  })

  it('claims no saving for the monthly plan or for lifetime', () => {
    // Lifetime has no span to compare against, and monthly *is* the comparison.
    expect(savingPercent(PRO_PLANS.find((plan) => plan.id === 'monthly')!)).toBeNull()
    expect(savingPercent(PRO_PLANS.find((plan) => plan.id === 'lifetime')!)).toBeNull()
  })

  it('claims no saving when the longer plan is not actually cheaper', () => {
    const plans = [
      { id: 'monthly', priceUsd: 4, months: 1 },
      { id: 'yearly', priceUsd: 48, months: 12 },
    ] as const

    expect(savingPercent(plans[1], plans)).toBeNull()
  })
})

describe('the gated features', () => {
  it('maps every feature to a route and back', () => {
    for (const feature of PRO_FEATURES) {
      expect(proFeatureOf(PRO_FEATURE_ROUTES[feature])).toBe(feature)
    }
  })

  it('leaves the free routes free', () => {
    // The routes a candidate must never hit a paywall on. Gating any of these
    // would leave the site without the thing it exists to do.
    for (const route of ['/interview', '/pipeline', '/resources', '/history', '/engine']) {
      expect(proFeatureOf(route)).toBeUndefined()
    }
  })
})

describe('the stored entitlement', () => {
  it('reads a plan that was granted', () => {
    const storage = localStorageStub({
      [PRO_ENTITLEMENT_KEY]: JSON.stringify({ plan: 'yearly', since: '2026-09-11T10:00:00.000Z' }),
    })

    expect(readProEntitlement(storage)).toEqual({ plan: 'yearly', since: '2026-09-11T10:00:00.000Z' })
    expect(isProUnlocked(storage)).toBe(true)
  })

  it('treats anything unreadable as no entitlement', () => {
    // The safe direction. The opposite default turns one bad write into a
    // permanently unlocked build with no way back short of clearing storage.
    for (const raw of ['', 'not json', '{}', '{"plan":"enterprise"}', 'null']) {
      expect(isProUnlocked(localStorageStub({ [PRO_ENTITLEMENT_KEY]: raw }))).toBe(false)
    }
  })

  it('is locked when there is no storage at all', () => {
    expect(isProUnlocked(undefined)).toBe(false)
  })

  it('lives under the namespace "clear my data" walks', () => {
    // A plan that survived "delete everything" is a trace of the previous person
    // on a shared laptop, and the retention policy promises there are none.
    expect(PRO_ENTITLEMENT_KEY.startsWith(STORAGE_PREFIX)).toBe(true)
  })
})
