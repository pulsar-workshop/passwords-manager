import { Column, Icon, Row, Text, type ColorValue, type UiNode } from "pulsar"
import { accentColor, borderColor, onAccentColor, textColor } from "../theme.ts"

export const iconTile = (options: {
  key?: string
  icon: string
  tooltip?: string
  color?: ColorValue
  size?: number
  onClick: () => void
}): UiNode => {
  const size = options.size ?? 36

  return Column(
    {
      key: options.key,
      width: size,
      height: size,
      radius: 8,
      a11yLabel: options.tooltip,
      justify: "center",
      alignItems: "center",
      // Rows use hoverSurfaceColor for their own hover, so an icon on a hovered row needs a stronger tone.
      hover: { color: borderColor() },
      pressed: { color: borderColor(), scale: 0.9 },
      transition: { duration: 120 },
      onClick: options.onClick,
    },
    Icon({ name: options.icon, size: 20, color: options.color ?? textColor(true) }),
  )
}

export const accentButton = (options: { label: string; icon?: string; onClick: () => void }): UiNode => {
  return Row(
    {
      height: 40,
      paddingX: 14,
      gap: 6,
      radius: 8,
      fillWidth: true,
      color: accentColor(),
      justify: "center",
      alignItems: "center",
      hover: { opacity: 0.9 },
      pressed: { opacity: 0.75 },
      transition: { duration: 120 },
      onClick: options.onClick,
    },
    options.icon ? Icon({ name: options.icon, size: 18, color: onAccentColor() }) : null,
    Text({ text: options.label, size: 13, weight: "semibold", color: onAccentColor() }),
  )
}

export const screenMotion = {
  enter: { opacity: 0, y: 14 },
  exit: { opacity: 0 },
  transition: { duration: 220, curve: "ease" },
} as const
