/**
 * The Facet Review mark: a prism with three facets (same geometry as
 * public/favicon.svg and the app icons). Decorative – always next to the name.
 */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M16 3 29 27 16 19z" fill="#1f5f6b" />
      <path d="M29 27H3l13-8z" fill="#163f47" />
      <path d="M3 27 16 3v16z" fill="#5a8d97" />
    </svg>
  );
}
