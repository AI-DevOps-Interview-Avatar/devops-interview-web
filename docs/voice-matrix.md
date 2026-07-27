# Voice matrix — persona × locale × browser

Reference for DIA-155. Describes how `src/shared/voice/tts.ts` picks a voice, and
what that pick works out to on the browsers we support.

## Personas

Gender is a property of the persona, not of the locale. It comes from
`voiceGender` in `src/domain/models/InterviewerProfile.ts` and never changes when
the interview language changes.

| Persona | `id` | Gender |
|---|---|---|
| Emma | `recruiter` | female |
| Marcus | `senior-devops` | male |
| David | `cto` | male |
| Olivia | `hr` | female |

## Resolution algorithm

`resolveVoice(voices, lang, gender)` runs these steps in order. Every step has an
explicit tiebreak, so the same voice list always yields the same voice — the
browser's `getVoices()` ordering is not stable and must never decide anything.

1. **Filter by language.** Keep voices whose `lang` starts with the locale prefix
   (`uk` or `en`). A voice from another language is never used as a fallback: the
   engine speaks in the assigned voice's own language regardless of
   `utterance.lang`, so borrowing one would keep talking English after the UI
   switched to Ukrainian.
2. **Rank.** Network-backed voices first (`localService === false` — they sound
   markedly better than a local engine), then alphabetically by name.
3. **Match by name hint.** First voice whose name contains a known male or female
   token (`NAME_HINTS` in `tts.ts`). Covers Microsoft, Google, Apple and
   eSpeak-ng naming.
4. **Deterministic split.** No name hint matched and the locale has more than one
   voice: sort by name, split in half, female takes the first half and male the
   second. Personas still get genuinely different voices.
5. **Shared voice.** The locale has exactly one voice: both genders use it and
   `sharedVoiceFallback` is set, which is the only case where prosody is nudged
   (`pitch` ±0.12). On a properly gendered voice prosody is left untouched — a
   wider shift is what made the Ukrainian network voice sound choppy in Chrome.
6. **No voice for the locale.** `voice` stays `null`, the utterance keeps its
   `lang`, and the browser falls back to its own default. `isLanguageSpeakable()`
   detects this case separately so the UI can warn instead of playing silence.

## Expected outcome per browser

Voice lists below are what the browsers report on **Windows 10**, the platform
the exploratory testing ran on. The Microsoft pack is shared between Chrome and
Edge; Chrome adds its own network voices on top.

### Chrome (Windows 10)

Available: `Microsoft Ostap - Ukrainian (Ukraine)`, `Microsoft Polina - Ukrainian
(Ukraine)`, `Google українська`, `Microsoft David - English (United States)`,
`Microsoft Zira - English (United States)`, `Google US English`.

Chrome also carries voices named `Google UK English Female` and `Google UK
English Male`. They are the reason the gender match is anchored to word
boundaries: "female" contains "male", and a substring search put the male
persona on the female voice.

| Persona | UA | EN |
|---|---|---|
| Emma (female) | Microsoft Polina | Microsoft Zira |
| Olivia (female) | Microsoft Polina | Microsoft Zira |
| Marcus (male) | Microsoft Ostap | Microsoft David |
| David (male) | Microsoft Ostap | Microsoft David |

`Google українська` ranks first by step 2 but carries no gender token, so a named
Microsoft voice wins at step 3. That is deliberate: the network voice is the one
QA reported as choppy, and a correctly gendered local voice is the safer default.

### Edge (Windows 10)

Same Microsoft pack without the Google voices, so the outcome is identical to the
table above. This matches QA's observation that Edge sounded fine.

### Safari (macOS)

Available: `Lesya` (uk-UA), `Samantha` (en-US), `Alex` (en-US).

| Persona | UA | EN |
|---|---|---|
| Emma / Olivia (female) | Lesya — matched by name at step 3, prosody untouched | Samantha |
| Marcus / David (male) | Lesya — shared fallback at step 5, pitch 0.88 | Alex |

Note the asymmetry: `Lesya` carries a female name token, so the female personas
match it at step 3 and are spoken with no prosody change at all, while the male
personas reach step 5 and get the downward nudge. That is the intended outcome —
the voice genuinely sounds female, so only the male personas need separating —
but it does mean Marcus and David sound like a pitch-shifted Lesya on a machine
with a single Ukrainian voice. Installing a second voice removes the nudge
entirely.

### Linux (any browser)

Linux ships no speech voices of its own, so the browser has to get them from
somewhere — and the two sources behave very differently.

**Chrome does not expose local voices at all.** It reports its own set of
network-backed Google voices — nineteen of them, covering Russian and Polish but
**not Ukrainian**. `--enable-speech-dispatcher` does not change this: verified on
Chrome 150 / Ubuntu 24.04, `getVoices()` returns the same nineteen entries with
or without the flag, and not one `speech-dispatcher` voice among them.

Installing RHVoice therefore does nothing for voice *selection*. It does affect
playback: with no matching voice the utterance keeps its `lang` and Chrome hands
it to the system synthesizer, which speaks Ukrainian in whatever single default
voice it has. So the audio is not silent — it is one voice for every persona,
which is why `resolveVoice` reports `sharedVoiceFallback` when a locale has no
voices at all and lets prosody do the separating.

Firefox reads `speech-dispatcher` and does list its voices.

Once the flag is in place, the modules installed on the machine decide what is
available.

The usual setup for Ukrainian is RHVoice, which speaks it far better than
espeak-ng:

```bash
sudo apt install rhvoice rhvoice-ukrainian rhvoice-english speech-dispatcher-rhvoice
```

`speech-dispatcher` then needs the module enabled and made default. Editing the
per-user copy avoids root and is what a desktop browser reads anyway:

```bash
mkdir -p ~/.config/speech-dispatcher
cp /etc/speech-dispatcher/speechd.conf ~/.config/speech-dispatcher/
# in that copy:
#   AddModule "rhvoice"   "sd_rhvoice"   "rhvoice.conf"
#   AddModule "espeak-ng" "sd_espeak-ng" "espeak-ng.conf"
#   DefaultModule rhvoice
```

Note that adding any explicit `AddModule` line turns off autodetection, so
espeak-ng has to be listed too or it disappears. Restart the daemon
(`pkill -f /usr/bin/speech-dispatcher`) and then the browser — voices are
enumerated once at startup, reloading the tab is not enough.

Available RHVoice voices: `Anatol`, `Volodymyr` (male, uk), `Natalia`,
`Marianna` (female, uk), `Alan`, `Bdl`, `Evgeniy-Eng` (male, en), `Clb`, `Slt`,
`Lyubov` (female, en).

| Persona | UA | EN |
|---|---|---|
| Emma / Olivia (female) | Marianna | Clb |
| Marcus / David (male) | Anatol | Alan |

None of these names resemble the Microsoft or Apple ones, so they had to be
added to `NAME_HINTS` explicitly. Until they were, step 4 decided instead — and
step 4 has no idea which half of an alphabetical list is male: it gave Marcus
`Natalia` and Emma `Alan`.

### Any browser with no voice for the locale

No voice is assigned, the browser default speaks or stays silent, and the session
screen shows `meet.controls.voiceUnavailable` — a warning with the recovery step
(install the system speech pack, or continue in text).

## Capturing actual `voiceURI` values

The tables above list voice **names**, which is what the resolver matches on.
`voiceURI` is machine-specific and cannot be listed here reliably; capture it per
test machine by running this in the browser console on the deployed site:

```js
speechSynthesis.getVoices()
  .filter(v => /^(uk|en)/i.test(v.lang))
  .map(v => ({ name: v.name, lang: v.lang, uri: v.voiceURI, local: v.localService }))
```

Attach the output to DIA-155 when reporting a mismatch between this document and
what a machine actually does.

## Tests

`src/shared/voice/tts.test.ts` drives the resolver with the three lists above and
asserts, for every persona and locale: a voice is always found, the two genders
never collapse onto one voice unless the locale has only one, no voice ever comes
from another language, and the result does not depend on list ordering.
