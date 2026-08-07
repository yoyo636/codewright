import pkg from "../../package.json" with { type: "json" }

declare global {
  const CODEWRIGHT_VERSION: string
  const CODEWRIGHT_CHANNEL: string
}

export const InstallationVersion = typeof CODEWRIGHT_VERSION === "string" ? CODEWRIGHT_VERSION : pkg.version
export const InstallationChannel = typeof CODEWRIGHT_CHANNEL === "string" ? CODEWRIGHT_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
