import { Flag } from "@codewright-ai/core/flag/flag"
import { Effect } from "effect"
import path from "path"

const preserveExerciseGlobalRoot = !!process.env.CODEWRIGHT_HTTPAPI_EXERCISE_GLOBAL
export const exerciseGlobalRoot =
  process.env.CODEWRIGHT_HTTPAPI_EXERCISE_GLOBAL ??
  path.join(process.env.TMPDIR ?? "/tmp", `codewright-httpapi-global-${process.pid}`)
process.env.XDG_DATA_HOME = path.join(exerciseGlobalRoot, "data")
process.env.XDG_CONFIG_HOME = path.join(exerciseGlobalRoot, "config")
process.env.XDG_STATE_HOME = path.join(exerciseGlobalRoot, "state")
process.env.XDG_CACHE_HOME = path.join(exerciseGlobalRoot, "cache")
process.env.CODEWRIGHT_DISABLE_SHARE = "true"
export const exerciseConfigDirectory = path.join(exerciseGlobalRoot, "config", "codewright")
export const exerciseDataDirectory = path.join(exerciseGlobalRoot, "data", "codewright")

const preserveExerciseDatabase = !!process.env.CODEWRIGHT_HTTPAPI_EXERCISE_DB
export const exerciseDatabasePath =
  process.env.CODEWRIGHT_HTTPAPI_EXERCISE_DB ??
  path.join(process.env.TMPDIR ?? "/tmp", `codewright-httpapi-exercise-${process.pid}.db`)
process.env.CODEWRIGHT_DB = exerciseDatabasePath
Flag.CODEWRIGHT_DB = exerciseDatabasePath

export const original = {
  CODEWRIGHT_SERVER_PASSWORD: Flag.CODEWRIGHT_SERVER_PASSWORD,
  CODEWRIGHT_SERVER_USERNAME: Flag.CODEWRIGHT_SERVER_USERNAME,
}

export const cleanupExercisePaths = Effect.promise(async () => {
  const fs = await import("fs/promises")
  if (!preserveExerciseDatabase) {
    await Promise.all(
      [exerciseDatabasePath, `${exerciseDatabasePath}-wal`, `${exerciseDatabasePath}-shm`].map((file) =>
        fs.rm(file, { force: true }).catch(() => undefined),
      ),
    )
  }
  if (!preserveExerciseGlobalRoot)
    await fs.rm(exerciseGlobalRoot, { recursive: true, force: true }).catch(() => undefined)
})
