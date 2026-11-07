import { Box, Button, Input, Page, Row, Segmented, Spacer, Text, component, signal } from "pulsar"
import { DEFAULT_PORT, state, ui } from "../state.ts"
import { saveSyncConnection } from "../sync.ts"
import { backgroundColor, textColor } from "../theme.ts"
import { language, setLanguage, tr } from "../i18n.ts"
import { iconTile, screenMotion } from "./kit.ts"

const closeSettings = () => {
  ui.settingsOpen = false
}

export const SettingsPage = component(() => {
  const host = signal(state.syncSettings.host)
  const port = signal(state.syncSettings.port)
  const password = signal(state.syncSettings.password)
  const error = signal("")

  const save = async (): Promise<void> => {
    const portText = port.peek().trim() || DEFAULT_PORT
    const value = Number(portText)

    if (!Number.isInteger(value) || value < 1 || value > 65535) {
      error.set(tr("Порт должен быть от 1 до 65535"))

      return
    }

    closeSettings()

    await saveSyncConnection({
      host: host.peek().trim(),
      port: portText,
      password: password.peek(),
    })
  }

  const header = () => {
    return (
      <Row gap={6} fillWidth alignItems="center">
        {iconTile({ icon: "arrow_back", tooltip: tr("Назад"), onClick: closeSettings })}
        <Text size={20} weight="semibold" color={textColor(false)}>
          {tr("Настройки")}
        </Text>
        <Spacer fillWidth />
      </Row>
    )
  }

  const footer = () => {
    return (
      <Row fillWidth>
        <Button fillWidth onClick={() => void save()}>
          {tr("Сохранить")}
        </Button>
      </Row>
    )
  }

  return () => {
    return (
      <Box key="settings" fill color={backgroundColor()} {...screenMotion}>
        <Page padding={16} gap={10} overscroll={false} header={header()} footer={footer()}>
          <Text size={10} weight="medium" color={textColor(true)} letterSpacing={1.2}>
            {tr("ЯЗЫК")}
          </Text>
          <Segmented
            items={["Русский", "English"]}
            value={language.get() === "en" ? 1 : 0}
            fillWidth
            onChange={(index) => setLanguage(index === 1 ? "en" : "ru")}
          />
          <Text size={10} weight="medium" color={textColor(true)} letterSpacing={1.2}>
            {tr("СЕРВЕР")}
          </Text>
          <Row gap={8} fillWidth>
            <Input
              value={host.get()}
              placeholder={tr("Адрес")}
              variant="outline"
              textColor={textColor(false)}
              flex={3}
              fillWidth
              onInput={(value) => host.set(value)}
            />
            <Input
              value={port.get()}
              placeholder={tr("Порт")}
              variant="outline"
              textColor={textColor(false)}
              flex={1}
              fillWidth
              onInput={(value) => port.set(value)}
            />
          </Row>
          <Input
            value={password.get()}
            placeholder={tr("Пароль сервера (необязательно)")}
            variant="outline"
            textColor={textColor(false)}
            password
            fillWidth
            onInput={(value) => password.set(value)}
            onSubmitted={() => void save()}
          />
          {error.get() ? (
            <Text size={12} color="#ef4444">
              {error.get()}
            </Text>
          ) : null}
          <Text size={12} color={textColor(true)} wrap fillWidth>
            {tr("Пустой адрес выключает синхронизацию. Сервер хранит только зашифрованные записи.")}
          </Text>
        </Page>
      </Box>
    )
  }
})
