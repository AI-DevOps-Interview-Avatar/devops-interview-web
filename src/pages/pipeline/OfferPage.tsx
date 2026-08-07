import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { canEnterStage, OFFER_STAGE_INDEX } from '../../domain/pipeline'
import { generateOfferLetter, HIRING_CONTACT } from '../../domain/offerLetter'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'
import { PageNav } from '../../shared/ui/PageNav'
import type { RootState } from '../../store'

export default function OfferPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { completedStages, candidateProfile } = useSelector((state: RootState) => state.pipeline)
  const [copied, setCopied] = useState(false)

  const reachable = canEnterStage(completedStages, OFFER_STAGE_INDEX)

  useEffect(() => {
    if (!reachable) navigate('/pipeline')
  }, [reachable, navigate])

  const offer = useMemo(() => generateOfferLetter(candidateProfile), [candidateProfile])

  const letterText = t('offer.letterBody', {
    candidateName: offer.candidateName,
    position: offer.position,
    salaryExpectations: offer.salaryExpectations,
    noticePeriod: offer.noticePeriod,
    location: offer.location,
    contactName: HIRING_CONTACT.name,
    contactLinkedIn: HIRING_CONTACT.linkedIn,
    company: HIRING_CONTACT.company,
  })

  function handleCopy() {
    void navigator.clipboard.writeText(letterText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!reachable) return null

  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '2rem',
        paddingTop: '4.5rem',
        maxWidth: 640,
        margin: '0 auto',
        background: '#16171d',
        color: '#f3f4f6',
      }}
    >
      <LanguageSwitcher />
      <PageNav />
      <h1>{t('offer.title')}</h1>
      <p style={{ color: '#9ca3af' }}>{t('offer.subtitle')}</p>

      <pre
        style={{
          whiteSpace: 'pre-wrap',
          background: '#1c1d23',
          border: '1px solid #2e303a',
          borderRadius: 12,
          padding: '1.25rem',
          fontFamily: 'inherit',
          lineHeight: 1.6,
        }}
      >
        {letterText}
      </pre>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
        <button onClick={handleCopy}>{copied ? t('offer.copied') : t('offer.copy')}</button>
        <Link to="/pipeline" style={{ color: '#c084fc', alignSelf: 'center' }}>
          {t('offer.backToPipeline')}
        </Link>
      </div>
    </main>
  )
}
