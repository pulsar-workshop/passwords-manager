import { Card, Column, Row, Text, component } from "pulsar"
import { tr } from "../i18n.ts"
import { copySecret, openDraft, openSite } from "../session.ts"
import { accentColor, borderColor, hoverSurfaceColor, surfaceColor, textColor } from "../theme.ts"
import type { Entry } from "../types.ts"
import { iconTile } from "./kit.ts"

const hostOf = (URL: string) => {
  return URL.replace(/^[a-z]+:\/\//i, "").replace(/\/.*$/, "")
}

const subtitle = (entry: Entry) => {
  return [entry.username, hostOf(entry.URL)].filter(Boolean).join(" · ")
}

const avatar = (entry: Entry) => {
  const letter = [...entry.title.trim()][0]?.toUpperCase() ?? "?"

  return Column(
    {
      width: 36,
      height: 36,
      radius: 8,
      borderWidth: 1,
      borderColor: borderColor(),
      justify: "center",
      alignItems: "center",
    },
    Text({ text: letter, size: 15, weight: "semibold", color: accentColor() }),
  )
}

export const EntryRow = component<{ key: string; entry: Entry; visible: boolean }>(({ entry, visible }) => {
  const details = subtitle(entry)

  return Card(
    {
      key: entry.ID,
      visible,
      padding: 2,
      radius: 10,
      elevation: 0,
      color: surfaceColor(),
      hoverColor: hoverSurfaceColor(),
      borderColor: borderColor(),
      borderWidth: 1,
      pressed: { color: hoverSurfaceColor() },
      enter: { opacity: 0 },
      exit: { opacity: 0 },
      transition: { duration: 180 },
      onClick: () => openDraft(entry),
    },
    Row(
      { gap: 10, paddingLeft: 8, paddingY: 6, paddingRight: 4, fillWidth: true, alignItems: "center" },
      avatar(entry),
      Column(
        { gap: 2, flex: 1, fillWidth: true },
        Text({
          text: entry.title,
          size: 14,
          weight: "medium",
          color: textColor(false),
          fillWidth: true,
          maxLines: 1,
          elide: "right",
        }),
        details
          ? Text({ text: details, size: 12, color: textColor(true), fillWidth: true, maxLines: 1, elide: "right" })
          : null,
      ),
      entry.URL
        ? iconTile({
            icon: "open_in_new",
            tooltip: tr("Открыть сайт"),
            onClick: () => openSite(entry.URL),
          })
        : null,
      entry.username
        ? iconTile({
            icon: "person",
            tooltip: tr("Скопировать логин"),
            onClick: () => void copySecret(entry.username, tr("Логин скопирован"), false),
          })
        : null,
      entry.password
        ? iconTile({
            icon: "key",
            tooltip: tr("Скопировать пароль"),
            onClick: () => void copySecret(entry.password, tr("Пароль скопирован, буфер очистится через 30 с"), true),
          })
        : null,
    ),
  )
})
