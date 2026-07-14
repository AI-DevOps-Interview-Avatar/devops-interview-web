import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { PIPELINE_STAGES, OFFER_STAGE_INDEX, canEnterStage } from '../../domain/pipeline'
import { INTERVIEWERS } from '../../domain/models/InterviewerProfile'
import { AvatarTile } from '../../shared/ui/AvatarTile'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'
import type { RootState } from '../../store'

export default function PipelineHomePage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { completedStages } = useSelector((state: RootState) => state.pipeline)

  function statusFor(stageIndex: number): 'completed' | 'unlocked' | 'locked' {
    if (completedStages.includes(stageIndex)) return 'completed'
    if (canEnterStage(completedStages, stageIndex)) return 'unlocked'
    return 'locked'
  }

  function openStage(stageIndex: number) {
    if (!canEnterStage(completedStages, stageIndex)) return
    navigate(stageIndex === OFFER_STAGE_INDEX ? '/pipeline/offer' : `/pipeline/stage/${stageIndex}`)
  }

  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '2rem',
        background: '#16171d',
        color: '#f3f4f6',
      }}
    >
      <LanguageSwitcher />

      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>{t('pipeline.home.title')}</h1>
        <p style={{ color: '#9ca3af' }}>{t('pipeline.home.subtitle')}</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 640 }}>
        {PIPELINE_STAGES.map((stage, index) => {
          const interviewer = stage.interviewerId ? INTERVIEWERS.find((i) => i.id === stage.interviewerId) : null
          const status = statusFor(index)
          return (
            <button
              key={stage.key}
              onClick={() => openStage(index)}
              disabled={status === 'locked'}
              aria-label={`${t('pipeline.stageLabel', { number: index + 1 })}: ${t(stage.titleKey)}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                borderRadius: 16,
                padding: '1rem 1.25rem',
                textAlign: 'left',
                cursor: status === 'locked' ? 'not-allowed' : 'pointer',
                background: status === 'completed' ? '#1f2e22' : '#2a2b33',
                border: `1px solid ${status === 'completed' ? '#4CAF50' : '#383944'}`,
                color: 'inherit',
                opacity: status === 'locked' ? 0.5 : 1,
              }}
            >
              {interviewer ? (
                <AvatarTile interviewer={interviewer} isSpeaking={false} size={56} />
              ) : (
                <div
                  style={{
                    width: 56,
                    height: 56,
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
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>
                  {t('pipeline.stageLabel', { number: index + 1 })}
                </p>
                <h2 style={{ margin: '2px 0' }}>{t(stage.titleKey)}</h2>
                {interviewer && <p style={{ margin: 0, color: '#9ca3af' }}>{interviewer.role} — {interviewer.voiceName}</p>}
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: status === 'completed' ? '#4CAF50' : status === 'unlocked' ? '#c084fc' : '#6b7280',
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
