import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { isProUnlocked, type ProFeature } from '../../domain/pro'

interface ProGateProps {
  feature: ProFeature
  children: ReactNode
}

/**
 * Stands in front of a paid screen.
 *
 * Wrapped around the route rather than rendered inside the page, for two
 * reasons. The page's chunk is lazy, so a locked visitor never downloads the
 * quiz bank they cannot open; and the gate covers the URL rather than the link,
 * which is the difference between a lock and a decoration — a bookmark, a
 * shared link or a typed address all land here too.
 *
 * A redirect rather than a panel in place: the plans are a screen of their own,
 * and two places to state the price is one place too many. `replace` keeps the
 * locked URL out of the history, so Back returns to where the visitor came from
 * instead of bouncing off the gate again.
 */
export function ProGate({ feature, children }: ProGateProps) {
  if (isProUnlocked()) return <>{children}</>

  // The screen that was asked for, so the pricing page can name it.
  return <Navigate to={`/pro?feature=${feature}`} replace />
}
