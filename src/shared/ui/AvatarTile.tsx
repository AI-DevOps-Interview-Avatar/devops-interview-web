import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { InterviewerProfile } from '../../domain/models/InterviewerProfile'
import { msUntilParkFrame } from '../../domain/models/rigSettle'
import { getCachedRiveBuffer, loadRiveBuffer, riveAssetUrl } from './riveBufferCache'
import { initRiveRuntime } from './riveRuntime'

// Runs when this module is evaluated, which is necessarily before anything in
// it can render — and therefore before the first useRive(), which is the only
// ordering the Rive loader cares about.
//
// It used to live in main.tsx, and that was wrong twice over: it pulled the
// whole Rive runtime into the entry chunk that route-splitting had just moved
// out of it (DIA-134 caught this, +47 kB gzipped), and it put the setup a long
// way from the only code that depends on it.
initRiveRuntime()

const DEFAULT_STATE_MACHINE = 'State Machine 1'
const SPEAK_INPUT = 'speak'

/**
 * Той самий контракт .riv-файлів, що й Android/iOS: state machine з bool-входом
 * "speak". Назва state machine береться з профілю (дефолт "State Machine 1");
 * community-риги часто звуться "State Machine" і не мають входу "speak" — тоді
 * setInput просто ігнорується (safe no-op), як і в rive-ios.
 */
interface AvatarTileProps {
  interviewer: InterviewerProfile
  isSpeaking: boolean
  /**
   * Pixels, or any CSS length. The session passes a `min(...)` expression so
   * the tile shrinks with the viewport instead of pushing the toolbar off a
   * phone in landscape; the card screens pass a fixed number.
   */
  size?: number | string
  /**
   * Off by default, which keeps the meet-session avatar — the one screen
   * where a live face is the point — animating from the moment it mounts.
   *
   * On: the state machine settles onto one frame and then holds still, an
   * idle rig costing the main thread nothing, until a pointer or keyboard
   * focus lands on the tile. Four rigs running their loop at once on
   * `/interview` before the candidate has picked anyone was the bulk of the
   * 11-13 Lighthouse points DIA-201 measured against `/pipeline` — nobody is
   * watching any of those faces yet.
   */
  interactive?: boolean
}

export function AvatarTile({ interviewer, isSpeaking, size = 320, interactive = false }: AvatarTileProps) {
  const src = riveAssetUrl(interviewer.riveFile)
  // Keyed on the asset so a persona swap remounts the loader: its cache lookup
  // then runs fresh, which is what keeps a cached avatar from ever flashing
  // its placeholder.
  return (
    <AvatarCanvas
      key={src}
      src={src}
      interviewer={interviewer}
      isSpeaking={isSpeaking}
      size={size}
      interactive={interactive}
    />
  )
}

function AvatarCanvas({
  src,
  interviewer,
  isSpeaking,
  size,
  interactive,
}: Required<AvatarTileProps> & { src: string }) {
  // A cache hit resolves during the very first render, so a return trip to Home
  // paints the finished avatar immediately instead of a placeholder that swaps.
  const [buffer, setBuffer] = useState(() => getCachedRiveBuffer(src))
  // Only read when `interactive` — a hover or a keyboard focus is the signal
  // that this particular face is the one the candidate is looking at.
  const [engaged, setEngaged] = useState(false)

  useEffect(() => {
    if (buffer) return
    let cancelled = false
    loadRiveBuffer(src)
      .then((loaded) => {
        if (!cancelled) setBuffer(loaded)
      })
      .catch(() => {
        // Keep the placeholder rather than an empty hole in the layout.
      })
    return () => {
      cancelled = true
    }
  }, [src, buffer])

  // Carried as a custom property so the placeholder's font size can be derived
  // from it in CSS — `size * 0.34` only works while `size` is a number.
  const sizing = {
    ['--avatar-size' as string]: typeof size === 'number' ? `${size}px` : size,
  } as CSSProperties

  return (
    <div
      data-testid="avatar"
      data-interviewer-id={interviewer.id}
      // Handlers are harmless no-ops on a non-interactive tile (meet-session):
      // `engaged` is simply never read there.
      onMouseEnter={interactive ? () => setEngaged(true) : undefined}
      onMouseLeave={interactive ? () => setEngaged(false) : undefined}
      onFocus={interactive ? () => setEngaged(true) : undefined}
      onBlur={interactive ? () => setEngaged(false) : undefined}
      style={{
        ...sizing,
        width: 'var(--avatar-size)',
        height: 'var(--avatar-size)',
        flexShrink: 0,
        borderRadius: '50%',
        overflow: 'hidden',
        border: `3px solid ${interviewer.color}`,
        background: 'linear-gradient(180deg, #2a2b33, #1c1d23)',
        position: 'relative',
      }}
    >
      {buffer ? (
        <RiveStage
          buffer={buffer}
          interviewer={interviewer}
          isSpeaking={isSpeaking}
          active={!interactive || engaged}
        />
      ) : (
        // Overlaid on the same circle rather than laid out beside it — the
        // placeholder occupies the finished avatar's box exactly, so nothing
        // reflows when the canvas takes over.
        <span
          aria-hidden
          className="avatar-placeholder"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            fontSize: 'calc(var(--avatar-size) * 0.34)',
            fontWeight: 700,
            color: interviewer.color,
            opacity: 0.35,
          }}
        >
          {interviewer.voiceName.charAt(0)}
        </span>
      )}
    </div>
  )
}

function RiveStage({
  buffer,
  interviewer,
  isSpeaking,
  active,
}: {
  buffer: ArrayBuffer
  interviewer: InterviewerProfile
  isSpeaking: boolean
  /**
   * False parks the state machine instead of looping it — the canvas still
   * exists and still shows a face, it just costs nothing per frame until this
   * flips. Which frame it parks on is the rig's business: the first one for
   * most, a measured offset for one that has its eyes shut at rest (see
   * `settle` and rigSettle.ts).
   */
  active: boolean
}) {
  const stateMachine = interviewer.stateMachine ?? DEFAULT_STATE_MACHINE
  const scale = interviewer.avatarScale ?? 1
  const settle = interviewer.settle
  // Cover (дефолт) заповнює коло без полосок; Contain вписує персонажа цілком
  // (оригінальний, менший вигляд наших власних ригів, напр. Marcus).
  const fit = interviewer.fit === 'contain' ? Fit.Contain : Fit.Cover
  const { rive, RiveComponent } = useRive({
    // A copy per instance: the cached buffer is shared by every tile showing
    // this persona, and handing the same one to several Rive instances would
    // make them contend for it.
    buffer: buffer.slice(0),
    stateMachines: stateMachine,
    // Rive still renders the state machine's initial pose once on load
    // whether or not this is true — it only decides whether the loop keeps
    // ticking afterwards, which is the part that is expensive four times over.
    autoplay: active,
    layout: new Layout({ fit, alignment: Alignment.Center }),
  })

  // How far the state machine has been advanced, in milliseconds. Rive's
  // timeline is cumulative across pause/play, so this is enough to work out
  // which frame a pause would land on — see rigSettle.ts.
  const advancedMs = useRef(0)
  const runningSince = useRef<number | null>(null)

  useEffect(() => {
    if (!rive) return

    const resume = () => {
      runningSince.current ??= performance.now()
      rive.play(stateMachine)
    }

    const park = () => {
      if (runningSince.current !== null) {
        advancedMs.current += performance.now() - runningSince.current
        runningSince.current = null
      }
      rive.pause(stateMachine)
    }

    if (active) {
      resume()
      return
    }

    // Rigs whose opening pose is already a face stop where they are, exactly as
    // DIA-201 left them.
    if (!settle) {
      park()
      return
    }

    const advanced = advancedMs.current + (runningSince.current === null ? 0 : performance.now() - runningSince.current)
    const wait = msUntilParkFrame(advanced, settle)
    if (wait === 0) {
      park()
      return
    }

    // Runs on mount (advance 0, so the full parkAtMs) and again every time the
    // pointer leaves, which is what keeps the frozen tile identical whether or
    // not anyone has hovered it.
    resume()
    const handle = window.setTimeout(park, wait)
    return () => window.clearTimeout(handle)
  }, [rive, active, stateMachine, settle])

  useEffect(() => {
    if (!rive) return
    const inputs = rive.stateMachineInputs(stateMachine)
    const speakInput = inputs?.find((input) => input.name === SPEAK_INPUT)
    if (speakInput) {
      speakInput.value = isSpeaking
    }
  }, [rive, isSpeaking, stateMachine])

  return (
    <RiveComponent
      style={{
        width: '100%',
        height: '100%',
        // Деякі риги мають зайвий відступ у артборді — доводимо персонажа
        // до потрібного розміру в колі (контейнер обрізає overflow).
        transform: scale === 1 ? undefined : `scale(${scale})`,
      }}
    />
  )
}
