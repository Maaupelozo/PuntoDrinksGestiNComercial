import { periodRange, type PeriodPreset } from '../../lib/finance-rules'
import type { DateRange } from '../../types/finance'

export function PeriodPicker({ preset, onPreset, from, to, onFrom, onTo,
  dashboard = false, error }: {
  preset: PeriodPreset; onPreset: (value: PeriodPreset) => void
  from: string; to: string; onFrom: (value: string) => void; onTo: (value: string) => void
  dashboard?: boolean; error?: string | null
}) {
  const options: [PeriodPreset, string][] = dashboard
    ? [['today', 'Hoy'], ['last7', 'Últimos 7 días'], ['month', 'Este mes'],
      ['last30', 'Últimos 30 días'], ['custom', 'Personalizado']]
    : [['today', 'Hoy'], ['yesterday', 'Ayer'], ['week', 'Esta semana'],
      ['month', 'Este mes'], ['previousMonth', 'Mes anterior'],
      ['last30', 'Últimos 30 días'], ['custom', 'Personalizado']]
  return <div className="finance-period">
    <label className="select-field">Período<select aria-label="Período financiero" value={preset} onChange={event => onPreset(event.target.value as PeriodPreset)}>
      {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    {preset === 'custom' && <><label className="select-field">Desde<input type="date" value={from} onChange={event => onFrom(event.target.value)}/></label><label className="select-field">Hasta<input type="date" min={from || undefined} value={to} onChange={event => onTo(event.target.value)}/></label></>}
    {error && <span className="form-error">{error}</span>}
  </div>
}

export function selectedRange(preset: PeriodPreset, from: string, to: string):
  { range: DateRange | null; error: string | null } {
  try { return { range: periodRange(preset, undefined, from, to), error: null } }
  catch (failure) { return { range: null, error: failure instanceof Error ? failure.message : 'Período inválido.' } }
}
