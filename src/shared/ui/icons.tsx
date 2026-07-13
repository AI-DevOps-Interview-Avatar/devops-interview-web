type IconProps = { size?: number }

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function MicIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  )
}

export function MicOffIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps}>
      <path d="M3 3l18 18" />
      <path d="M9 9v2a3 3 0 0 0 4.6 2.5M15 8V5a3 3 0 0 0-5.8-1.1" />
      <path d="M5 11a7 7 0 0 0 10.5 6" />
      <path d="M12 18v3" />
    </svg>
  )
}

export function VideocamIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps}>
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="M16 10l6-3v10l-6-3z" />
    </svg>
  )
}

export function VideocamOffIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps}>
      <path d="M3 3l18 18" />
      <path d="M16 10l6-3v10l-6-3" />
      <path d="M2 6h9a2 2 0 0 1 2 2v7.5" />
      <path d="M13.5 18H4a2 2 0 0 1-2-2V8" />
    </svg>
  )
}

export function ChatIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps}>
      <path d="M4 4h16v11H8l-4 4V4z" />
    </svg>
  )
}

export function CallEndIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 9c-2.6 0-5.1.5-7.3 1.4a1.5 1.5 0 0 0-.9 1.6l.4 2.5c.1.7.7 1.3 1.4 1.3.2 0 .4 0 .5-.1l2.6-1a1.4 1.4 0 0 0 .9-1.2l.2-1.7c.7-.1 1.4-.2 2.2-.2s1.5.1 2.2.2l.2 1.7c.1.6.4 1 .9 1.2l2.6 1c.2.1.4.1.5.1.7 0 1.3-.6 1.4-1.3l.4-2.5c.1-.6-.3-1.3-.9-1.6A17.6 17.6 0 0 0 12 9z" />
    </svg>
  )
}

export function CaptionsIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M7 12.5a2 2 0 1 1 0-3M13.5 12.5a2 2 0 1 1 0-3" strokeWidth={1.6} />
    </svg>
  )
}

export function PresentIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps}>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}

export function MoreVertIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  )
}

export function PeopleIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 9a2.5 2.5 0 1 0 0-5" />
      <path d="M18.5 14.3c2 .6 3.5 2.7 3.5 5.7" />
    </svg>
  )
}

export function InfoIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <circle cx="12" cy="7.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}
