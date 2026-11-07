import {
  Box,
  Button,
  Column,
  Icon,
  Input,
  Page,
  Row,
  Spacer,
  Text,
  component,
  scanner,
  signal,
  type UiNode,
} from "pulsar"
import { tr } from "../i18n.ts"
import { submitLock, unlockWithBiometric } from "../session.ts"
import { ui } from "../state.ts"
import { connectToServer, parsePairing } from "../sync.ts"
import { accentColor, backgroundColor, borderColor, dangerColor, surfaceColor, textColor } from "../theme.ts"
import { accentButton, iconTile, screenMotion } from "./kit.ts"

const hint = () => {
  if (ui.lockMode === "choose")
    return tr("Новое хранилище — для первого устройства. Если пароли уже есть на другом, подключитесь к нему.")
  if (ui.lockMode === "create")
    return tr("Придумайте мастер-пароль. Его нельзя восстановить: без него записи не открыть.")
  if (ui.lockMode === "connect")
    return tr("Отсканируйте QR-код из настроек на другом устройстве или введите данные сервера.")
  if (ui.lockMode === "join") return tr("Хранилище уже есть на сервере. Введите его мастер-пароль.")

  return tr("Введите мастер-пароль.")
}

const submitLabel = () => {
  if (ui.unlocking) return tr("Открываю…")

  return ui.lockMode === "create" ? tr("Создать хранилище") : tr("Открыть")
}

const iconFor = () => {
  if (ui.lockMode === "choose" || ui.lockMode === "create") return "shield"
  if (ui.lockMode === "connect") return "devices"

  return "lock"
}

const focusRepeat = signal(false)

const submitMaster = () => {
  if (ui.lockMode === "create" && !ui.lockRepeat) {
    focusRepeat.set(true)

    return
  }

  void submitLock()
}

const backToChoice = () => {
  ui.lockMode = "choose"
  ui.lockError = ""
  ui.connectError = ""
}

const connect = async () => {
  if (ui.connecting) return

  ui.connecting = true
  ui.connectError = ""

  try {
    const error = await connectToServer({
      host: ui.connectHost.trim(),
      port: ui.connectPort,
      password: ui.connectPassword,
    })

    ui.connectError = error ?? ""
  } finally {
    ui.connecting = false
  }
}

const scan = async () => {
  const text = await scanner.scan({ title: tr("Наведите камеру на QR-код"), cancel: tr("Отмена") })

  if (!text) return

  const settings = parsePairing(text)

  if (!settings) {
    ui.connectError = tr("Это не QR-код менеджера паролей")

    return
  }

  ui.connectHost = settings.host
  ui.connectPort = settings.port
  ui.connectPassword = settings.password

  await connect()
}

const field = (key: string, value: string, placeholder: string, onInput: (value: string) => void, secret = false) => {
  return Input({
    key,
    value,
    placeholder,
    variant: "outline",
    textColor: textColor(false),
    password: secret,
    fillWidth: true,
    onInput,
  })
}

const chooseControls = (): UiNode[] => {
  return [
    accentButton({ label: tr("Новое хранилище"), icon: "add_moderator", onClick: () => (ui.lockMode = "create") }),
    Button(
      { variant: "outline", icon: "devices", fillWidth: true, onClick: () => (ui.lockMode = "connect") },
      tr("Подключиться к существующему"),
    ),
  ]
}

const connectControls = (): UiNode[] => {
  return [
    ui.scannerAvailable
      ? accentButton({ label: tr("Сканировать QR-код"), icon: "qr_code_scanner", onClick: () => void scan() })
      : null,
    field("connect-host", ui.connectHost, tr("Адрес"), (value) => (ui.connectHost = value)),
    field("connect-port", ui.connectPort, tr("Порт"), (value) => (ui.connectPort = value)),
    field(
      "connect-password",
      ui.connectPassword,
      tr("Пароль сервера (необязательно)"),
      (value) => (ui.connectPassword = value),
      true,
    ),
    ui.connectError
      ? Text({ text: ui.connectError, size: 12, color: dangerColor(), wrap: true, fillWidth: true })
      : null,
    Button(
      {
        variant: ui.scannerAvailable ? "outline" : "solid",
        icon: "link",
        fillWidth: true,
        onClick: () => void connect(),
      },
      ui.connecting ? tr("Подключаюсь…") : tr("Подключиться"),
    ),
  ].filter((node): node is UiNode => node !== null)
}

const masterControls = (): UiNode[] => {
  const creating = ui.lockMode === "create"

  return [
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
    ui.biometricEnabled && ui.lockMode === "unlock"
      ? Button(
          { variant: "outline", icon: "fingerprint", fillWidth: true, onClick: () => void unlockWithBiometric() },
          tr("Войти по отпечатку"),
        )
      : null,
  ].filter((node): node is UiNode => node !== null)
}

const controls = (): UiNode[] => {
  if (ui.lockMode === "choose") return chooseControls()
  if (ui.lockMode === "connect") return connectControls()

  return masterControls()
}

export const LockPage = component(() => {
  const canGoBack = ui.lockMode === "create" || ui.lockMode === "connect"

  return Box(
    { key: "lock", fill: true, color: backgroundColor(), ...screenMotion },
    Page(
      {
        padding: 16,
        gap: 12,
        overscroll: false,
        header: Row(
          { fillWidth: true },
          canGoBack ? iconTile({ icon: "arrow_back", tooltip: tr("Назад"), onClick: backToChoice }) : null,
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
              Icon({ name: iconFor(), size: 30, color: accentColor() }),
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
          ...controls(),
        ),
      ),
    ),
  )
})
