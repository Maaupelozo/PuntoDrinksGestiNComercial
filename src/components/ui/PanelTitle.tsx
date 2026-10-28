import { Icon } from "./Icon"

export function PanelTitle({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: string
}) {
  return (
    <div className="panel-title">
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && (
        <button>
          {action} <Icon name="chevron" size={14} />
        </button>
      )}
    </div>
  )
}
