import { useEffect, type ReactNode } from 'react'

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal-panel panel" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-header"><h3>{title}</h3><button type="button" onClick={onClose} aria-label="Cerrar">×</button></div>
      {children}
    </section>
  </div>
}
