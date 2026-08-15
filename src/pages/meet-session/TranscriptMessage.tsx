import type { ChatMessage } from '../../store/interviewSlice'

/**
 * One turn in the in-call transcript.
 *
 * Split out of `MeetSessionPage` for one reason: the line it can carry — "this
 * was said in the other language" — only ever appears on a model-generated
 * remark, and a remark needs an on-device model to exist. The acceptance suite
 * runs on a headless runner with no WebGPU adapter and no 528 MB bundle, so it
 * can never produce one; a component that renders from a plain message object
 * can be asserted on without either.
 *
 * Presentational on purpose. Which language a line is stuck in is decided by
 * `generatedLanguage`, and the wording of the note is looked up by the page —
 * this only places it.
 */
export function TranscriptMessage({
  message,
  text,
  accentColor,
  isTask,
  languageNote,
}: {
  message: ChatMessage
  /** Already localized: the bank lookup and the greeting key belong to the page. */
  text: string | undefined
  /** The persona's colour, which the candidate's own bubbles are tinted with. */
  accentColor: string
  /** Stage 3 code/manifest prompts render monospace and full width. */
  isTask: boolean
  /**
   * Set only when this line is not in the language the transcript is being read
   * in. Passing it is the page's decision; showing it is not optional.
   */
  languageNote?: string
}) {
  return (
    <div
      data-testid="message"
      data-author={message.author}
      style={{
        alignSelf: message.author === 'user' ? 'flex-end' : 'flex-start',
        background: message.author === 'user' ? accentColor : '#2a2b33',
        color: message.author === 'user' ? '#1c1d23' : '#f3f4f6',
        borderRadius: 12,
        padding: '0.5rem 0.75rem',
        maxWidth: isTask ? '100%' : '85%',
        whiteSpace: 'pre-wrap',
        fontFamily: isTask ? 'monospace' : undefined,
        fontSize: isTask ? 12 : undefined,
      }}
    >
      {languageNote && (
        <span
          data-testid="message-language"
          style={{
            display: 'block',
            marginBottom: 4,
            fontSize: 11,
            fontStyle: 'italic',
            color: '#9ca3af',
            // The bubble itself is pre-wrap, and the note is a separate
            // sentence rather than part of what was said.
            whiteSpace: 'normal',
          }}
        >
          {languageNote}
        </span>
      )}
      {message.author === 'user' ? message.text : text}
    </div>
  )
}
