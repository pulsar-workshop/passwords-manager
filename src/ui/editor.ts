import { Box, Column, Input, Page, Row, Spacer, Text, TextArea, component, getLocale } from "pulsar"
import { tr } from "../i18n.ts"
import { closeDraft, copySecret, deleteDraft, generatePassword, saveDraft, updateDraft } from "../session.ts"
import { ui } from "../state.ts"
import { backgroundColor, dangerColor, textColor } from "../theme.ts"
import { accentButton, iconTile, screenMotion } from "./kit.ts"

const header = () => {
  return Row(
    { gap: 6, fillWidth: true, alignItems: "center" },
    iconTile({ icon: "arrow_back", tooltip: tr("Назад"), onClick: closeDraft }),
    Text({
      text: ui.draftNew ? tr("Новая запись") : tr("Запись"),
      size: 20,
      weight: "semibold",
      color: textColor(false),
    }),
    Spacer({ fillWidth: true }),
    ui.draftNew
      ? null
      : iconTile({ icon: "delete", tooltip: tr("Удалить"), color: dangerColor(), onClick: () => void deleteDraft() }),
  )
}

// The outlined fields float their placeholder as a label, so rows need no titles of their own.
const field = (key: string, ...children: Parameters<typeof Row>[1][]) => {
  return Row({ key, gap: 4, fillWidth: true, alignItems: "center" }, ...children)
}

const changedLabel = (updatedAT: number) => {
  const date = new Date(updatedAT).toLocaleString(getLocale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return tr("Изменено: {date}", { date })
}

const fillPassword = async () => {
  updateDraft({ password: await generatePassword() })

  ui.showPassword = true
}

export const EditorPage = component(() => {
  const draft = ui.draft

  if (!draft) return Box({ key: "editor" })

  return Box(
    { key: "editor", fill: true, color: backgroundColor(), ...screenMotion },
    Page(
      {
        padding: 14,
        gap: 20,
        overscroll: false,
        header: header(),
        footer: accentButton({ label: tr("Сохранить"), icon: "check", onClick: () => void saveDraft() }),
      },
      // Outlined fields float their label above the border, so the first one needs room below the header.
      Box({ key: "top-gap", height: 6 }),
      field(
        "title",
        Input({
          value: draft.title,
          placeholder: tr("Название"),
          variant: "outline",
          textColor: textColor(false),
          autoFocus: ui.draftNew,
          expand: true,
          onInput: (value) => updateDraft({ title: value }),
        }),
      ),
      field(
        "username",
        Input({
          value: draft.username,
          placeholder: tr("Логин"),
          variant: "outline",
          textColor: textColor(false),
          keyboardType: "email",
          expand: true,
          onInput: (value) => updateDraft({ username: value }),
        }),
        iconTile({
          icon: "content_copy",
          tooltip: tr("Скопировать логин"),
          onClick: () => void copySecret(draft.username, tr("Логин скопирован"), false),
        }),
      ),
      field(
        "password",
        Input({
          value: draft.password,
          placeholder: tr("Пароль"),
          variant: "outline",
          textColor: textColor(false),
          password: !ui.showPassword,
          expand: true,
          onInput: (value) => updateDraft({ password: value }),
        }),
        iconTile({
          icon: ui.showPassword ? "visibility_off" : "visibility",
          tooltip: ui.showPassword ? tr("Скрыть пароль") : tr("Показать пароль"),
          onClick: () => (ui.showPassword = !ui.showPassword),
        }),
        iconTile({ icon: "casino", tooltip: tr("Сгенерировать"), onClick: () => void fillPassword() }),
        iconTile({
          icon: "content_copy",
          tooltip: tr("Скопировать пароль"),
          onClick: () => void copySecret(draft.password, tr("Пароль скопирован, буфер очистится через 30 с"), true),
        }),
      ),
      field(
        "URL",
        Input({
          value: draft.URL,
          placeholder: tr("Сайт"),
          variant: "outline",
          textColor: textColor(false),
          keyboardType: "url",
          expand: true,
          onInput: (value) => updateDraft({ URL: value }),
        }),
      ),
      Column(
        { key: "notes", fillWidth: true },
        TextArea({
          value: draft.notes,
          placeholder: tr("Заметки"),
          variant: "outline",
          textColor: textColor(false),
          lines: 4,
          fillWidth: true,
          onInput: (value) => updateDraft({ notes: value }),
        }),
      ),
      ui.draftError ? Text({ text: ui.draftError, size: 12, color: dangerColor() }) : null,
      draft.updatedAT ? Text({ text: changedLabel(draft.updatedAT), size: 12, color: textColor(true) }) : null,
    ),
  )
})
