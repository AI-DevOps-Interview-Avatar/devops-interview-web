import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/**
 * The two things that belong at the bottom of the home screen rather than in
 * the row of product features: who made this, and which build you are looking
 * at.
 *
 * "Developers" used to sit in the nav pills between "Job search resources" and
 * "History", where it read as a fifth thing to do rather than as an about page.
 * The version was nowhere at all, which made every bug report start with
 * working out what the reporter had actually been running.
 */
export function AppFooter() {
  const { t } = useTranslation()

  return (
    <footer className="page__footer">
      <Link to="/developers" data-testid="footer-developers">
        {t('footer.developers')}
      </Link>
      {/* Substituted at build time from package.json — see config/appVersion.ts. */}
      <span data-testid="app-version">v{__APP_VERSION__}</span>
    </footer>
  )
}
