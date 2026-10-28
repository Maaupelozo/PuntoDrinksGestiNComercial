export function LoadingRows({ count = 4 }: { count?: number }) {
  return <div className="loading-rows" aria-label="Cargando datos" role="status">
    {Array.from({ length: count }, (_, index) => <div className="loading-row" key={index}><span/><span/><span/></div>)}
  </div>
}
