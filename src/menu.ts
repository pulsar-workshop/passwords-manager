import { tr } from "./i18n.ts"
import { app } from "./state.ts"

export const installMenu = (): void => {
  app.setMenu([
    {
      label: tr("Пароли"),
      items: [
        { id: "new-entry", label: tr("Новая запись"), shortcut: "Ctrl+N" },
        { id: "sync-now", label: tr("Синхронизировать"), shortcut: "Ctrl+R" },
        { id: "lock", label: tr("Заблокировать"), shortcut: "Ctrl+L" },
        { separator: true },
        { id: "settings", label: tr("Настройки…"), shortcut: "Ctrl+," },
        { separator: true },
        { id: "quit", label: tr("Выход"), shortcut: "Ctrl+Q" },
      ],
    },
  ])
}
