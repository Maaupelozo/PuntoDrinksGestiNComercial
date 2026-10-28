import { Icon } from "./Icon"

export function Search({
  value = "",
  onChange,
  placeholder = "Buscar...",
}: {
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="search">
      <Icon name="search" size={17} />
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}
