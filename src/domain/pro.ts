import { STORAGE_PREFIX } from '../store/localData'

/**
 * What Pro is, which screens it covers, and who has it.
 *
 * Two screens move behind a plan: Practice & quiz and Resume review. Everything
 * else — the interviews themselves, the five-stage pipeline, the job resources,
 * the history — stays free, because those are what the site is *for* and a mock
 * interview nobody can reach is worth nothing.
 *
 * **This gate is a product boundary, not a security boundary, and the
 * difference matters.** The site is a static build on GitHub Pages with no
 * backend of any kind: there is nothing to check an entitlement against, so the
 * entitlement lives in `localStorage` and anyone who opens devtools can write
 * it. Making it enforceable means a payment provider plus a server to verify
 * the webhook, which is a different project (see DIA-218). Until that exists,
 * the honest position is the one the pricing screen states out loud: payments
 * are not live, nothing can be charged, and the lock is there to say which
 * screens the plan will cover.
 *
 * The seam is deliberate. When checkout does land, the only new piece is
 * whatever writes {@link ProEntitlement} — every reader is already here.
 */

/** The screens a plan unlocks. */
export const PRO_FEATURES = ['practice', 'resumeReview'] as const

export type ProFeature = (typeof PRO_FEATURES)[number]

/** Where each gated feature lives, so the gate and the nav cannot disagree. */
export const PRO_FEATURE_ROUTES: Record<ProFeature, string> = {
  practice: '/practice',
  resumeReview: '/resume-review',
}

export type ProPlanId = 'monthly' | 'yearly' | 'lifetime'

export interface ProPlan {
  id: ProPlanId
  /** Whole US dollars. No currency conversion: there is no checkout to convert for yet. */
  priceUsd: number
  /** Months covered. `null` is lifetime — the one plan with no renewal. */
  months: number | null
  /** The one drawn with the accent border. Exactly one plan carries it. */
  recommended?: boolean
}

export const PRO_PLANS: readonly ProPlan[] = [
  { id: 'monthly', priceUsd: 4, months: 1 },
  { id: 'yearly', priceUsd: 29, months: 12, recommended: true },
  { id: 'lifetime', priceUsd: 59, months: null },
]

/**
 * What a plan saves against paying monthly for the same span, rounded down to a
 * whole percent.
 *
 * Computed rather than written into the locale files: a "save 40%" badge that
 * outlives a price change is a lie in two languages at once. Lifetime has no
 * span to compare against, so it has no saving.
 */
export function savingPercent(plan: ProPlan, plans: readonly ProPlan[] = PRO_PLANS): number | null {
  const monthly = plans.find((candidate) => candidate.id === 'monthly')
  if (!monthly || plan.months === null || plan.months <= 1) return null

  const atMonthlyRate = monthly.priceUsd * plan.months
  if (atMonthlyRate <= plan.priceUsd) return null

  return Math.floor(((atMonthlyRate - plan.priceUsd) / atMonthlyRate) * 100)
}

export interface ProEntitlement {
  plan: ProPlanId
  /** ISO timestamp of when it was granted. */
  since: string
}

/**
 * Under the shared namespace on purpose: "Clear my data" wipes it along with
 * everything else, which is the right behaviour on a borrowed laptop.
 */
export const PRO_ENTITLEMENT_KEY = `${STORAGE_PREFIX}pro-entitlement`

/**
 * The stored entitlement, or `null` when there is none.
 *
 * Anything unreadable counts as no entitlement. The opposite default — treat a
 * corrupt record as "probably paid" — turns one bad write into a permanently
 * unlocked build with no way back short of clearing storage.
 */
export function readProEntitlement(
  storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage,
): ProEntitlement | null {
  const raw = storage?.getItem(PRO_ENTITLEMENT_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<ProEntitlement>
    if (!parsed.plan || !PRO_PLANS.some((plan) => plan.id === parsed.plan)) return null
    return { plan: parsed.plan, since: parsed.since ?? '' }
  } catch {
    return null
  }
}

export function isProUnlocked(storage?: Pick<Storage, 'getItem'>): boolean {
  return readProEntitlement(storage) !== null
}

/** Whether a route is one of the gated ones — used by the nav to draw the lock. */
export function proFeatureOf(route: string): ProFeature | undefined {
  return PRO_FEATURES.find((feature) => PRO_FEATURE_ROUTES[feature] === route)
}
