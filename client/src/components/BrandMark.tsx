/** Logotipo de la biblioteca (monograma SVG, mismo diseño que `public/favicon.svg`). */
export function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Escudo de la biblioteca"
    >
      <defs>
        <linearGradient id="bm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1e293b" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="bm-page" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dbe7f7" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="64" height="64" rx="14" fill="url(#bm-bg)" />
      <path
        d="M32 20.5c-4.6-3.4-9.9-4.6-15.6-4.2-1.5.1-2.6 1.3-2.6 2.8v24.4c0 1.6 1.3 2.8 2.9 2.7 5.3-.4 10.3.7 14.7 3.7 1.2.8 2.8.8 4 0 4.4-3 9.4-4.1 14.7-3.7 1.6.1 2.9-1.1 2.9-2.7V19.1c0-1.5-1.1-2.7-2.6-2.8-5.7-.4-11 .8-15.6 4.2z"
        fill="url(#bm-page)"
      />
      <path d="M32 20.5v29.4" stroke="#2c7be5" strokeWidth="3" strokeLinecap="round" />
      <g stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
        <path d="M20 27.5h7.5" />
        <path d="M20 33h7.5" />
        <path d="M20 38.5h5" />
        <path d="M36.5 27.5H44" />
        <path d="M36.5 33H44" />
        <path d="M36.5 38.5h3.5" />
      </g>
      <path d="M44 14.5v13l-4.2-3.4L35.6 27.5v-13z" fill="#2c7be5" />
    </svg>
  );
}
