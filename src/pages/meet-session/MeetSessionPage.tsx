import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { MockLlmBackend } from '../../api/llmClient'
import { INTERVIEWERS } from '../../domain/models/InterviewerProfile'
import { addMessage, MAX_QUESTIONS, startInterview } from '../../store/interviewSlice'
import { appendHistory } from '../../store/historySlice'
import type { RootState } from '../../store'

export default function MeetSessionPage() {
  const { interviewerId } = useParams<{ interviewerId: string }>()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { messages, questionCount, finished } = useSelector((state: RootState) => state.interview)
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState('')
  const backendRef = useRef(new MockLlmBackend())

  const interviewer = INTERVIEWERS.find((i) => i.id === interviewerId)

  useEffect(() => {
    if (!interviewerId) return
    dispatch(startInterview(interviewerId))
    backendRef.current.init().then(() => askNextQuestion())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewerId])

  useEffect(() => {
    if (finished) {
      appendHistory({
        interviewerId: interviewerId ?? 'unknown',
        finishedAt: new Date().toISOString(),
        questionCount,
      })
    }
  }, [finished, interviewerId, questionCount])

  async function askNextQuestion() {
    setStreaming('')
    const full = await backendRef.current.generate('', (token) =>
      setStreaming((prev) => prev + token),
    )
    dispatch(addMessage({ author: 'interviewer', text: full }))
    setStreaming('')
  }

  function handleSend() {
    if (!draft.trim()) return
    dispatch(addMessage({ author: 'user', text: draft.trim() }))
    setDraft('')
    if (questionCount < MAX_QUESTIONS) {
      askNextQuestion()
    }
  }

  if (!interviewer) {
    return <p>Інтерв'юера не знайдено.</p>
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 640, margin: '0 auto' }}>
      <h1>
        {interviewer.role} <span style={{ color: interviewer.color }}>({interviewer.difficulty})</span>
      </h1>

      <div style={{ border: '1px solid #444', borderRadius: 12, padding: '1rem', minHeight: 300 }}>
        {messages.map((m, idx) => (
          <p key={idx}>
            <strong>{m.author === 'interviewer' ? interviewer.role : 'Ви'}:</strong> {m.text}
          </p>
        ))}
        {streaming && (
          <p>
            <strong>{interviewer.role}:</strong> {streaming}
          </p>
        )}
      </div>

      {finished ? (
        <div style={{ marginTop: '1rem' }}>
          <p>Інтерв'ю завершено. Дякуємо за відповіді!</p>
          <button onClick={() => navigate('/history')}>Переглянути історію</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Введіть відповідь…"
            style={{ flex: 1, padding: '0.5rem' }}
          />
          <button onClick={handleSend}>Надіслати</button>
        </div>
      )}
    </main>
  )
}
