import { lazy, useEffect, type ComponentType, type LazyExoticComponent } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import SplashPage from './pages/splash/SplashPage'

/**
 * Every screen except the splash is loaded on demand.
 *
 * One bundle held the whole app — 648 kB minified, past Vite's warning
 * threshold — and most of that is weight the first screen never uses: the Rive
 * runtime behind the avatars, the question banks, the assessment and offer
 * logic. A candidate opening the site paid for the entire interview machinery
 * before seeing a single word of it.
 *
 * The splash screen stays in the entry chunk on purpose. It is the landing
 * route and it auto-navigates onward after its bootstrap bar, so splitting it
 * out would only put a round trip in front of the first paint.
 */
type PreloadableComponent = LazyExoticComponent<ComponentType> & { preload: () => void }

function lazyPage(load: () => Promise<{ default: ComponentType }>): PreloadableComponent {
  // `lazy` offers no way to start the fetch early, so the loader is kept for
  // the idle warm-up below. Calling it twice costs nothing: the module registry
  // hands back the first promise.
  return Object.assign(lazy(load), { preload: () => void load() })
}

const InterviewerSelectionPage = lazyPage(() => import('./pages/interviewer-selection/InterviewerSelectionPage'))
const MeetSessionPage = lazyPage(() => import('./pages/meet-session/MeetSessionPage'))
const HistoryPage = lazyPage(() => import('./pages/history/HistoryPage'))
const PipelineHomePage = lazyPage(() => import('./pages/pipeline/PipelineHomePage'))
const OfferPage = lazyPage(() => import('./pages/pipeline/OfferPage'))
const PracticeHubPage = lazyPage(() => import('./pages/practice/PracticeHubPage'))
const ResumeReviewPage = lazyPage(() => import('./pages/resume-review/ResumeReviewPage'))
const JobResourcesPage = lazyPage(() => import('./pages/resources/JobResourcesPage'))
const DevelopersPage = lazyPage(() => import('./pages/developers/DevelopersPage'))

/**
 * The two screens the splash leads to, fetched while it counts up rather than
 * after it finishes.
 *
 * The splash spends about a second and a half on its bootstrap bar and already
 * uses that window to warm the avatar buffer cache. Without the same treatment
 * for the route chunks, the skeleton would flash between the bar and the
 * interviewer grid — the flicker DIA-162 removed from the avatars, returning
 * one layer up.
 */
function useWarmInterviewRoutes() {
  useEffect(() => {
    const warm = () => {
      InterviewerSelectionPage.preload()
      MeetSessionPage.preload()
    }

    // Safari has no requestIdleCallback; the timeout keeps the behaviour rather
    // than the API. Checked on the property and not with `in`, which the DOM
    // types treat as always true and narrow the fallback away to `never`.
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(warm)
      return () => window.cancelIdleCallback(handle)
    }
    const handle = window.setTimeout(warm, 300)
    return () => window.clearTimeout(handle)
  }, [])
}

function App() {
  useWarmInterviewRoutes()

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<SplashPage />} />
        <Route path="/interview" element={<InterviewerSelectionPage />} />
        <Route path="/interview/:interviewerId" element={<MeetSessionPage />} />
        <Route path="/pipeline" element={<PipelineHomePage />} />
        <Route path="/pipeline/stage/:stageIndex" element={<MeetSessionPage />} />
        <Route path="/pipeline/offer" element={<OfferPage />} />
        <Route path="/practice" element={<PracticeHubPage />} />
        <Route path="/resume-review" element={<ResumeReviewPage />} />
        <Route path="/resources" element={<JobResourcesPage />} />
        <Route path="/developers" element={<DevelopersPage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
