import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { PIPELINE_STAGES, OFFER_STAGE_INDEX, canEnterStage } from '../../domain/pipeline'
import { INTERVIEWERS } from '../../domain/models/InterviewerProfile'
import { AvatarTile } from '../../shared/ui/AvatarTile'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'
import { PageNav } from '../../shared/ui/PageNav'
import type { RootState } from '../../store'

type StageStatus = 'completed' | 'unlocked' | 'locked'

/** Every pair below clears 4.5:1 against its own surface — see DIA-161. */
const STAGE_SURFACE: Record<StageStatus, string> = {
  completed: '#1f2e22',
  unlocked: '#2a2b33',
  locked: '#212229',
}

const STAGE_STATUS_COLOR: Record<StageStatus, string> = {
  completed: '#4CAF50',
  unlocked: '#c084fc',
  locked: '#9ca3af',
}

export default function PipelineHomePage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { completedStages } = useSelector((state: RootState) => state.pipeline)

  function statusFor(stageIndex: number): StageStatus {
    if (completedStages.includes(stageIndex)) return 'completed'
    if (canEnterStage(completedStages, stageIndex)) return 'unlocked'
    return 'locked'
  }

  function openStage(stageIndex: number) {
    if (!canEnterStage(completedStages, stageIndex)) return
    navigate(stageIndex === OFFER_STAGE_INDEX ? '/pipeline/offer' : `/pipeline/stage/${stageIndex}`)
  }

  return (
    <main className="page">
      <div className="page__chrome">
        <PageNav />
        <LanguageSwitcher />
      </div>

      <header className="page__header">
        <h1 style={{ margin: 0 }}>{t('pipeline.home.title')}</h1>
        <p style={{ color: '#9ca3af' }}>{t('pipeline.home.subtitle')}</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {PIPELINE_STAGES.map((stage, index) => {
          const interviewer = stage.interviewerId ? INTERVIEWERS.find((i) => i.id === stage.interviewerId) : null
          const status = statusFor(index)
          return (
            <button
              key={stage.key}
              data-testid="stage-card"
              data-stage-index={index}
              data-stage-status={status}
              onClick={() => openStage(index)}
              disabled={status === 'locked'}
              aria-label={`${t('pipeline.stageLabel', { number: index + 1 })}: ${t(stage.titleKey)}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                borderRadius: 16,
                padding: 'clamp(0.75rem, 3vw, 1.25rem)',
                textAlign: 'left',
                cursor: status === 'locked' ? 'not-allowed' : 'pointer',
                // A locked card used to be the unlocked one at `opacity: 0.5`,
                // which dropped its own text to 2.9:1 against the page. Muting
                // the surface instead of the whole card keeps it legible while
                // still reading as out of reach.
                background: STAGE_SURFACE[status],
                border: `1px solid ${status === 'completed' ? '#4CAF50' : '#383944'}`,
                color: 'inherit',
              }}
            >
              {interviewer ? (
                <AvatarTile interviewer={interviewer} isSpeaking={false} size={56} interactive />
              ) : (
                <div
                  style={{
                    width: 56,
                    height: 56,
                    flexShrink: 0,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: '#1c1d23',
                    border: '3px solid #c084fc',
                    fontSize: 22,
                  }}
                >
                  🎉
                </div>
              )}
              <div style={{ flex: '1 1 8rem', minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>
                  {t('pipeline.stageLabel', { number: index + 1 })}
                </p>
                <h2 style={{ margin: '2px 0' }}>{t(stage.titleKey)}</h2>
                {interviewer && <p style={{ margin: 0, color: '#9ca3af' }}>{interviewer.role} — {interviewer.voiceName}</p>}
              </div>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 13,
                  fontWeight: 600,
                  color: STAGE_STATUS_COLOR[status],
                }}
              >
                {t(`pipeline.status.${status}`)}
              </span>
            </button>
          )
        })}
      </div>
    </main>
  )
}
