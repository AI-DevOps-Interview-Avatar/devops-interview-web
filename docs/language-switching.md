# Switching language in the middle of an interview

Product specification for DIA-158, and the contract DIA-157 is built against.
The acceptance cases derived from it live in `e2e/localization.spec.ts` and
`src/pages/meet-session/TranscriptMessage.test.tsx` (DIA-166).

## Why this document exists

The EN/UA switcher sits on every screen, including the one where a recruiter is
mid-sentence. QA reached that screen twice and both times wrote the same thing
down — *"it is unclear whether this behavior is expected"* — once about which
language the voice continues in, and once about the candidate's own answers
staying as they were typed.

Neither observation was a bug report. They were a question about what the
product is supposed to do, and there was no answer written down anywhere to
check them against. Everything below is that answer.

## The rule, in one sentence

**Anything that has a translation switches immediately. Anything that was
produced — spoken by the candidate, or written by the model — keeps the language
it was produced in, and the interface says so.**

Every decision in the table follows from that one line, and the line itself
follows from what the two categories are made of. A bank question is stored as
an index into a bilingual question set, and the greeting as an i18n key; both
sides of both already exist, so switching is a re-render. A candidate's answer
and a model's remark exist in exactly one language and there is nothing on the
device that could turn one into the other.

## What happens to each thing on screen

| | On a switch mid-interview | Why |
|---|---|---|
| **The line being spoken right now** | Cut immediately, re-spoken from the start in the new language | The transcript above it has already changed; audio finishing the old sentence contradicts what the candidate is reading |
| **A question still being generated** | The run is abandoned and restarted in the new language | Letting it finish would deliver the old language several messages late, which is the defect QA logged against Marcus |
| **The next question** | New language | |
| **Past interviewer questions** | Re-translated in place | Held as an index into the bilingual bank |
| **The persona's greeting** | Re-translated in place | Held as an i18n key |
| **A remark the model wrote** | Kept as written, and labelled *Said in English* / *Сказано англійською* | See below |
| **The candidate's own answers** | Kept exactly as typed or spoken, never labelled | See below |
| **The persona's voice and gender** | Unchanged | A recruiter who changes sex on a language switch reads as a different person |
| **Microphone recognition language** | Follows on the next press, not during a live capture | Restarting recognition mid-answer would discard what has been said so far |
| **Session Summary** | Labels and the disclaimer re-translate; the numbers are language-independent | |
| **History** | Same as Session Summary; stored records are not rewritten | A record is what happened, not a view of it |
| **The offer letter** | The letter re-translates around the values Stage 1 captured, which stay verbatim | Same rule: the frame is ours, the answers are the candidate's |
| **`<html lang>`** | Follows the switch | Screen readers and hyphenation both read it |
| **The stored choice** | Written to `localStorage` and used on the next visit | |

## The two decisions QA asked for

### The candidate's answers are never translated

They are kept exactly as they arrived and carry no language label.

Translating them is the option that sounds helpful and is not. An answer is the
evidence the session is assessed on — `assessSession` counts its words, the
Stage 1 answers are copied verbatim into the offer letter, and the transcript is
the thing a candidate re-reads to see how they did. Putting a machine
translation of their sentence where their sentence was changes what they said,
in a product whose entire claim is that nothing leaves the device. There is also
nothing to translate with: the only model here is a 1B interviewer persona, and
using it as a translator would produce a worse copy of an answer that was
already fine.

They are not labelled either, unlike the model's remarks. A label exists to
explain a line the reader did not write. Nobody needs telling which language
they typed in themselves.

### Switching is never blocked

Not during a session, not between pipeline stages, not while the model is
generating. The switcher stays live on every screen.

A candidate who reaches for it mid-interview is usually telling us the language
they are in is not working for them — that they misjudged how comfortable the
technical vocabulary would be, or that their Ukrainian speech recognition is
mishearing every third word. Disabling the control at exactly that moment
answers a real problem with a locked door. The costs of allowing it are the ones
handled in the table above, and all of them are cheaper than trapping someone in
a language they cannot finish the interview in.

Stage progress, captured profile answers and history are all language-agnostic,
so nothing about a switch endangers the pipeline.

## Why a generated remark keeps its language

A remark (DIA-99) is the one message that holds words rather than a lookup. When
the candidate switches, it is genuinely stuck: the model produced English, and
the transcript is now being read in Ukrainian.

Three options, and the third is the one implemented:

| | |
|---|---|
| Re-generate it in the new language | Ten seconds of the candidate waiting while the model replaces words they already heard spoken aloud with different ones. The interview stops so that history can be rewritten |
| Drop it from the transcript | Deletes something the candidate heard. The one thing worse than a line in the wrong language is a line that was said and is not there |
| Keep it, and say which language it is in | Costs one italic line above the bubble |

The label is not decoration and not an apology — it is the same rule the engine
badge follows. The candidate is told which language a line is in for the same
reason they are told whether a model or a script is talking to them: a mixed
transcript with no explanation reads as a bug, and a bug in a language switcher
reads as an app that lost their answers.

Its scope is exactly the transcript. The live caption under the avatar is not
labelled, because it is showing what is being spoken at that moment and is
replaced by the next question seconds later; a label there would be attached to
something already gone by the time it was read.

## Known divergences

- **Question categories are not localized.** Session Summary and History list
  the raw taxonomy slugs (`general`, `ci-cd`, `linux`) in both locales, so a
  Ukrainian session shows English category names. It is not a switching defect —
  they are equally English before any switch — but the specification above claims
  the Summary is fully in the active language, and today it is not. Tracked
  separately rather than fixed here, because it is 25 keys of taxonomy
  translation with no bearing on the switch itself.
- **Ukrainian remark quality.** Gemma 3 1B writes grammatically poor Ukrainian;
  the label above tells the candidate which language a remark is in, not that it
  is well written. Tracked as DIA-207 and documented in
  [`docs/on-device-llm.md`](on-device-llm.md).

## How this is verified

| Claim | Where |
|---|---|
| Old language is cut, new one starts, and the cut utterance is marked cancelled | `e2e/localization.spec.ts` — *stops the old language and re-speaks in the new one* |
| The whole transcript re-renders, without dropping or duplicating a turn | `e2e/localization.spec.ts` — *re-renders the whole transcript* |
| Persona keeps its gender across the switch | `e2e/localization.spec.ts` — *keeps the persona on its own gender* |
| Every screen is fully translated, with no raw keys leaking through | `e2e/localization.spec.ts` — *no English fallback in Ukrainian* |
| Only generated interviewer lines are reported as stuck | `src/store/interviewSlice.test.ts` — `generatedLanguage` |
| The label renders on a foreign remark and on nothing else | `src/pages/meet-session/TranscriptMessage.test.tsx` |

The last two are unit tests rather than acceptance tests for a reason worth
recording: producing a remark requires the on-device model, which requires a
WebGPU adapter and 528 MB of weights. A CI runner has neither, so the acceptance
suite can prove that a bank question re-translates but can never produce a line
that does not. The label was additionally checked by hand in Chrome in both
directions — English interface with a Ukrainian remark, and the reverse.
