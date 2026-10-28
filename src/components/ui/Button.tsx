import type { ButtonHTMLAttributes } from "react"

export function Button({
  children,
  secondary = false,
  className = "",
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean }) {
  return (
    <button
      className={`btn ${secondary ? "btn-secondary" : ""} ${className}`}
      type={type}
      {...props}
    >
      {children}
    </button>
  )
}
