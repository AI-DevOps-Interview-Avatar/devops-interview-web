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
 * `noticePeriod` isn't asked as a separate question (it's bundled into the
 * "conditions" answer together with salary), so it falls back to the same
 * free-text answer as salaryExpectations.
 */
export function generateOfferLetter(profile: CandidateProfile, candidateName: string, position = 'DevOps Engineer'): OfferLetter {
  return {
    candidateName: candidateName.trim() || PLACEHOLDER,
    position,
    salaryExpectations: profile.salaryExpectations?.trim() || PLACEHOLDER,
    noticePeriod: profile.noticePeriod?.trim() || profile.salaryExpectations?.trim() || PLACEHOLDER,
    location: profile.location?.trim() || PLACEHOLDER,
    techStackOverview: profile.techStackOverview?.trim() || PLACEHOLDER,
    generatedAt: new Date().toISOString(),
  }
}
