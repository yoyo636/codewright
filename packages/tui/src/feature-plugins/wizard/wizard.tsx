import type { TuiPlugin, TuiPluginApi, TuiDialogSelectOption } from "@codewright-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo, onMount } from "solid-js"
import { DEFAULT_THEMES } from "../../theme"

const id = "internal:wizard"

async function runWizard(api: TuiPluginApi) {
  // Step 1: Welcome
  await new Promise<void>((resolve) => {
    api.ui.dialog.replace(
      () => (
        <api.ui.DialogAlert
          title="Welcome to codewright!"
          message="Let's get you set up."
          onConfirm={() => resolve()}
        />
      ),
      () => resolve(),
    )
  })

  // Step 2: Theme selection
  const themeNames = Object.keys(DEFAULT_THEMES).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
  const themeOpts: TuiDialogSelectOption<string>[] = themeNames.map((name) => ({
    title: name,
    value: name,
  }))

  const themeSelected = await new Promise<string>((resolve) => {
    api.ui.dialog.setSize("large")
    api.ui.dialog.replace(
      () => (
        <api.ui.DialogSelect<string>
          title="Choose a theme"
          options={themeOpts}
          current={api.theme.selected}
          onMove={(opt) => {
            api.theme.set(opt.value)
          }}
          onSelect={(opt) => {
            api.theme.set(opt.value)
            resolve(opt.value)
          }}
        />
      ),
      () => resolve(api.theme.selected),
    )
  })
  api.theme.set(themeSelected)

  // Step 3: Super mode explanation
  const superEnabled = await new Promise<boolean>((resolve) => {
    api.ui.dialog.replace(
      () => (
        <api.ui.DialogAlert
          title="Super mode"
          message={
            "Super mode gives codewright enhanced permissions to execute commands\n" +
            "on your system. It enables features like running tests, git operations,\n" +
            "and file system modifications. This is off by default for security.\n\n" +
            "Would you like to enable super mode?"
          }
          onConfirm={() => resolve(true)}
        />
      ),
      () => resolve(false),
    )
  })

  if (superEnabled) {
    await new Promise<void>((resolve) => {
      api.ui.dialog.replace(
        () => (
          <api.ui.DialogAlert
            title="Super mode enabled"
            message="Super mode has been enabled. You can change this later in settings."
            onConfirm={() => resolve()}
          />
        ),
        () => resolve(),
      )
    })
  }

  // Step 4: Sudo config instructions
  await new Promise<void>((resolve) => {
    api.ui.dialog.replace(
      () => (
        <api.ui.DialogAlert
          title="Sudoers setup (optional)"
          message={
            "To use codewright with sudo access, add this to your sudoers file:\n\n" +
            "  username ALL=(ALL) NOPASSWD: /path/to/codewright\n\n" +
            "Run: sudo visudo\n\n" +
            "This is optional and can be skipped."
          }
          onConfirm={() => resolve()}
        />
      ),
      () => resolve(),
    )
  })

  // Step 5: Done
  api.kv.set("wizard_done", true)
  api.ui.toast({ title: "Setup complete", message: "codewright is ready to use!", variant: "success" })
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 100,
    slots: {
      home_bottom() {
        const done = createMemo(() => api.kv.get("wizard_done", false))

        onMount(() => {
          if (!done()) {
            runWizard(api)
          }
        })

        return null
      },
    },
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin