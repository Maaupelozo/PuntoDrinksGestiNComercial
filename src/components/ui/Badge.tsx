import type { ReactNode } from "react"

export function Badge({
  children,
  type = "neutral",
}: {
  children: ReactNode
  type?: "success" | "warning" | "danger" | "neutral" | "info"
}) {
  return <span className={`badge ${type}`}>{children}</span>
}
