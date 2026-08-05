import { spawn } from "node:child_process"
import { readFile, rm } from "node:fs/promises"
import { tmpdir, platform } from "node:os"
import path from "node:path"

function recordAudio(outputPath: string, durationMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const isMac = platform() === "darwin"
    const isLinux = platform() === "linux"
    const args = isMac
      ? ["-f", "avfoundation", "-i", ":0", "-t", String(durationMs / 1000), "-ar", "16000", "-ac", "1", outputPath]
      : isLinux
        ? ["-f", "alsa", "-i", "default", "-t", String(durationMs / 1000), "-ar", "16000", "-ac", "1", outputPath]
        : ["-f", "dshow", "-i", "audio=Microphone", "-t", String(durationMs / 1000), "-ar", "16000", "-ac", "1", outputPath]

    const child = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] })
    let stderr = ""
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on("error", (err) => {
      reject(new Error(`ffmpeg not found: ${err.message}. Install ffmpeg to use voice input.`))
    })
    child.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited with code ${code}. ${stderr.slice(-200)}`))
    })
  })
}

async function transcribeAudio(audioPath: string, apiKey: string): Promise<string> {
  const audioBuffer = await readFile(audioPath)
  const formData = new FormData()
  formData.append("file", new Blob([audioBuffer], { type: "audio/wav" }), "recording.wav")
  formData.append("model", "whisper-1")
  formData.append("language", "auto")
  formData.append("response_format", "json")

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(`Transcription failed (${response.status}): ${text}`)
  }

  const data = (await response.json()) as { text?: string }
  return data.text?.trim() ?? ""
}

export type VoiceState = "idle" | "recording" | "transcribing" | "polishing" | "done" | "error"

export type VoiceResult = {
  transcript: string
  polished: string
}

export async function recordAndTranscribe(durationMs: number, apiKey: string): Promise<string> {
  const audioFile = path.join(tmpdir(), `codewright-voice-${Date.now()}.wav`)
  try {
    await recordAudio(audioFile, durationMs)
    const transcript = await transcribeAudio(audioFile, apiKey)
    if (!transcript) throw new Error("No speech detected")
    return transcript
  } finally {
    await rm(audioFile, { force: true }).catch(() => {})
  }
}

export async function polishText(text: string, opts: {
  apiKey: string
  model: string
  baseURL?: string
}): Promise<string> {
  const baseURL = opts.baseURL ?? "https://api.openai.com/v1"
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        {
          role: "system",
          content: "You are a text polishing assistant. Refine the user's voice-transcribed text for clarity, grammar, and intent. Output ONLY the polished text, no explanations. Keep the original language. Keep it concise and natural.",
        },
        { role: "user", content: text },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => "")
    throw new Error(`Polish failed (${response.status}): ${errText}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return data.choices?.[0]?.message?.content?.trim() ?? text
}

export async function getOpenAIKey(providers: ReadonlyArray<{
  id: string
  apiKey?: string
  envKey?: string
}>): Promise<string | undefined> {
  const openai = providers.find((p) => p.id === "openai")
  if (openai?.apiKey) return openai.apiKey
  if (openai?.envKey && process.env[openai.envKey]) return process.env[openai.envKey]
  for (const p of providers) {
    if (p.apiKey) return p.apiKey
    if (p.envKey && process.env[p.envKey]) return process.env[p.envKey]
  }
  return undefined
}
