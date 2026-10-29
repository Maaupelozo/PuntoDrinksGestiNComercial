import { money, moneyOrPending } from '../utils/money'
import type { DateRange, FinancialReport } from '../types/finance'

export function financialSummaryRows(report: FinancialReport): [string, number | null][] {
  const value = report.summary
  return [
    ['Ingresos por ventas', value.revenue],
    ['Costo de mercadería vendida', value.cogs],
    ['Ganancia bruta', value.gross_profit],
    ['Gastos operativos', value.expenses],
    ['Resultado neto operativo', value.net_operating_result],
    ['Compras de mercadería (separadas)', value.purchases],
    ['Balance de importes (no caja conciliada)', value.cashflow_estimate],
  ]
}
const amount = (value: number) => Number(value).toFixed(2).replace('.', ',')
function cell(value: string) {
  const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}
const line = (values: (string | number | null)[]) => values.map(value =>
  value === null ? cell('Pendiente') : typeof value === 'number' ? amount(value) : cell(value)).join(';')

export function buildReportCsv(report: FinancialReport, range: DateRange) {
  const lines = [
    'sep=;', line(['Punto Drinks', 'Reporte financiero']), line(['Período', range.label]),
    '', line(['Resumen', 'Importe (ARS)']),
    ...financialSummaryRows(report).map(([label, value]) => line([label, value])),
    ...(report.historical ? [line(['Histórico incluido', `${report.historical.sale_rows} renglones de venta; ${report.historical.expense_rows} gastos; ${report.historical.purchase_rows} compras`]),
      line(['Nota', 'Los costos históricos y el ticket promedio están pendientes. El flujo es una diferencia de importes, no caja conciliada.'])] : []),
    '', line(['Fecha', 'Ventas', 'Costo vendido', 'Ganancia bruta', 'Gastos operativos',
      'Resultado operativo', 'Compras de mercadería', 'Balance de importes', 'Operaciones/renglones']),
    ...report.daily.map(day => line([day.date, day.revenue, day.cogs, day.gross_profit,
      day.expenses, day.gross_profit === null ? null : day.gross_profit - day.expenses, day.purchases,
      day.revenue - day.purchases - day.expenses, day.sales_count])),
    '', line(['Categoría de gasto', 'Importe (ARS)', 'Registros']),
    ...report.expense_categories.map(item => line([item.category, item.total, item.count])),
    '', line(['Producto vendido', 'Unidades', 'Ingreso individual (ARS)']),
    ...report.top_products.map(item => line([item.name, item.units, item.direct_revenue])),
    '', line(['Producto comprado', 'Unidades', 'Total invertido (ARS)']),
    ...report.top_purchased.map(item => line([item.name, item.units, item.total])),
  ]
  return `\ufeff${lines.join('\r\n')}\r\n`
}

export function downloadReportCsv(report: FinancialReport, range: DateRange) {
  const blob = new Blob([buildReportCsv(report, range)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `punto-drinks-reporte-${range.start}-${range.endExclusive}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function buildReportPdf(report: FinancialReport, range: DateRange) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  pdf.setFont('helvetica', 'bold').setFontSize(19).setTextColor(214, 40, 40)
  pdf.text('PUNTO DRINKS', 18, 22)
  pdf.setFont('helvetica', 'normal').setFontSize(10).setTextColor(70, 70, 75)
  pdf.text('Reporte financiero', 18, 31)
  pdf.text(`Período: ${range.label}`, 18, 39)
  pdf.text(`Generado: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Cordoba' })}`, 18, 46)
  pdf.setDrawColor(220, 222, 225).line(18, 52, 192, 52)
  let y = 62
  for (const [label, value] of financialSummaryRows(report)) {
    if (label.startsWith('Compras')) {
      y += 4
      pdf.setDrawColor(220, 222, 225).line(18, y - 5, 192, y - 5)
    }
    pdf.setFont('helvetica', label === 'Resultado neto operativo' ? 'bold' : 'normal')
      .setFontSize(label === 'Resultado neto operativo' ? 12 : 10)
      .setTextColor(label === 'Resultado neto operativo' ? 214 : 35, 35, 39)
    pdf.text(label, 18, y)
    pdf.text(moneyOrPending(value).replace(/\u00a0|\u202f/g, ' '), 192, y, { align: 'right' })
    y += label === 'Resultado neto operativo' ? 13 : 10
  }
  pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor(95, 95, 100)
  pdf.text(`${report.historical?.sale_rows ? 'Operaciones y renglones históricos' : 'Ventas confirmadas'}: ${report.summary.sales_count}  |  Ticket promedio: ${moneyOrPending(report.summary.average_ticket)}`, 18, y + 8)
  pdf.text(report.historical?.sale_rows ? 'Ganancia pendiente: faltan costos de ventas históricas.' : 'Resultado operativo antes de impuestos y ajustes contables.', 18, y + 18)
  pdf.text('El flujo es una diferencia de importes, no un saldo de caja conciliado.', 18, y + 24)
  pdf.text('Las compras de mercadería no se descuentan dos veces de la ganancia.', 18, y + 30)
  return pdf
}
export async function downloadReportPdf(report: FinancialReport, range: DateRange) {
  const pdf = await buildReportPdf(report, range)
  pdf.save(`punto-drinks-reporte-${range.start}-${range.endExclusive}.pdf`)
}
