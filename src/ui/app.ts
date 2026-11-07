import { Box, Column, Icon, Page, Row, SearchField, Stack, Text, component, type UiNode } from "pulsar"
import { tr } from "../i18n.ts"
import { lock, openDraft, touch } from "../session.ts"
import { breakpoints, state, syncColor, syncLabel, ui } from "../state.ts"
import { syncNow } from "../sync.ts"
import { backgroundColor, borderColor, isDarkTheme, surfaceColor, textColor, toggleTheme } from "../theme.ts"
import type { Entry } from "../types.ts"
import { EditorPage } from "./editor.ts"
import { EntryRow } from "./entry-row.ts"
import { accentButton, iconTile } from "./kit.ts"
import { LockPage } from "./lock.ts"
import { SettingsPage } from "./settings.tsx"

const syncProblem = () => {
  return ui.syncStatus === "error" || ui.syncStatus === "conflict"
}

const openSettings = () => {
  ui.settingsOpen = true
}

const Header = component(() => {
  const compact = breakpoints.is("compact")
  const count = ui.entries.length

  return Row(
    { gap: 2, fillWidth: true, alignItems: "center" },
    Column(
      { gap: 2, flex: 1 },
      Text({ text: tr("Пароли"), size: 22, weight: "semibold", color: textColor(false) }),
      Row(
        { gap: 6, alignItems: "center" },
        Box({ width: 6, height: 6, radius: 3, color: syncColor() }),
        Text({
          // A phone hides the sync label to save room, but never a problem with sync.
          text:
            compact && !syncProblem()
              ? tr("Записей: {count}", { count })
              : tr("Записей: {count} · {sync}", { count, sync: syncLabel() }),
          size: 12,
          color: textColor(true),
        }),
      ),
    ),
    compact
      ? null
      : iconTile({
          icon: isDarkTheme() ? "light_mode" : "dark_mode",
          tooltip: tr("Сменить тему"),
          onClick: toggleTheme,
        }),
    iconTile({
      icon: "sync",
      tooltip: tr("Синхронизировать"),
      onClick: () => (state.syncSettings.host ? void syncNow() : openSettings()),
    }),
    iconTile({ icon: "settings", tooltip: tr("Настройки"), onClick: openSettings }),
    iconTile({ icon: "lock", tooltip: tr("Заблокировать"), onClick: lock }),
  )
})

const message = (icon: string, title: string, hint: string) => {
  return Column(
    { gap: 10, padding: 24, alignItems: "center", fillWidth: true },
    Column(
      {
        width: 64,
        height: 64,
        radius: 32,
        color: surfaceColor(),
        borderWidth: 1,
        borderColor: borderColor(),
        justify: "center",
        alignItems: "center",
      },
      Icon({ name: icon, size: 28, color: textColor(true) }),
    ),
    Text({ text: title, size: 17, weight: "semibold", color: textColor(false), align: "center", fillWidth: true }),
    Text({ text: hint, size: 13, color: textColor(true), align: "center", wrap: true, fillWidth: true }),
  )
}

const matches = (entry: Entry, query: string) => {
  if (!query) return true

  return `${entry.title}\n${entry.username}\n${entry.URL}`.toLowerCase().includes(query)
}

const EntryList = component(() => {
  const query = ui.query.trim().toLowerCase()
  const rows = ui.entries.map((entry) => ({ entry, visible: matches(entry, query) }))

  let empty: UiNode | null = null

  if (rows.length === 0) empty = message("key", tr("Пока пусто"), tr("Добавьте первый пароль."))
  else if (!rows.some((row) => row.visible))
    empty = message("search_off", tr("Ничего не найдено"), tr("Измените запрос."))

  return Column(
    { gap: 8, fillWidth: true },
    ...rows.map(({ entry, visible }) => EntryRow({ key: entry.ID, entry, visible })),
    empty,
  )
})

const MainPage = component(() => {
  return Box(
    { key: "main", fill: true, color: backgroundColor() },
    Page(
      {
        padding: 14,
        gap: 10,
        overscroll: false,
        header: Header({}),
        footer: accentButton({ label: tr("Новая запись"), icon: "add", onClick: () => openDraft(null) }),
      },
      SearchField({
        value: ui.query,
        placeholder: tr("Поиск"),
        fillWidth: true,
        onInput: (value) => {
          touch()
          ui.query = value
        },
      }),
      EntryList({}),
    ),
  )
})

export const renderApp = () => {
  return Stack(
    { key: "root", fill: true },
    ui.locked ? null : MainPage({}),
    ui.locked && !ui.settingsOpen ? LockPage({}) : null,
    ui.draft ? EditorPage({}) : null,
    ui.settingsOpen ? SettingsPage({}) : null,
  )
}
