import type { SummaryStat } from "../../types/entities"

export function MiniStats({
  stats,
  className = "",
}: {
  stats: SummaryStat[]
  className?: string
}) {
  return (
    <div className={className ? `mini-stats ${className}` : "mini-stats"}>
      {stats.map((s) => (
        <div key={s[0]}>
          <span>{s[0]}</span>
          <strong>{s[1]}</strong>
          <small>{s[2]}</small>
        </div>
      ))}
    </div>
  )
}
