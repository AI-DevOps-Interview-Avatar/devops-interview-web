import type { CandidateProfile } from './pipeline'

export interface OfferLetter {
  candidateName: string
  position: string
  salaryExpectations: string
  noticePeriod: string
  location: string
  techStackOverview: string
  generatedAt: string
}

const PLACEHOLDER = '—'

/**
 * Fills offer-letter placeholders from what Stage 1 (Emma) captured.
 *
 * Every field, the name included, comes from `profile` — the candidate is asked
 * for it during screening like everything else, rather than typing it into the
 * offer page after the fact (DIA-135). A pipeline completed before that question
 * existed simply has no `candidateName`, and falls back to the placeholder the
 * same way an unanswered salary question always has.
 */
export function generateOfferLetter(profile: CandidateProfile, position = 'DevOps Engineer'): OfferLetter {
  return {
    candidateName: profile.candidateName?.trim() || PLACEHOLDER,
    position,
    salaryExpectations: profile.salaryExpectations?.trim() || PLACEHOLDER,
    noticePeriod: profile.noticePeriod?.trim() || PLACEHOLDER,
    location: profile.location?.trim() || PLACEHOLDER,
    techStackOverview: profile.techStackOverview?.trim() || PLACEHOLDER,
    generatedAt: new Date().toISOString(),
  }
}
