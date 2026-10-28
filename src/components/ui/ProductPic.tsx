export function ProductPic({ product }: { product: { name: string; tone?: string } }) {
  return (
    <span className="product-pic" style={{ background: product.tone ?? 'var(--red)' }}>
      {product.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")}
    </span>
  )
}
