import { Show } from "solid-js"
import { useTheme } from "../context/theme"
import { useKV } from "../context/kv"
import type { JSX } from "@opentui/solid"
import type { RGBA } from "@opentui/core"
import { registerCodewrightSpinner } from "./register-spinner"
import { deriveTrailColors, deriveInactiveColor } from "../ui/spinner"

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

export { auroraTrail, deriveTrailColors, deriveInactiveColor }
