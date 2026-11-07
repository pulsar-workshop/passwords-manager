import { setLocale, setMessages, signal, storage, system, t } from "pulsar"

export type Language = "ru" | "en"

const STORAGE_KEY = "language"

export const language = signal<Language>("ru")

const EN: Record<string, string> = {
  Пароли: "Passwords",
  Запись: "Entry",
  "Новая запись": "New entry",
  Добавить: "Add",
  Синхронизировать: "Sync now",
  "Настройки…": "Settings…",
  Настройки: "Settings",
  Заблокировать: "Lock",
  Выход: "Quit",
  Синхронизация: "Sync",
  "Сервер недоступен": "Server unavailable",
  Синхронизировано: "Synced",
  Ожидание: "Waiting",
  "Синхронизация выключена": "Sync is off",
  "На сервере другое хранилище": "The server holds another vault",
  "Записей: {count}": "Entries: {count}",
  "Записей: {count} · {sync}": "Entries: {count} · {sync}",
  "Сменить тему": "Switch theme",
  Поиск: "Search",
  "Пока пусто": "Nothing here yet",
  "Добавьте первый пароль.": "Add the first password.",
  "Ничего не найдено": "Nothing found",
  "Измените запрос.": "Change the search.",
  Название: "Title",
  Логин: "Username",
  Пароль: "Password",
  Сайт: "Website",
  Заметки: "Notes",
  Назад: "Back",
  Сохранить: "Save",
  Удалить: "Delete",
  "Удалить запись?": "Delete the entry?",
  "Запись нельзя будет восстановить.": "The entry cannot be restored.",
  "Название не может быть пустым": "The title cannot be empty",
  "Скопировать логин": "Copy the username",
  "Скопировать пароль": "Copy the password",
  "Показать пароль": "Show the password",
  "Скрыть пароль": "Hide the password",
  Сгенерировать: "Generate",
  "Логин скопирован": "Username copied",
  "Пароль скопирован, буфер очистится через 30 с": "Password copied; the clipboard clears in 30 s",
  "Изменено: {date}": "Changed: {date}",
  "Мастер-пароль": "Master password",
  "Повторите мастер-пароль": "Repeat the master password",
  "Создать хранилище": "Create the vault",
  Открыть: "Unlock",
  "Открываю…": "Unlocking…",
  "Придумайте мастер-пароль. Его нельзя восстановить: без него записи не открыть.":
    "Choose a master password. It cannot be recovered: without it the entries stay locked.",
  "Введите мастер-пароль.": "Enter the master password.",
  "Хранилище уже есть на сервере. Введите его мастер-пароль.":
    "The server already holds a vault. Enter its master password.",
  "Неверный мастер-пароль": "Wrong master password",
  "Пароли не совпадают": "The passwords do not match",
  "Мастер-пароль — не короче 8 символов": "The master password needs at least 8 characters",
  "Порт должен быть от 1 до 65535": "The port must be from 1 to 65535",
  "ОТПЕЧАТОК ПАЛЬЦА": "FINGERPRINT",
  "Включить вход по отпечатку": "Unlock with a fingerprint",
  "Выключить вход по отпечатку": "Stop unlocking with a fingerprint",
  "Войти по отпечатку": "Unlock with a fingerprint",
  "Открыть пароли": "Unlock passwords",
  "Ввести мастер-пароль": "Use the master password",
  ЯЗЫК: "LANGUAGE",
  СЕРВЕР: "SERVER",
  Адрес: "Address",
  Порт: "Port",
  "Пароль сервера (необязательно)": "Server password (optional)",
  "Пустой адрес выключает синхронизацию. Сервер хранит только зашифрованные записи.":
    "An empty address turns sync off. The server keeps encrypted entries only.",
}

/** Translates a Russian UI string; it reads the language, so screens redraw when it changes. */
export const tr = (text: string, params: Record<string, string | number> = {}): string => {
  return t(text, params, text)
}

export const setLanguage = (next: Language): void => {
  language.set(next)
  setLocale(next)
  setMessages(next === "en" ? EN : {})
  void storage.set(STORAGE_KEY, next)
}

/** The saved language, or the system one: Russian for Russian systems, English otherwise. */
export const initLanguage = async (): Promise<void> => {
  const saved = await storage.get(STORAGE_KEY).catch(() => null)

  if (saved === "ru" || saved === "en") {
    setLanguage(saved)

    return
  }

  const locale = await system
    .locale()
    .then((info) => info.locale)
    .catch(() => "ru")

  setLanguage(locale.toLowerCase().startsWith("ru") ? "ru" : "en")
}
