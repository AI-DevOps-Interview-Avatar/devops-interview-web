# Local data retention policy

Reference for DIA-174. Describes everything this app leaves on a candidate's
device, how long it survives, and how it is removed.

## What is stored, and why it matters

The site is public, runs entirely client-side, and can be opened on any machine
— including a shared or borrowed one. Nothing is transmitted to a server, which
is a genuine privacy advantage; the risk is not interception, it is the *next
person to use the browser*.

| Key | Written by | Contents |
|---|---|---|
| `devops-interview-web:history` | `src/store/historySlice.ts` | One record per finished session: persona, level, timestamp, completion rate, average answer length, question categories |
| `devops-interview-web:pipeline` | `src/store/pipelineSlice.ts` | Completed stages plus `candidateProfile` — the candidate's own words on salary expectations, notice period, location and current employer |
| `devops-interview-web:lang` | `src/i18n.ts` | UI language preference |
| `devops-interview-web:privacy-ack` | `src/shared/ui/PrivacyNote.tsx` | Whether the first-run storage note has been dismissed |

`candidateProfile` is the sensitive one. It is free text, typed in answer to
questions the recruiter persona asks in Stage 1, and it feeds the Stage 5 offer
letter.

Deliberately **not** persisted: chat transcripts of practice sessions
(`interviewSlice` is in-memory only), resume text pasted into Resume Review
(processed and discarded in the same render), and microphone/camera streams.

## Rules

1. **One namespace.** Every key starts with `devops-interview-web:`.
   `clearAllLocalData()` in `src/store/localData.ts` walks the storage index for
   that prefix, so a new key cannot be forgotten by a future "clear" path — but
   it *must* use the prefix, and `STORAGE_PREFIX` is exported for that reason.
2. **90-day retention.** `RETENTION_DAYS` in `localData.ts`. History records
   expire individually off `finishedAt`; pipeline progress expires as a whole
   off a `savedAt` stamp refreshed on every write, so the clock runs from last
   activity rather than from the first stage.
3. **Expiry deletes, it does not hide.** `pruneExpiredHistory()` runs at boot
   from `src/store/index.ts` and rewrites (or removes) the key. Filtering only
   on read would leave the bytes on a device belonging to someone who never
   opens the History page again — which is not a retention policy.
4. **Records predating the policy are grandfathered.** A missing or unparseable
   timestamp counts as live. Deleting a candidate's history because an older
   build wrote it without a date is the worse failure of the two.
5. **Empty means absent.** `savePipelineState()` removes the key rather than
   writing `{"completedStages":[],...}`. The store's persist subscription fires
   on every dispatch, so without this the key would reappear one tick after
   "Clear my data" removed it.
6. **The user is told.** `PrivacyNote` appears on the interviewer selection
   screen on first visit (dismissible) and permanently on History. Localised in
   `public/locales/{en,ua}/translation.json` under `privacy`.

"Clear my data" wipes the language preference and the dismissal flag along with
everything else. That is intentional: on a shared machine a leftover language
choice is still a trace of who was there, and the next visitor should be greeted
as a first-time one.

## IndexedDB (DIA-113) — reviewed, declined

DIA-113 proposed moving history from `localStorage` to IndexedDB. Re-evaluated
against this policy, that migration is **not** worth doing:

- **Volume.** A session record is a few hundred bytes and the app writes one per
  finished interview. Realistic worst case is well under 100 KB against a 5 MB
  origin quota. IndexedDB solves a size problem we do not have.
- **Privacy.** IndexedDB is no more private than `localStorage` — same origin,
  same persistence, same visibility to anyone with the device. It would not
  change a single line of the policy above.
- **Cost.** Its async API would push `loadHistory()` behind a promise and turn
  the boot-time prune into an awaited step, for no user-visible gain.
- **Retention is the actual fix.** The complaint behind DIA-113 was that data
  accumulates forever. TTL plus an explicit delete addresses that directly;
  changing the storage engine would not have.

Recommendation: close DIA-113 as superseded by DIA-174. Revisit only if the app
starts storing something genuinely large on the device — the MediaPipe model
bundle (DIA-97), which is a Cache API job rather than an IndexedDB one anyway.
