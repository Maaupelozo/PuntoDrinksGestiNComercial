import type { ReactNode } from "react"

import type { IconName } from "../../types/icons"

interface IconProps {
  name: IconName
  size?: number
}

export function Icon({ name, size = 19 }: IconProps) {
  const paths: Record<IconName, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),

    sale: (
      <>
        <path d="M4 7h16l-1 13H5L4 7Z" />
        <path d="M8 7a4 4 0 0 1 8 0" />
      </>
    ),
    box: (
      <>
        <path d="m4 7 8-4 8 4-8 4-8-4Z" />
        <path d="M4 7v10l8 4 8-4V7M12 11v10" />
      </>
    ),

    chart: (
      <>
        <path d="M4 19V9m6 10V5m6 14v-7m5 7H2" />
      </>
    ),
    cart: (
      <>
        <path d="M3 4h2l2 11h11l2-7H6" />
        <circle cx="9" cy="19" r="1" />
        <circle cx="17" cy="19" r="1" />
      </>
    ),

    wallet: (
      <>
        <path d="M4 6h15a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12" />
        <path d="M16 11h5v4h-5a2 2 0 0 1 0-4Z" />
      </>
    ),

    gift: (
      <>
        <rect x="3" y="8" width="18" height="13" rx="1" />
        <path d="M12 8v13M2 8h20M12 8H8a3 3 0 1 1 4-3v3Zm0 0h4a3 3 0 1 0-4-3v3Z" />
      </>
    ),

    report: (
      <>
        <path d="M5 3h11l3 3v15H5V3Z" />
        <path d="M9 17v-4m3 4V9m3 8v-6" />
      </>
    ),
    truck: (
      <>
        <path d="M3 6h11v11H3V6Zm11 4h4l3 4v3h-7v-7Z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="17" cy="18" r="2" />
      </>
    ),

    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7L10.5 2h-3l-.7 2.3-1.7.7-1.9-.9-2.1 2.1.9 1.9-.7 1.7-2.3.7v3l2.3.7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2.3h3l.7-2.3 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7 2.3-.7Z"
          transform="translate(2) scale(.83)"
        />
      </>
    ),

    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />
      </>
    ),

    plus: <path d="M12 5v14M5 12h14" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    dots: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),

    arrow: (
      <>
        <path d="M5 12h14m-5-5 5 5-5 5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4m8-4v4M3 10h18" />
      </>
    ),

    download: (
      <>
        <path d="M12 3v12m-4-4 4 4 4-4M4 20h16" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    check: <path d="m5 12 4 4L19 6" />,

    warning: (
      <>
        <path d="M12 3 2 20h20L12 3Z" />
        <path d="M12 9v5m0 3h.01" />
      </>
    ),
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
