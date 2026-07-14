import { BrowserRouter, Route, Routes } from 'react-router-dom'
import SplashPage from './pages/splash/SplashPage'
import InterviewerSelectionPage from './pages/interviewer-selection/InterviewerSelectionPage'
import MeetSessionPage from './pages/meet-session/MeetSessionPage'
import HistoryPage from './pages/history/HistoryPage'
import PipelineHomePage from './pages/pipeline/PipelineHomePage'
import OfferPage from './pages/pipeline/OfferPage'
import PracticeHubPage from './pages/practice/PracticeHubPage'
import ResumeReviewPage from './pages/resume-review/ResumeReviewPage'
import JobResourcesPage from './pages/resources/JobResourcesPage'
import DevelopersPage from './pages/developers/DevelopersPage'

function App() {
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
