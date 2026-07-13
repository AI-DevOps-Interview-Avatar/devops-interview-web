import { BrowserRouter, Route, Routes } from 'react-router-dom'
import SplashPage from './pages/splash/SplashPage'
import InterviewerSelectionPage from './pages/interviewer-selection/InterviewerSelectionPage'
import MeetSessionPage from './pages/meet-session/MeetSessionPage'
import HistoryPage from './pages/history/HistoryPage'

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<SplashPage />} />
        <Route path="/interview" element={<InterviewerSelectionPage />} />
        <Route path="/interview/:interviewerId" element={<MeetSessionPage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
