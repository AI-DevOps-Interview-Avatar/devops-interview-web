import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas'
import { useEffect, useState, type CSSProperties } from 'react'
import type { InterviewerProfile } from '../../domain/models/InterviewerProfile'
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
}

export function AvatarTile({ interviewer, isSpeaking, size = 320 }: AvatarTileProps) {
  const src = riveAssetUrl(interviewer.riveFile)
  // Keyed on the asset so a persona swap remounts the loader: its cache lookup
  // then runs fresh, which is what keeps a cached avatar from ever flashing
  // its placeholder.
  return <AvatarCanvas key={src} src={src} interviewer={interviewer} isSpeaking={isSpeaking} size={size} />
}

function AvatarCanvas({
  src,
  interviewer,
  isSpeaking,
  size,
}: Required<AvatarTileProps> & { src: string }) {
  // A cache hit resolves during the very first render, so a return trip to Home
  // paints the finished avatar immediately instead of a placeholder that swaps.
  const [buffer, setBuffer] = useState(() => getCachedRiveBuffer(src))

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
        <RiveStage buffer={buffer} interviewer={interviewer} isSpeaking={isSpeaking} />
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
}: {
  buffer: ArrayBuffer
  interviewer: InterviewerProfile
  isSpeaking: boolean
}) {
  const stateMachine = interviewer.stateMachine ?? DEFAULT_STATE_MACHINE
  const scale = interviewer.avatarScale ?? 1
  // Cover (дефолт) заповнює коло без полосок; Contain вписує персонажа цілком
  // (оригінальний, менший вигляд наших власних ригів, напр. Marcus).
  const fit = interviewer.fit === 'contain' ? Fit.Contain : Fit.Cover
  const { rive, RiveComponent } = useRive({
    // A copy per instance: the cached buffer is shared by every tile showing
    // this persona, and handing the same one to several Rive instances would
    // make them contend for it.
    buffer: buffer.slice(0),
    stateMachines: stateMachine,
    autoplay: true,
    layout: new Layout({ fit, alignment: Alignment.Center }),
  })

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
