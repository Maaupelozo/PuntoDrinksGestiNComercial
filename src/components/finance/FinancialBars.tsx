import { money } from '../../utils/money'
import { groupFinancialDays, type Grouping } from '../../lib/finance-rules'
import type { FinancialDay } from '../../types/finance'

export function FinancialBars({ days, grouping = 'day', showExpenses = false }: {
  days: FinancialDay[]; grouping?: Grouping; showExpenses?: boolean
}) {
  const values = groupFinancialDays(days, grouping)
  const max = Math.max(1, ...values.flatMap(value =>
    showExpenses ? [value.revenue, value.expenses, value.purchases] : [value.revenue]))
  return <div className="finance-chart" role="img" aria-label={showExpenses ? 'Ingresos, compras y gastos del período' : 'Evolución de ventas del período'}>
    {values.map(value => <div className="finance-chart-column" key={value.key} title={`${value.key}: ventas ${money(value.revenue)}, compras ${money(value.purchases)}, gastos ${money(value.expenses)}`}>
      <div className="finance-chart-bars"><span className="revenue" style={{ height: `${Math.max(value.revenue ? 2 : 0, value.revenue / max * 100)}%` }}/>
        {showExpenses && <><span className="purchases" style={{ height: `${Math.max(value.purchases ? 2 : 0, value.purchases / max * 100)}%` }}/><span className="expenses" style={{ height: `${Math.max(value.expenses ? 2 : 0, value.expenses / max * 100)}%` }}/></>}</div>
      <small>{grouping === 'month' ? value.key : value.key.slice(5)}</small>
    </div>)}
    {!values.some(value => value.revenue || value.purchases || value.expenses) && <div className="empty-state">Sin movimientos en este período.</div>}
  </div>
}
