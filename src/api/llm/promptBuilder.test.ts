import { describe, expect, it } from 'vitest'
import {
  END_OF_TURN,
  MAX_PROMPT_TOKENS,
  START_OF_TURN,
  buildRemarkPrompt,
  cleanRemark,
  estimateTokens,
  hasReachedStop,
  type TranscriptTurn,
} from './promptBuilder'

const persona = { personaName: 'Emma', personaRole: 'Recruiter' }

function turns(count: number, text = 'a fairly ordinary answer about pipelines'): TranscriptTurn[] {
  return Array.from({ length: count }, (_, index) => ({
    role: index % 2 === 0 ? ('interviewer' as const) : ('candidate' as const),
    text: `${text} ${index}`,
  }))
}

describe('the prompt', () => {
  it('uses Gemma turn markers and leaves the model turn open', () => {
    const prompt = buildRemarkPrompt({ ...persona, lang: 'en', transcript: turns(2) })

    expect(prompt.startsWith(`${START_OF_TURN}user\n`)).toBe(true)
    // The model turn is opened and not closed: everything after it is what the
    // model writes. Closing it here would ask the model to start a new turn,
    // which is how a completion ends up inventing the next speaker.
    expect(prompt.endsWith(`${START_OF_TURN}model\n`)).toBe(true)
    expect(prompt).toContain(`${END_OF_TURN}\n${START_OF_TURN}model`)
  })

  it('puts the instruction in the user turn, because Gemma has no system role', () => {
    const prompt = buildRemarkPrompt({ ...persona, lang: 'en', transcript: turns(1) })

    expect(prompt).not.toContain('system')
    expect(prompt.indexOf('You are Emma, Recruiter')).toBeLessThan(prompt.indexOf(`${START_OF_TURN}model`))
  })

  it('writes the instruction in the language the reply must come back in', () => {
    // The language control, and the reason the instruction is translated rather
    // than parameterised: told in English to answer in Ukrainian, a 1B model
    // frequently answers in English anyway.
    const ua = buildRemarkPrompt({ ...persona, lang: 'ua', transcript: [{ role: 'candidate', text: 'Так' }] })

    expect(ua).toContain('Пиши українською')
    expect(ua).toContain('Кандидат: Так')
    expect(ua).not.toMatch(/Write in English/)
  })

  it('labels the interviewer turns with the persona name, not "You"', () => {
    // Changed after watching the model answer as the candidate: with "You:" it
    // had no fixed voice to continue and picked the wrong one. Cheap to assert,
    // and impossible to notice regressing without an assertion.
    const prompt = buildRemarkPrompt({
      ...persona,
      lang: 'en',
      transcript: [
        { role: 'interviewer', text: 'What did you build?' },
        { role: 'candidate', text: 'A pipeline.' },
      ],
    })

    expect(prompt).toContain('Emma: What did you build?')
    expect(prompt).toContain('Candidate: A pipeline.')
    expect(prompt).not.toMatch(/^You: /m)
  })

  it('names the persona it is asking the model to be', () => {
    const marcus = buildRemarkPrompt({
      personaName: 'Marcus',
      personaRole: 'Senior DevOps',
      lang: 'en',
      transcript: turns(1),
    })

    expect(marcus).toContain('You are Marcus, Senior DevOps')
  })

  it('forbids the failure modes the raw engine actually produced', () => {
    // Not hypothetical: the DIA-96 live run answered the question and then wrote
    // an essay to an interlocutor it invented.
    const prompt = buildRemarkPrompt({ ...persona, lang: 'en', transcript: turns(1) })

    expect(prompt).toMatch(/Do not write an essay/)
    expect(prompt).toMatch(/do not invent the candidate/i)
    expect(prompt).toMatch(/One or two sentences/)
  })
})

describe('fitting the budget', () => {
  it('drops the oldest turns first and always keeps the newest', () => {
    const long = turns(80, 'x'.repeat(400))
    const prompt = buildRemarkPrompt({ ...persona, lang: 'en', transcript: long })

    expect(estimateTokens(prompt)).toBeLessThanOrEqual(MAX_PROMPT_TOKENS)
    expect(prompt).toContain('79')
    expect(prompt).not.toContain(' 0\n')
  })

  it('never drops the instruction, however long the transcript', () => {
    const prompt = buildRemarkPrompt({ ...persona, lang: 'en', transcript: turns(200, 'y'.repeat(300)) })

    expect(prompt).toContain('You are Emma, Recruiter')
    expect(prompt.endsWith(`${START_OF_TURN}model\n`)).toBe(true)
  })

  it('truncates a single oversized answer rather than dropping it', () => {
    // Somebody pastes a page of YAML. A reply about the start of it beats the
    // interviewer saying nothing at all.
    const prompt = buildRemarkPrompt({
      ...persona,
      lang: 'en',
      transcript: [{ role: 'candidate', text: 'z'.repeat(20_000) }],
      maxPromptTokens: 400,
    })

    expect(prompt).toContain('Candidate: zzz')
    expect(estimateTokens(prompt)).toBeLessThanOrEqual(400)
  })

  it('stays inside the budget for a Ukrainian transcript of the same length', () => {
    // The case a character count would get wrong: the same number of characters
    // is markedly more tokens in Cyrillic.
    const uaTurns: TranscriptTurn[] = Array.from({ length: 40 }, (_, index) => ({
      role: index % 2 === 0 ? 'interviewer' : 'candidate',
      text: `Ми налаштували конвеєр доставки з трьома стадіями та артефактами ${index}`,
    }))

    expect(estimateTokens(buildRemarkPrompt({ ...persona, lang: 'ua', transcript: uaTurns }))).toBeLessThanOrEqual(
      MAX_PROMPT_TOKENS,
    )
  })
})

describe('estimateTokens', () => {
  it('charges Cyrillic more than Latin for the same character count', () => {
    expect(estimateTokens('абвгдеєжзиїйклмноп')).toBeGreaterThan(estimateTokens('abcdefghijklmnop'))
  })

  it('is zero only for the empty string', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('a')).toBeGreaterThan(0)
  })
})

describe('cleaning what comes back', () => {
  it('cuts everything after the model closes its turn', () => {
    const raw = `Good answer — what broke first?${END_OF_TURN}${START_OF_TURN}user\nCandidate: nothing ever broke`

    expect(cleanRemark(raw)).toBe('Good answer — what broke first?')
  })

  it('cuts an invented next speaker even without an end marker', () => {
    expect(cleanRemark(`Sensible split.${START_OF_TURN}user\nSomething else`)).toBe('Sensible split.')
  })

  it('drops a name prefix the instruction asked it not to write', () => {
    expect(cleanRemark('Emma: That is a reasonable trade-off.', 'Emma')).toBe('That is a reasonable trade-off.')
    expect(cleanRemark('Емма: Розумний компроміс.', 'Емма')).toBe('Розумний компроміс.')
  })

  it('unwraps a quoted line', () => {
    expect(cleanRemark('"How did that scale?"')).toBe('How did that scale?')
  })

  it('leaves an ordinary reply alone', () => {
    const reply = 'Three stages is a sensible split — what broke first when you scaled it?'
    expect(cleanRemark(reply, 'Emma')).toBe(reply)
  })
})

describe('hasReachedStop', () => {
  it('is true once either marker appears in the stream', () => {
    expect(hasReachedStop('still going')).toBe(false)
    expect(hasReachedStop(`done${END_OF_TURN}`)).toBe(true)
    expect(hasReachedStop(`done${START_OF_TURN}user`)).toBe(true)
  })
})
