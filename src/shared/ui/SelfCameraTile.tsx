import { useEffect, useRef } from 'react'

interface SelfCameraTileProps {
  active: boolean
}

/** Corner self-view tile, Meet-style — starts/stops getUserMedia as `active` toggles. */
export function SelfCameraTile({ active }: SelfCameraTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!active) return

    let cancelled = false
    let stream: MediaStream | null = null

    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: false })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop())
          return
        }
        stream = mediaStream
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
      })
      .catch(() => {
        // Permission denied or no camera available — self-view just stays blank.
      })

    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [active])

  if (!active) return null

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      style={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        width: 96,
        height: 96,
        borderRadius: 12,
        objectFit: 'cover',
        background: '#000',
        border: '2px solid #383944',
      }}
    />
  )
}
