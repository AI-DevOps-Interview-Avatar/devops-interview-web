/**
 * Turning an interview into something Gemma will answer as an interviewer.
 *
 * DIA-99. The engine (DIA-96) takes a string and streams a completion; left to
 * itself that is all it does, and the DIA-96 live run shows exactly what that
 * looks like: asked what a CI pipeline does, the model answered, then invented
 * an interlocutor and started writing an essay to itself. Nothing was broken —
 * a raw completion with no turn structure has no reason to stop, and no reason
 * to believe it is anybody in particular.
 *
 * ## The template
 *
 * Gemma's chat format is two roles and an explicit end marker:
 *
 *     <start_of_turn>user
 *     …
 *     <end_of_turn>
 *     <start_of_turn>model
 *     …<end_of_turn>
 *
 * There is no `system` role. Instructions go in the first user turn — that is
 * the documented shape for this family, not a workaround, and putting them in a
 * fabricated `<start_of_turn>system` block would train the model to ignore
 * them, since it never saw one during tuning.
 *
 * ## What the model is asked for, and what it is not
 *
 * It writes a **remark**: a short reaction to the answer just given. The
 * questions themselves stay in the bank (`questionBank.ts`), and that is a
 * product decision with teeth — `assessSession` measures coverage against
 * `selectedQuestions`, the pipeline stages are defined as fixed question sets,
 * and a transcript of bank questions re-translates on a language switch because
 * it stores indices rather than text. A generated question would quietly break
 * all three.
 *
 * So the model does the part it is good at — sounding like a person who
 * listened — and the deterministic parts stay deterministic.
 */

import { GENERATION_DEFAULTS } from './modelConfig'

export type PromptLang = 'en' | 'ua'

export interface TranscriptTurn {
  role: 'candidate' | 'interviewer'
  text: string
}

export interface RemarkPromptOptions {
  /** Display name the persona answers to — "Emma", "Marcus". */
  personaName: string
  /** Job title, in English: it is what the personas are defined as. */
  personaRole: string
  lang: PromptLang
  /** Oldest first. Trimmed from the front when it does not fit. */
  transcript: TranscriptTurn[]
  /** Overrides the derived budget; tests use it, callers should not. */
  maxPromptTokens?: number
}

export const START_OF_TURN = '<start_of_turn>'
export const END_OF_TURN = '<end_of_turn>'

/**
 * Room set aside for the answer.
 *
 * `maxTokens` covers input *and* output together, and MediaPipe rejects the
 * whole request when the prompt alone exceeds it rather than truncating — so
 * this is not a style preference, it is the margin that keeps a long interview
 * from failing outright at question five. 192 tokens is roughly three sentences
 * in English and rather fewer in Ukrainian, which is all a remark should be.
 */
export const RESERVED_ANSWER_TOKENS = 192

export const MAX_PROMPT_TOKENS = GENERATION_DEFAULTS.maxTokens - RESERVED_ANSWER_TOKENS

/**
 * A deliberately pessimistic token count.
 *
 * The real tokenizer lives inside the WASM runtime and is not exposed to us, so
 * this estimates — and it estimates *high*, because the two errors are not
 * symmetric. Overestimating drops one more turn of history than strictly
 * necessary; underestimating overruns the budget, and MediaPipe answers that by
 * rejecting the request, which the candidate experiences as the interviewer
 * falling silent mid-interview.
 *
 * Cyrillic is counted at roughly twice the rate of Latin text. Gemma's
 * SentencePiece vocabulary is dominated by English, and Ukrainian words are
 * routinely split into three or four pieces where the English equivalent is
 * one — a UA transcript that "looks the same length" is not.
 */
export function estimateTokens(text: string): number {
  let latin = 0
  let cyrillic = 0
  for (const char of text) {
    if (/[Ѐ-ӿ]/.test(char)) cyrillic += 1
    else latin += 1
  }
  // Plus one per turn's worth of markup, and never zero for a non-empty string.
  return Math.ceil(latin / 3.5 + cyrillic / 1.8) + (text.length > 0 ? 1 : 0)
}

/**
 * The instruction, written in the language the reply must come back in.
 *
 * Translating the instruction is the language control. A 1B model told in
 * English to "reply in Ukrainian" will often reply in English anyway; told in
 * Ukrainian, it follows the language it is already reading. The rules are
 * negative as much as positive because the failure modes are known: essays,
 * invented dialogue, and asking a fresh interview question that the bank was
 * about to ask anyway.
 */
function instruction({ personaName, personaRole, lang }: Pick<RemarkPromptOptions, 'personaName' | 'personaRole' | 'lang'>): string {
  if (lang === 'ua') {
    return [
      `Ти — ${personaName}, ${personaRole}, і проводиш співбесіду на позицію DevOps-інженера.`,
      'Нижче — стенограма розмови. Відреагуй на останню відповідь кандидата.',
      '',
      'Правила:',
      '- Пиши українською.',
      '- Одне-два речення, не більше.',
      '- Стисло визнай сказане й, якщо доречно, постав одне коротке уточнення по суті відповіді.',
      '- Не став нову тему для співбесіди — наступне питання постав не ти.',
      '- Не пиши есе, не вигадуй репліки кандидата, не продовжуй діалог за нього.',
      '- Пиши лише свою репліку, без імені й без лапок.',
    ].join('\n')
  }

  return [
    `You are ${personaName}, ${personaRole}, interviewing a candidate for a DevOps role.`,
    "Below is the transcript so far. React to the candidate's last answer.",
    '',
    'Rules:',
    '- Write in English.',
    '- One or two sentences, no more.',
    '- Briefly acknowledge what was said and, if it fits, ask one short follow-up about that answer.',
    '- Do not introduce a new interview topic — the next question is not yours to ask.',
    '- Do not write an essay, do not invent the candidate\'s lines, do not continue the dialogue for them.',
    '- Output only your own line, with no name prefix and no quotation marks.',
  ].join('\n')
}

/**
 * Transcript lines are labelled with the persona's own name rather than "You".
 *
 * Measured, not guessed. With "You:"/"Ти:" the model repeatedly answered *as the
 * candidate* — given an answer about GitLab CI and a question about background
 * checks, it produced "Відповідь на ідеї: Я готовий пройти background check",
 * which is the candidate's line, not the recruiter's. A named speaker gives the
 * completion an unambiguous voice to continue, and the same prompt then comes
 * back in character.
 */
function renderTurn(turn: TranscriptTurn, lang: PromptLang, personaName: string): string {
  const label = turn.role === 'candidate' ? (lang === 'ua' ? 'Кандидат' : 'Candidate') : personaName
  return `${label}: ${turn.text}`
}

/**
 * Builds the prompt, dropping the oldest turns until it fits.
 *
 * The instruction is never dropped and the last turn is never dropped: without
 * the first the model stops being an interviewer, and without the second there
 * is nothing to react to. A single turn too large for the budget on its own is
 * cut rather than abandoned — a candidate who pastes a page of YAML should get
 * a reply about the start of it, not silence.
 */
export function buildRemarkPrompt(options: RemarkPromptOptions): string {
  const { lang, transcript, personaName, maxPromptTokens = MAX_PROMPT_TOKENS } = options
  const head = instruction(options)

  const framing = estimateTokens(`${START_OF_TURN}user\n\n${END_OF_TURN}\n${START_OF_TURN}model\n`)
  const budget = maxPromptTokens - estimateTokens(head) - framing

  const kept: string[] = []
  let used = 0

  for (let index = transcript.length - 1; index >= 0; index--) {
    const line = renderTurn(transcript[index], lang, personaName)
    const cost = estimateTokens(line) + 1

    if (used + cost > budget) {
      // The most recent turn earns a truncation rather than an omission.
      if (kept.length === 0 && budget > 0) {
        kept.unshift(truncateToTokens(line, budget))
      }
      break
    }

    kept.unshift(line)
    used += cost
  }

  const body = kept.join('\n')
  return `${START_OF_TURN}user\n${head}\n\n${body}\n${END_OF_TURN}\n${START_OF_TURN}model\n`
}

/** Cuts a line to roughly `tokens`, on a word boundary where one is nearby. */
function truncateToTokens(line: string, tokens: number): string {
  let cut = line
  while (estimateTokens(cut) > tokens && cut.length > 0) {
    cut = cut.slice(0, Math.max(1, Math.floor(cut.length * 0.9)))
  }
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > cut.length * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()
}

/**
 * Everything the model said before it stopped being the interviewer.
 *
 * A completion does not have to honour `<end_of_turn>`, and this one frequently
 * does not: it closes its turn and then writes the candidate's next line for
 * them, which is the exact failure the DIA-96 run captured. Whatever follows
 * either marker is discarded rather than shown, and a leading name prefix the
 * instruction asked it not to write is dropped too, because it asks nicely and
 * a 1B model does not always listen.
 */
export function cleanRemark(raw: string, personaName?: string): string {
  let text = raw

  for (const marker of [END_OF_TURN, START_OF_TURN]) {
    const at = text.indexOf(marker)
    if (at !== -1) text = text.slice(0, at)
  }

  text = text.trim()

  if (personaName) {
    const prefix = new RegExp(`^${personaName}\\s*[::]\\s*`, 'i')
    text = text.replace(prefix, '')
  }

  // Models like to wrap a single-line answer in quotes despite being told not to.
  const quoted = /^["“'](.+)["”']$/s.exec(text.trim())
  if (quoted) text = quoted[1]

  return text.trim()
}

/**
 * Whether a streamed completion has reached the end of the model's turn.
 *
 * The caller keeps feeding tokens in until this says yes, then stops updating
 * the UI — MediaPipe offers no way to abort a generation, so "stopping" means
 * ignoring the rest rather than preventing it.
 */
export function hasReachedStop(accumulated: string): boolean {
  return accumulated.includes(END_OF_TURN) || accumulated.includes(START_OF_TURN)
}
