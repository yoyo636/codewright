import { ComponentProps, For } from "solid-js"

const particles = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2
  return {
    id: i,
    x: 7.5 + Math.cos(angle) * 5,
    y: 7.5 + Math.sin(angle) * 5,
    delay: (i / 8) * 1.6,
    duration: 1.6,
  }
})

export function Spinner(props: {
  class?: string
  classList?: ComponentProps<"div">["classList"]
  style?: ComponentProps<"div">["style"]
}) {
  return (
    <svg
      {...props}
      viewBox="0 0 15 15"
      data-component="spinner"
      classList={{
        ...props.classList,
        [props.class ?? ""]: !!props.class,
      }}
    >
      <defs>
        <radialGradient id="spinner-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="var(--glass-aurora-1)" stop-opacity="1" />
          <stop offset="50%" stop-color="var(--glass-aurora-2)" stop-opacity="0.7" />
          <stop offset="100%" stop-color="var(--glass-aurora-3)" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="spinner-particle-1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="var(--glass-aurora-1)" />
          <stop offset="100%" stop-color="var(--glass-aurora-1)" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="spinner-particle-2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="var(--glass-aurora-2)" />
          <stop offset="100%" stop-color="var(--glass-aurora-2)" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="spinner-particle-3" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="var(--glass-aurora-3)" />
          <stop offset="100%" stop-color="var(--glass-aurora-3)" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="spinner-particle-4" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="var(--glass-aurora-4)" />
          <stop offset="100%" stop-color="var(--glass-aurora-4)" stop-opacity="0" />
        </radialGradient>
      </defs>
      <circle cx="7.5" cy="7.5" r="2.4" fill="url(#spinner-core)">
        <animate attributeName="r" values="1.6;2.6;1.6" dur="1.6s" repeatCount="indefinite" />
      </circle>
      <For each={particles}>
        {(p, i) => (
          <circle
            cx={p.x}
            cy={p.y}
            r="1.2"
            fill={`url(#spinner-particle-${(i() % 4) + 1})`}
            style={{
              "transform-origin": "7.5px 7.5px",
              "animation": `glass-flow-orbit ${p.duration}s cubic-bezier(0.65, 0, 0.35, 1) infinite`,
              "animation-delay": `${-p.delay}s`,
            }}
          />
        )}
      </For>
    </svg>
  )
}
