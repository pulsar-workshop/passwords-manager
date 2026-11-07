import { effect } from "pulsar"
import { initLanguage, language } from "./i18n.ts"
import { installMenu } from "./menu.ts"
import { closeDraft, lock, lockWhenIdle, openDraft, setSessionHooks } from "./session.ts"
import { app, state, ui } from "./state.ts"
import { flushState, loadSyncSettings, restore } from "./storage.ts"
import { setStatus } from "./sync-status.ts"
import { markDirty, probeServer, pull, push, syncNow } from "./sync.ts"
import { watchTheme } from "./theme.ts"
import { renderApp } from "./ui/app.ts"

const SYNC_INTERVAL_MS = 4000
const AWAY_LOCK_MS = 60_000

const sync = () => {
  if (!state.syncSettings.host) return

  if (state.sync.dirty) {
    void push()

    return
  }

  void pull()
}

const handleBack = () => {
  if (ui.settingsOpen) {
    ui.settingsOpen = false

    return
  }

  if (ui.draft) {
    closeDraft()

    return
  }

  void flushState().finally(() => app.quit())
}

setSessionHooks({
  changed: () => {
    markDirty()
    void push()
  },
  unlocked: sync,
  checkServer: probeServer,
})

app.on("back-pressed", handleBack)
app.on("menu", (payload: { id?: unknown }) => {
  const id = typeof payload?.id === "string" ? payload.id : ""

  if (id === "new-entry" && !ui.locked) openDraft(null)
  if (id === "lock") lock()
  if (id === "settings") ui.settingsOpen = true
  if (id === "sync-now") void syncNow()
  if (id === "quit") app.quit()
})
let pausedAT = 0

// Copying a password into another app leaves this one for a moment; a longer absence locks it.
app.on("app-pause", () => {
  pausedAT = Date.now()
  void flushState()
})
app.on("app-resume", () => {
  if (pausedAT && Date.now() - pausedAT > AWAY_LOCK_MS) lock()

  pausedAT = 0
})
app.on("power-resume", () => {
  lock()
  sync()
})

const start = async (): Promise<void> => {
  await initLanguage()

  // The native menu is not part of the rendered tree, so it is rebuilt when the language changes.
  effect(() => {
    language.get()
    installMenu()
  })

  await loadSyncSettings()
  await restore()
  await watchTheme()

  setStatus(state.syncSettings.host ? "idle" : "off")

  app.window("main").render(renderApp)
  app.run()

  if (!state.vault) void probeServer()

  setInterval(() => {
    lockWhenIdle()
    sync()
  }, SYNC_INTERVAL_MS)
}

void start()
