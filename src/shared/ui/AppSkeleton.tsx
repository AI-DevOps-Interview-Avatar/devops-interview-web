/**
 * What the app shows while the i18n bundle is still in flight.
 *
 * `useTranslation` suspends until `locales/{lng}/translation.json` arrives, and
 * with no boundary above it that suspension reached the root: the first paint
 * was a bare dark rectangle for however long the request took — noticeably long
 * on a cold cache over a slow connection, and on every deep link into the site.
 *
 * Deliberately wordless. The one thing this screen cannot do is speak the
 * user's language: the bundle that would tell it how is exactly what it is
 * waiting for. The `aria-label` is the sole exception, and English is the
 * documented fallback locale anyway.
 */
export function AppSkeleton() {
  return (
    <div className="app-skeleton" role="status" aria-busy="true" aria-label="Loading">
      <div className="skeleton skeleton--title" />
      <div className="skeleton skeleton--subtitle" />
      <div className="app-skeleton__row">
        {/* Three placeholder cards, sized like the interviewer tiles that
            usually land here, so the real screen replaces them in place. */}
        {[0, 1, 2].map((index) => (
          <div key={index} className="app-skeleton__card">
            <div className="skeleton skeleton--avatar" />
            <div className="skeleton skeleton--line" />
            <div className="skeleton skeleton--line skeleton--line-short" />
          </div>
        ))}
      </div>
    </div>
  )
}
