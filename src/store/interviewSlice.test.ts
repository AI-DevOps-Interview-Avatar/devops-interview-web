import { describe, expect, it } from 'vitest'
import reducer, { addMessage, requestNextQuestion, startInterview } from './interviewSlice'
import type { BankQuestion } from '../domain/models/questionBank'

function question(id: string): BankQuestion {
  return { id, category: 'general', level: 'junior', ua: `Питання ${id}`, en: `Question ${id}` }
}

/** A session mid-flight: `count` questions asked and answered. */
function session(total = 3, asked = 0) {
  let state = reducer(
    undefined,
    startInterview({ interviewerId: 'hr', questions: Array.from({ length: total }, (_, i) => question(`q${i}`)) }),
  )
  for (let i = 0; i < asked; i++) {
    state = reducer(state, requestNextQuestion())
    state = reducer(state, addMessage({ author: 'interviewer', questionIndex: i }))
    state = reducer(state, addMessage({ author: 'user', text: `answer ${i}` }))
  }
  return state
}

describe('requestNextQuestion', () => {
  it('derives the next index from committed state, not from the caller', () => {
    expect(session(3, 0).pendingQuestionIndex).toBeNull()
    expect(reducer(session(3, 0), requestNextQuestion()).pendingQuestionIndex).toBe(0)
    expect(reducer(session(3, 2), requestNextQuestion()).pendingQuestionIndex).toBe(2)
  })

  it('ignores a second request while one is still open', () => {
    const first = reducer(session(3, 1), requestNextQuestion())
    const second = reducer(first, requestNextQuestion())

    expect(second.pendingQuestionIndex).toBe(1)
    expect(second).toEqual(first)
  })

  it('stops at the end of the question set', () => {
    expect(reducer(session(2, 2), requestNextQuestion()).pendingQuestionIndex).toBeNull()
  })

  it('does nothing once the session is finished', () => {
    const finished = reducer(session(1, 1), requestNextQuestion())

    expect(finished.finished).toBe(true)
    expect(finished.pendingQuestionIndex).toBeNull()
  })
})

describe('addMessage', () => {
  it('drops a question that was already asked', () => {
    // The race from the report: a speech transcript flushes late and asks for
    // a question the manual Enter already produced.
    const asked = reducer(reducer(session(3, 0), requestNextQuestion()), addMessage({ author: 'interviewer', questionIndex: 0 }))
    const replayed = reducer(asked, addMessage({ author: 'interviewer', questionIndex: 0 }))

    expect(replayed.messages).toHaveLength(1)
    expect(replayed.questionCount).toBe(1)
  })

  it('gives exactly one question when two sends race', () => {
    // Both callers dispatch the intent; the second finds a request already open.
    let state = session(3, 1)
    state = reducer(state, requestNextQuestion())
    state = reducer(state, requestNextQuestion())
    state = reducer(state, addMessage({ author: 'interviewer', questionIndex: state.pendingQuestionIndex! }))

    expect(state.messages.filter((m) => m.author === 'interviewer')).toHaveLength(2)
    expect(state.questionCount).toBe(2)
    expect(state.pendingQuestionIndex).toBeNull()
  })

  it('refuses a question that lands after the session moved to Summary', () => {
    const finished = session(1, 1)
    const late = reducer(finished, addMessage({ author: 'interviewer', questionIndex: 1 }))

    expect(late.messages).toEqual(finished.messages)
  })

  it('finishes only after the last question is answered', () => {
    const asked = reducer(reducer(session(1, 0), requestNextQuestion()), addMessage({ author: 'interviewer', questionIndex: 0 }))

    expect(asked.finished).toBe(false)
    expect(reducer(asked, addMessage({ author: 'user', text: 'done' })).finished).toBe(true)
  })

  it('keeps the greeting outside the question count', () => {
    const greeted = reducer(session(3, 0), addMessage({ author: 'interviewer', greeting: true }))

    expect(greeted.messages).toHaveLength(1)
    expect(greeted.questionCount).toBe(0)
    expect(reducer(greeted, requestNextQuestion()).pendingQuestionIndex).toBe(0)
  })
})

describe('a generated remark', () => {
  it('does not count as a question asked', () => {
    // The remark sits between an answer and the next question. If it counted,
    // the reducer would think the bank had moved on and skip a question — and
    // `assessSession` measures coverage off the same number.
    const state = reducer(session(3, 1), addMessage({ author: 'interviewer', remark: 'Good split.', lang: 'en' }))

    expect(state.questionCount).toBe(1)
    expect(state.messages).toHaveLength(3)
  })

  it('does not end the session, however late it arrives', () => {
    // Only a candidate's answer to the last question finishes an interview.
    const state = reducer(session(2, 2), addMessage({ author: 'interviewer', remark: 'Noted.', lang: 'en' }))

    expect(state.finished).toBe(true)
    expect(reducer(session(2, 1), addMessage({ author: 'interviewer', remark: 'Noted.', lang: 'ua' })).finished).toBe(
      false,
    )
  })

  it('leaves an open question request alone', () => {
    // The remark is generated while the next question is already requested in
    // some flows; clearing the pending index here would strand it.
    const pending = reducer(session(3, 1), requestNextQuestion())
    const after = reducer(pending, addMessage({ author: 'interviewer', remark: 'And then?', lang: 'en' }))

    expect(after.pendingQuestionIndex).toBe(1)
  })

  it('keeps the language it was spoken in', () => {
    const state = reducer(session(3, 1), addMessage({ author: 'interviewer', remark: 'Розумно.', lang: 'ua' }))
    const last = state.messages.at(-1)

    expect(last).toEqual({ author: 'interviewer', remark: 'Розумно.', lang: 'ua' })
  })
})

describe('startInterview', () => {
  it('clears a pending request from the previous session', () => {
    const pending = reducer(session(3, 0), requestNextQuestion())
    const restarted = reducer(pending, startInterview({ interviewerId: 'cto', questions: [question('x')] }))

    expect(restarted.pendingQuestionIndex).toBeNull()
    expect(restarted.questionCount).toBe(0)
    expect(restarted.messages).toEqual([])
  })

  it('survives StrictMode’s double mount without duplicating the first question', () => {
    const questions = [question('q0'), question('q1')]
    let state = reducer(undefined, startInterview({ interviewerId: 'hr', questions }))
    // Mount, cleanup, mount again — then both runs ask for a question.
    state = reducer(state, startInterview({ interviewerId: 'hr', questions }))
    state = reducer(state, requestNextQuestion())
    state = reducer(state, requestNextQuestion())
    state = reducer(state, addMessage({ author: 'interviewer', questionIndex: 0 }))
    state = reducer(state, addMessage({ author: 'interviewer', questionIndex: 0 }))

    expect(state.messages).toHaveLength(1)
    expect(state.questionCount).toBe(1)
  })
})
