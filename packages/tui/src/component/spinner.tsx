import { Show, createMemo } from "solid-js"
import { useTheme } from "../context/theme"
import { useKV } from "../context/kv"
import type { JSX } from "@opentui/solid"
import type { RGBA } from "@opentui/core"
import { registerCodewrightSpinner } from "./register-spinner"
import { deriveTrailColors, deriveInactiveColor, createFrames, createColors } from "../ui/spinner"

registerCodewrightSpinner()

// Particle flow: 6 dots with cascading wave; uses █▓▒░ to show particle density
export const SPINNER_FRAMES = [
  "█▓▒░·  ",
  " █▓▒░· ",
  "  █▓▒░·",
  " · █▓▒░",
  "░· █▓▒",
  "▒░· █▓",
  "▓▒░· █",
  "█▓▒░·  ",
]

// Aurora palette: cyan → purple → pink → mint → amber
function auroraTrail(accent: RGBA) {
  const base = deriveTrailColors(accent, 4)
  return base
}

export function Spinner(props: { children?: JSX.Element; color?: RGBA }) {
  const { theme } = useTheme()
  const kv = useKV()
  const color = () => props.color ?? theme.primary
  return (
    <Show when={kv.get("animations_enabled", true)} fallback={<text fg={color()}>⋯ {props.children}</text>}>
      <box flexDirection="row" gap={1}>
        <spinner frames={SPINNER_FRAMES} interval={70} color={color()} />
        <Show when={props.children}>
          <text fg={color()}>{props.children}</text>
        </Show>
      </box>
    </Show>
  )
}

const thinkingFramesCache = new Map<string, string[]>()

function getThinkingFrames(color: RGBA): string[] {
  const key = `${color.r},${color.g},${color.b}`
  let frames = thinkingFramesCache.get(key)
  if (!frames) {
    frames = createFrames({
      width: 5,
      style: "blocks",
      color,
      trailSteps: 4,
      inactiveFactor: 0.15,
      holdStart: 4,
      holdEnd: 2,
    })
    thinkingFramesCache.set(key, frames)
  }
  return frames
}

function getThinkingColorGenerator(color: RGBA) {
  return createColors({
    color,
    trailSteps: 4,
    inactiveFactor: 0.15,
    holdStart: 4,
    holdEnd: 2,
  })
}

export function ThinkingSpinner(props: { children?: JSX.Element; color?: RGBA }) {
  const { theme } = useTheme()
  const kv = useKV()
  const color = () => props.color ?? theme.warning
  const frames = createMemo(() => getThinkingFrames(color()))
  const colorGen = createMemo(() => getThinkingColorGenerator(color()))
  return (
    <Show when={kv.get("animations_enabled", true)} fallback={<text fg={color()}>■ {props.children}</text>}>
      <box flexDirection="row" gap={1}>
        <spinner frames={frames()} interval={80} color={colorGen()} />
        <Show when={props.children}>
          <text fg={color()}>{props.children}</text>
        </Show>
      </box>
    </Show>
  )
}

export { auroraTrail, deriveTrailColors, deriveInactiveColor }
