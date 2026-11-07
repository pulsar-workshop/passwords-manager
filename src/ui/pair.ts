import { Box, Column, Page, QrCode, Row, Spacer, Text, component, signal } from "pulsar"
import { tr } from "../i18n.ts"
import { ui } from "../state.ts"
import { pairingLink } from "../sync.ts"
import { backgroundColor, textColor } from "../theme.ts"
import { iconTile, screenMotion } from "./kit.ts"

const closePair = () => {
  ui.pairOpen = false
}

/** Shows a QR code with the server address and password for a phone to scan. */
export const PairPage = component(() => {
  const link = signal<string | null | undefined>(undefined)

  void pairingLink().then((value) => link.set(value))

  return () => {
    const value = link.get()
    const address = value ? value.replace(/^pmsync:\/\//, "").replace(/\?.*$/, "") : ""

    let body = Text({ text: tr("Готовлю код…"), size: 13, color: textColor(true) })

    if (value === null) {
      body = Text({
        text: tr("Не удалось узнать адрес этого компьютера в сети. Укажите его в настройках сервера вместо 127.0.0.1."),
        size: 13,
        color: textColor(true),
        wrap: true,
        fillWidth: true,
      })
    }

    if (value) {
      body = Column(
        { gap: 14, alignItems: "center", fillWidth: true },
        Box({ padding: 12, radius: 12, color: "#ffffff" }, QrCode({ value, size: 240 })),
        Text({ text: address, size: 13, color: textColor(true) }),
      )
    }

    return Box(
      { key: "pair", fill: true, color: backgroundColor(), ...screenMotion },
      Page(
        {
          padding: 16,
          gap: 16,
          overscroll: false,
          header: Row(
            { gap: 6, fillWidth: true, alignItems: "center" },
            iconTile({ icon: "arrow_back", tooltip: tr("Назад"), onClick: closePair }),
            Text({ text: tr("Подключить устройство"), size: 20, weight: "semibold", color: textColor(false) }),
            Spacer({ fillWidth: true }),
          ),
        },
        Text({
          text: tr(
            "На телефоне откройте менеджер, выберите «Подключиться к существующему» и отсканируйте код. Затем введите мастер-пароль.",
          ),
          size: 13,
          color: textColor(true),
          wrap: true,
          fillWidth: true,
        }),
        body,
        Text({
          text: tr("Код содержит адрес и пароль сервера, но не мастер-пароль и не записи."),
          size: 12,
          color: textColor(true),
          wrap: true,
          fillWidth: true,
        }),
      ),
    )
  }
})
