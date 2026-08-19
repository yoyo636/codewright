#!/usr/bin/env bun
import { $ } from "bun"
import pkg from "../package.json"
import { Script } from "@codewright-ai/script"
import { fileURLToPath } from "url"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

async function published(name: string, version: string) {
  return (await $`npm view ${name}@${version} version`.nothrow()).exitCode === 0
}

async function publish(dir: string, name: string, version: string) {
  // GitHub artifact downloads can drop the executable bit, and Docker uses the
  // unpacked dist binaries directly rather than the published tarball.
  if (process.platform !== "win32") await $`chmod -R 755 .`.cwd(dir)
  if (await published(name, version)) {
    console.log(`already published ${name}@${version}`)
    return
  }
  await $`bun pm pack`.cwd(dir)
  await $`npm publish *.tgz --access public --tag ${Script.channel}`.cwd(dir)
}

// Collect the per-platform binary packages produced by build.ts.
const binaries: Record<string, string> = {}
for (const filepath of new Bun.Glob("*/package.json").scanSync({ cwd: "./dist" })) {
  const p = await Bun.file(`./dist/${filepath}`).json()
  binaries[p.name] = p.version
}
console.log("binaries", binaries)
const version = Object.values(binaries)[0]

// Build the installable meta package. Its name matches the source package
// (@codewright-ai/codewright) and it depends on the per-platform binaries as
// optionalDependencies. A postinstall script copies the right binary for the
// current OS/arch (including Windows) into place.
const metaName = pkg.name
await $`mkdir -p ./dist/${metaName}`
await $`mkdir -p ./dist/${metaName}/bin`
await $`cp ./script/postinstall.mjs ./dist/${metaName}/postinstall.mjs`
await Bun.file(`./dist/${metaName}/LICENSE`).write(await Bun.file("../../LICENSE").text())
await Bun.file(`./dist/${metaName}/bin/codewright.exe`).write(
  [
    `echo "Error: ${metaName}'s postinstall script was not run." >&2`,
    'echo "" >&2',
    'echo "This occurs when using --ignore-scripts during installation, or when using a" >&2',
    'echo "package manager like pnpm that does not run postinstall scripts by default." >&2',
    'echo "" >&2',
    'echo "To fix this, run the postinstall script manually:" >&2',
    `echo "  cd node_modules/${metaName} && node postinstall.mjs" >&2`,
    'echo "" >&2',
    `echo "Or reinstall ${metaName} without the --ignore-scripts flag." >&2`,
    "exit 1",
    "",
  ].join("\n"),
)

await Bun.file(`./dist/${metaName}/package.json`).write(
  JSON.stringify(
    {
      name: metaName,
      bin: {
        codewright: "./bin/codewright.exe",
      },
      scripts: {
        postinstall: "node ./postinstall.mjs",
      },
      version: version,
      license: pkg.license,
      os: ["darwin", "linux", "win32"],
      cpu: ["arm64", "x64"],
      optionalDependencies: binaries,
    },
    null,
    2,
  ),
)

const tasks = Object.entries(binaries).map(async ([name]) => {
  await publish(`./dist/${name}`, name, binaries[name])
})
await Promise.all(tasks)
await publish(`./dist/${metaName}`, metaName, version)
