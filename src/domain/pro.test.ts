import { describe, expect, it } from 'vitest'
import { localStorageStub } from '../test/localStorageStub'
import {
  grantProEntitlement,
  isProUnlocked,
  PRO_ENTITLEMENT_KEY,
  PRO_FEATURE_ROUTES,
  PRO_FEATURES,
  PRO_PLANS,
  proFeatureOf,
  readProEntitlement,
  savingPercent,
  TESTER_UNLOCK_PLAN,
  unlockCodeMatches,
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

  it('writes a record its own reader accepts', () => {
    // The pairing that matters: a writer whose output the reader rejects would
    // unlock nothing and say nothing about why.
    const storage = localStorageStub()

    const granted = grantProEntitlement('yearly', 'purchase', storage)

    expect(granted).not.toBeNull()
    expect(readProEntitlement(storage)).toEqual(granted)
    expect(isProUnlocked(storage)).toBe(true)
  })

  it('keeps how the entitlement was obtained', () => {
    // Once checkout exists, "was this bought or unlocked for testing?" has to be
    // answerable from the record rather than from memory.
    const storage = localStorageStub()
    grantProEntitlement(TESTER_UNLOCK_PLAN, 'tester', storage)

    expect(readProEntitlement(storage)?.source).toBe('tester')
  })

  it('drops a source it does not recognise instead of trusting it', () => {
    const storage = localStorageStub({
      [PRO_ENTITLEMENT_KEY]: JSON.stringify({ plan: 'yearly', since: '', source: 'gift' }),
    })

    // Still a valid entitlement — the plan is what decides that — but the
    // unknown provenance is not carried forward as if it meant something.
    expect(readProEntitlement(storage)).toEqual({ plan: 'yearly', since: '' })
  })

  it('reports a refused write rather than claiming the plan was granted', () => {
    // Private mode and a full quota both throw here. A caller that drew
    // "unlocked" over this would be lying to the next reload.
    const refusing = {
      setItem: () => {
        throw new Error('quota exceeded')
      },
    }

    expect(grantProEntitlement('monthly', 'purchase', refusing)).toBeNull()
  })
})

describe('the tester unlock code', () => {
  const CODE = 'unlock-code-for-tests'

  it('accepts the code this build was made with', () => {
    expect(unlockCodeMatches(CODE, CODE)).toBe(true)
  })

  it('refuses anything else, without hinting how close it was', () => {
    for (const attempt of ['', 'unlock-code-for-test', 'UNLOCK-CODE-FOR-TESTS', null]) {
      expect(unlockCodeMatches(attempt, CODE)).toBe(false)
    }
  })

  it('matches nothing at all when the build has no code', () => {
    // The default in every build made without TESTER_UNLOCK_CODE — a fork's CI,
    // someone's laptop. Without this, an empty `?unlock=` would open the paid
    // screens everywhere the variable was forgotten.
    for (const attempt of ['', 'anything', null]) {
      expect(unlockCodeMatches(attempt, '')).toBe(false)
    }
  })

  it('grants a plan with no expiry to explain to a tester', () => {
    expect(PRO_PLANS.some((plan) => plan.id === TESTER_UNLOCK_PLAN)).toBe(true)
    expect(TESTER_UNLOCK_PLAN).toBe('lifetime')
  })
})
