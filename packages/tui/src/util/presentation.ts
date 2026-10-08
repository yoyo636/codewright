const logo = {
  left: ["                   ", "█▀▀█ █▀▀█ █▀▀█ █▀▀▄", "█__█ █__█ █^^^ █__█", "▀▀▀▀ █▀▀▀ ▀▀▀▀ ▀~~▀"],
  right: ["             ▄     ", "█▀▀▀ █▀▀█ █▀▀█ █▀▀█", "█___ █__█ █__█ █^^^", "▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀"],
}

const reset = "\x1b[0m"
const bold = "\x1b[1m"
const dim = "\x1b[90m"

// Aether aurora stops — keep in sync with the theme assets.
const AURORA_STOPS = [
  [196, 181, 253], // lavender
  [139, 124, 255], // aurora
  [94, 234, 212], // mint
] as const

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t)
}

function auroraFg(t: number, fade: number) {
  const clamped = Math.max(0, Math.min(1, t))
  const [c0, c1, c2] = AURORA_STOPS
  const stop = clamped <= 0.5 ? [lerp(c0[0], c1[0], clamped * 2), lerp(c0[1], c1[1], clamped * 2), lerp(c0[2], c1[2], clamped * 2)] : [lerp(c1[0], c2[0], (clamped - 0.5) * 2), lerp(c1[1], c2[1], (clamped - 0.5) * 2), lerp(c1[2], c2[2], (clamped - 0.5) * 2)]
  // Fade toward terminal default gray so the left half stays quieter.
  const [r, g, b] = [lerp(stop[0], 136, fade), lerp(stop[1], 136, fade), lerp(stop[2], 136, fade)]
  return `\x1b[38;2;${r};${g};${b}m`
}

function wordmark(pad = "") {
  const total = (logo.left[0]?.length ?? 0) + (logo.right[0]?.length ?? 0) + 1

  const draw = (line: string, offset: number, fade: number, strong: boolean, shadow: string, bg: string) =>
    [...line]
      .map((char, index) => {
        const fg = strong ? bold + auroraFg((offset + index) / (total - 1), fade) : auroraFg((offset + index) / (total - 1), fade)
        if (char === "_") return `${bg} ${reset}`
        if (char === "^") return `${fg}${bg}▀${reset}`
        if (char === "~") return `${shadow}▀${reset}`
        if (char === " ") return " "
        return `${fg}${char}${reset}`
      })
      .join("")

  return logo.left.map((line, index) => {
    const left = draw(line, 0, 0.45, false, "\x1b[38;5;235m", "\x1b[48;5;235m")
    const right = draw(logo.right[index] ?? "", (logo.left[index]?.length ?? 0) + 1, 0, true, "\x1b[38;5;238m", "\x1b[48;5;238m")
    return `${pad}${left} ${right}`
  })
}

export function sessionEpilogue(input: { title: string; sessionID?: string }) {
  const weak = (text: string) => `${dim}${text.padEnd(10, " ")}${reset}`
  return [
    ...wordmark("  "),
    "",
    `  ${weak("Session")}${bold}${input.title}${reset}`,
    `  ${weak("Continue")}${bold}codewright -s ${input.sessionID}${reset}`,
    "",
  ].join("\n")
}
