import { useNavigate } from 'react-router-dom'
import { INTERVIEWERS } from '../../domain/models/InterviewerProfile'

export default function InterviewerSelectionPage() {
  const navigate = useNavigate()

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Оберіть інтерв'юера</h1>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        {INTERVIEWERS.map((interviewer) => (
          <button
            key={interviewer.id}
            aria-label={`${interviewer.role} card, ${interviewer.difficulty} difficulty`}
            onClick={() => navigate(`/interview/${interviewer.id}`)}
            style={{
              borderColor: interviewer.color,
              borderWidth: 2,
              borderStyle: 'solid',
              borderRadius: 12,
              padding: '1.5rem',
              textAlign: 'left',
              cursor: 'pointer',
              background: 'transparent',
              color: 'inherit',
            }}
          >
            <h2 style={{ margin: 0 }}>{interviewer.role}</h2>
            <p style={{ color: interviewer.color, fontWeight: 600 }}>{interviewer.difficulty}</p>
            <p>{interviewer.description}</p>
          </button>
        ))}
      </div>
    </main>
  )
}
