export function StatusMessage({ message, tone = 'danger' }: { message: string; tone?: 'danger' | 'success' }) {
  return <div className={`status-message ${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>{message}</div>
}
