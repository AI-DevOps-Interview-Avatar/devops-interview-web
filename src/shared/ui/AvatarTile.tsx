import { useRive } from '@rive-app/react-canvas'
import { useEffect } from 'react'
import type { InterviewerProfile } from '../../domain/models/InterviewerProfile'

const STATE_MACHINE = 'State Machine 1'
const SPEAK_INPUT = 'speak'

/**
 * Той самий контракт .riv-файлів, що й Android/iOS: state machine
 * "State Machine 1" з bool-входом "speak". Рігі без цього входу просто
 * ігнорують setInput (safe no-op), як і в rive-ios.
 */
interface AvatarTileProps {
  interviewer: InterviewerProfile
  isSpeaking: boolean
  size?: number
}

export function AvatarTile({ interviewer, isSpeaking, size = 320 }: AvatarTileProps) {
  const { rive, RiveComponent } = useRive({
    src: `${import.meta.env.BASE_URL}avatars/${interviewer.riveFile}`,
    stateMachines: STATE_MACHINE,
    autoplay: true,
  })

  useEffect(() => {
    if (!rive) return
    const inputs = rive.stateMachineInputs(STATE_MACHINE)
    const speakInput = inputs?.find((input) => input.name === SPEAK_INPUT)
    if (speakInput) {
      speakInput.value = isSpeaking
    }
  }, [rive, isSpeaking])

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
      <RiveComponent />
    </div>
  )
}
