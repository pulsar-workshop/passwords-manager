import { Box, Column, Icon, Input, Page, Row, Spacer, Text, component, signal } from "pulsar"
import { tr } from "../i18n.ts"
import { submitLock } from "../session.ts"
import { ui } from "../state.ts"
import { accentColor, backgroundColor, borderColor, dangerColor, surfaceColor, textColor } from "../theme.ts"
import { accentButton, iconTile, screenMotion } from "./kit.ts"

const hint = () => {
  if (ui.lockMode === "create") {
    return tr("Придумайте мастер-пароль. Его нельзя восстановить: без него записи не открыть.")
  }

  if (ui.lockMode === "join") return tr("Хранилище уже есть на сервере. Введите его мастер-пароль.")

  return tr("Введите мастер-пароль.")
}

const submitLabel = () => {
  if (ui.unlocking) return tr("Открываю…")

  return ui.lockMode === "create" ? tr("Создать хранилище") : tr("Открыть")
}

const focusRepeat = signal(false)

const submitMaster = () => {
  if (ui.lockMode === "create" && !ui.lockRepeat) {
    focusRepeat.set(true)

    return
  }

  void submitLock()
}

export const LockPage = component(() => {
  const creating = ui.lockMode === "create"

  return Box(
    { key: "lock", fill: true, color: backgroundColor(), ...screenMotion },
    Page(
      {
        padding: 16,
        gap: 12,
        overscroll: false,
        header: Row(
          { fillWidth: true },
          Spacer({ fillWidth: true }),
          iconTile({ icon: "settings", tooltip: tr("Настройки"), onClick: () => (ui.settingsOpen = true) }),
        ),
      },
      Row(
        { fillWidth: true, justify: "center" },
        Column(
          { gap: 14, fillWidth: true, maxWidth: 380, paddingTop: 40 },
          Row(
            { fillWidth: true, justify: "center" },
            Column(
              {
                width: 64,
                height: 64,
                radius: 16,
                color: surfaceColor(),
                borderWidth: 1,
                borderColor: borderColor(),
                justify: "center",
                alignItems: "center",
              },
              Icon({ name: creating ? "shield" : "lock", size: 30, color: accentColor() }),
            ),
          ),
          Text({
            text: tr("Пароли"),
            size: 22,
            weight: "semibold",
            color: textColor(false),
            align: "center",
            fillWidth: true,
          }),
          Text({ text: hint(), size: 13, color: textColor(true), align: "center", wrap: true, fillWidth: true }),
          Input({
            key: `master-${ui.lockMode}`,
            value: ui.lockPassword,
            placeholder: tr("Мастер-пароль"),
            variant: "outline",
            textColor: textColor(false),
            password: true,
            autoFocus: true,
            fillWidth: true,
            onInput: (value) => (ui.lockPassword = value),
            onSubmitted: submitMaster,
          }),
          creating
            ? Input({
                key: "master-repeat",
                value: ui.lockRepeat,
                placeholder: tr("Повторите мастер-пароль"),
                variant: "outline",
                textColor: textColor(false),
                password: true,
                fillWidth: true,
                focus: focusRepeat.get(),
                onFocus: () => focusRepeat.set(false),
                onInput: (value) => (ui.lockRepeat = value),
                onSubmitted: () => void submitLock(),
              })
            : null,
          ui.lockError ? Text({ text: ui.lockError, size: 12, color: dangerColor() }) : null,
          accentButton({
            label: submitLabel(),
            icon: creating ? "add_moderator" : "lock_open",
            onClick: () => void submitLock(),
          }),
        ),
      ),
    ),
  )
})
