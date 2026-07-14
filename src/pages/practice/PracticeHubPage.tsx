import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher'
import { QUESTION_BANKS, type BankQuestion } from '../../domain/models/questionBank'
import { INTERVIEWERS } from '../../domain/models/InterviewerProfile'
import { QUIZ_QUESTIONS, scoreQuiz } from '../../domain/models/quizBank'
import { shuffle } from '../../shared/lib/shuffle'

type Tab = 'questions' | 'quiz'

/** Practice pool per persona — a random subset of the full question bank, not the fixed pipeline script. */
const PRACTICE_POOL_SIZE = 8

export default function PracticeHubPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage === 'ua' ? 'ua' : 'en'
  const [tab, setTab] = useState<Tab>('questions')
  const [openPersona, setOpenPersona] = useState<string | null>(INTERVIEWERS[0]?.id ?? null)
  const [poolVersion, setPoolVersion] = useState(0)
  const [answers, setAnswers] = useState<(number | undefined)[]>(() => Array(QUIZ_QUESTIONS.length).fill(undefined))
  const [submitted, setSubmitted] = useState(false)

  const result = useMemo(() => scoreQuiz(QUIZ_QUESTIONS, answers), [answers])

  const pools = useMemo(() => {
    const map: Record<string, BankQuestion[]> = {}
    for (const interviewer of INTERVIEWERS) {
      map[interviewer.id] = shuffle(QUESTION_BANKS[interviewer.id] ?? []).slice(0, PRACTICE_POOL_SIZE)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poolVersion is the deliberate reshuffle trigger
  }, [poolVersion])

  function selectAnswer(questionIndex: number, optionIndex: number) {
    if (submitted) return
    setAnswers((prev) => {
      const next = [...prev]
      next[questionIndex] = optionIndex
      return next
    })
  }

  function resetQuiz() {
    setAnswers(Array(QUIZ_QUESTIONS.length).fill(undefined))
    setSubmitted(false)
  }

  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '2rem',
        maxWidth: 760,
        margin: '0 auto',
        background: '#16171d',
        color: '#f3f4f6',
      }}
    >
      <LanguageSwitcher />

      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>{t('practice.title')}</h1>
        <p style={{ color: '#9ca3af' }}>{t('practice.subtitle')}</p>
      </header>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setTab('questions')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 8,
            border: '1px solid #383944',
            background: tab === 'questions' ? '#c084fc' : '#2a2b33',
            color: tab === 'questions' ? '#1c1d23' : 'inherit',
            cursor: 'pointer',
          }}
        >
          {t('practice.tabs.questions')}
        </button>
        <button
          onClick={() => setTab('quiz')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 8,
            border: '1px solid #383944',
            background: tab === 'quiz' ? '#c084fc' : '#2a2b33',
            color: tab === 'quiz' ? '#1c1d23' : 'inherit',
            cursor: 'pointer',
          }}
        >
          {t('practice.tabs.quiz')}
        </button>
      </div>

      {tab === 'questions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <p style={{ margin: 0, color: '#9ca3af', fontSize: 13 }}>{t('practice.poolNote')}</p>
            <button onClick={() => setPoolVersion((v) => v + 1)} className="nav-pill" style={{ cursor: 'pointer' }}>
              {t('practice.newSet')}
            </button>
          </div>

          {INTERVIEWERS.map((interviewer) => {
            const questions = pools[interviewer.id] ?? []
            const isOpen = openPersona === interviewer.id
            return (
              <div key={interviewer.id} style={{ borderRadius: 12, border: '1px solid #383944', background: '#2a2b33', overflow: 'hidden' }}>
                <button
                  onClick={() => setOpenPersona(isOpen ? null : interviewer.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.9rem 1.1rem',
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>
                    {interviewer.role} <span style={{ color: '#9ca3af' }}>— {interviewer.voiceName}</span>
                  </span>
                  <span>{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div style={{ padding: '0 1.1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {questions.map((q, qi) => (
                      <div key={q.id} style={{ background: '#1c1d23', border: '1px solid #2e303a', borderRadius: 8, padding: '0.75rem' }}>
                        <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>{qi + 1}.</p>
                        {q.isTaskPrompt ? (
                          <pre style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0', fontFamily: 'monospace', fontSize: 13 }}>
                            {q[lang]}
                          </pre>
                        ) : (
                          <p style={{ margin: '4px 0 0' }}>{q[lang]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'quiz' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {QUIZ_QUESTIONS.map((q, qi) => (
            <div key={q.id} style={{ background: '#2a2b33', border: '1px solid #383944', borderRadius: 12, padding: '1rem' }}>
              <p style={{ margin: '0 0 0.6rem', fontWeight: 600 }}>
                {qi + 1}. {q[lang]}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {q.options.map((opt, oi) => {
                  const picked = answers[qi] === oi
                  const showCorrectness = submitted
                  const isCorrect = oi === q.correctIndex
                  let borderColor = '#383944'
                  if (showCorrectness && isCorrect) borderColor = '#4CAF50'
                  else if (showCorrectness && picked && !isCorrect) borderColor = '#f87171'
                  else if (picked) borderColor = '#c084fc'
                  return (
                    <button
                      key={oi}
                      onClick={() => selectAnswer(qi, oi)}
                      disabled={submitted}
                      style={{
                        textAlign: 'left',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 8,
                        border: `1px solid ${borderColor}`,
                        background: '#1c1d23',
                        color: 'inherit',
                        cursor: submitted ? 'default' : 'pointer',
                      }}
                    >
                      {opt[lang]}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {!submitted ? (
              <button onClick={() => setSubmitted(true)}>{t('practice.quiz.submit')}</button>
            ) : (
              <>
                <span style={{ fontWeight: 600 }}>
                  {t('practice.quiz.result', { correct: result.correct, total: result.total, percentage: result.percentage })}
                </span>
                <button onClick={resetQuiz}>{t('practice.quiz.retry')}</button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
