import { useMemo } from 'react'

const KEYWORDS: { label: string; top: string; left: string; rotate: number; size: number }[] = [
  { label: 'KUBERNETES', top: '6%', left: '4%', rotate: -8, size: 40 },
  { label: 'DOCKER', top: '18%', left: '76%', rotate: 6, size: 36 },
  { label: 'TERRAFORM', top: '36%', left: '10%', rotate: 4, size: 32 },
  { label: 'ARGOCD', top: '50%', left: '82%', rotate: -5, size: 28 },
  { label: 'GRAFANA', top: '66%', left: '6%', rotate: 7, size: 30 },
  { label: 'PROMETHEUS', top: '80%', left: '66%', rotate: -4, size: 28 },
  { label: 'HELM', top: '10%', left: '44%', rotate: -3, size: 26 },
  { label: 'AWS', top: '92%', left: '28%', rotate: 5, size: 32 },
  { label: 'AZURE', top: '3%', left: '86%', rotate: -6, size: 28 },
  { label: 'GITHUB ACTIONS', top: '60%', left: '38%', rotate: 3, size: 24 },
]

const ORBIT_LABELS = ['⎈ Kubernetes', '🐳 Docker', '🌍 Terraform', '☁️ Azure', '🐙 GitHub']
const PARTICLE_COLORS = ['#7dd3fc', '#c4b5fd', '#86efac']
const PARTICLE_COUNT = 26

/** Purely decorative animated background — pointer-events disabled, aria-hidden. */
export function HeroBackground() {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 13) * -0.9}s`,
        duration: `${9 + (i % 6)}s`,
        size: 2 + (i % 3),
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      })),
    [],
  )

  return (
    <div className="hero-bg" aria-hidden="true">
      <div className="hero-bg__gradient" />
      <div className="hero-bg__datastream" />
      {particles.map((p, i) => (
        <span
          key={i}
          className="hero-bg__particle"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 6px 1px ${p.color}`,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
      {KEYWORDS.map((k) => (
        <span
          key={k.label}
          className="hero-bg__keyword"
          style={{ top: k.top, left: k.left, fontSize: k.size, transform: `rotate(${k.rotate}deg)` }}
        >
          {k.label}
        </span>
      ))}
      <div className="hero-infinity">
        <div className="hero-infinity__symbol">∞</div>
        {ORBIT_LABELS.map((label, i) => (
          <span
            key={label}
            className="hero-infinity__orbit-item"
            style={{ animationDelay: `${-(i * (22 / ORBIT_LABELS.length))}s` }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
