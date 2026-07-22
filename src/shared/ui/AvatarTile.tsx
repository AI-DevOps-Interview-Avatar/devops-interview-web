import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas'
import { useEffect } from 'react'
import type { InterviewerProfile } from '../../domain/models/InterviewerProfile'

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
  size?: number
}

export function AvatarTile({ interviewer, isSpeaking, size = 320 }: AvatarTileProps) {
  const stateMachine = interviewer.stateMachine ?? DEFAULT_STATE_MACHINE
  const scale = interviewer.avatarScale ?? 1
  const { rive, RiveComponent } = useRive({
    src: `${import.meta.env.BASE_URL}avatars/${interviewer.riveFile}`,
    stateMachines: stateMachine,
    autoplay: true,
    // Fit.Cover заповнює квадратний контейнер, прибираючи letterbox-полоски
    // навколо арту з іншим співвідношенням сторін (напр. David/Olivia риги).
    layout: new Layout({ fit: Fit.Cover, alignment: Alignment.Center }),
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
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        border: `3px solid ${interviewer.color}`,
        background: 'linear-gradient(180deg, #2a2b33, #1c1d23)',
      }}
    >
      <RiveComponent
        style={{
          width: '100%',
          height: '100%',
          // Деякі риги мають зайвий відступ у артборді — доводимо персонажа
          // до потрібного розміру в колі (контейнер обрізає overflow).
          transform: scale === 1 ? undefined : `scale(${scale})`,
        }}
      />
    </div>
  )
}
