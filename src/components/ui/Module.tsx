import type { ReactNode } from "react"
import { Icon } from "./Icon"
import { Button } from "./Button"

export function Module({
  title,
  subtitle,
  action,
  onAction,
  children,
}: {
  title: string
  subtitle: string
  action?: string
  onAction?: () => void
  children: ReactNode
}) {
  return (
    <div className="stack">
      <div className="welcome">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {action && (
          <Button onClick={onAction}>
            <Icon name="plus" size={17} />
            {action}
          </Button>
        )}
      </div>
      <section className="panel module-panel">{children}</section>
    </div>
  )
}
