import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// SplashPage ("/") always auto-forwards to "/interview" once its loading
// animation finishes, so the interviewer-selection screen is the app's real
// landing page — that's where "Home" should go, not the splash route.
const HOME_PATH = '/interview'

interface PageNavProps {
  /** Parent route one level up, e.g. "/pipeline" from a pipeline stage. Omit when the parent is Home itself. */
  backTo?: string
  /** Runs before navigating away, e.g. to persist session state (see MeetSessionPage). */
  onBeforeNavigate?: () => void
}

export function PageNav({ backTo, onBeforeNavigate }: PageNavProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  function go(path: string) {
    onBeforeNavigate?.()
    navigate(path)
  }

  return (
    // Positioning belongs to whoever places it — .page__chrome in the flow,
    // .meet-chrome overlaid on the video tile.
    <div className="page-nav">
      {backTo && backTo !== HOME_PATH && (
        <button className="nav-pill" onClick={() => go(backTo)}>
          <span aria-hidden="true">⬆</span> {t('nav.back')}
        </button>
      )}
      <button className="nav-pill" onClick={() => go(HOME_PATH)}>
        <span aria-hidden="true">🏠</span> {t('nav.home')}
      </button>
    </div>
  )
}
