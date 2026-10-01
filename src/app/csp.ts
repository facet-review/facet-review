/**
 * Content Security Policy (PRD §6): the promise "no data leaves the browser
 * except to OpenAlex during an active search" is enforced by the browser, not
 * only stated. GitHub Pages cannot send headers, so the build writes the policy
 * as a <meta> tag into index.html (and thus 404.html); see vite.config.ts.
 * The dev server runs without it (inline styles and the HMR socket).
 */
export const OPENALEX_ORIGIN = 'https://api.openalex.org';

export const CSP_DIRECTIVES: Readonly<Record<string, readonly string[]>> = {
  'default-src': ["'self'"],
  // The only connection besides the app itself.
  'connect-src': ["'self'", OPENALEX_ORIGIN],
  // 'wasm-unsafe-eval' lets the PDF export compile its layout engine (Yoga,
  // WebAssembly). It does not allow eval() or inline scripts.
  'script-src': ["'self'", "'wasm-unsafe-eval'"],
  'style-src': ["'self'"],
  'font-src': ["'self'"],
  // data:/blob: for the PNG export of the flow diagram and file downloads.
  'img-src': ["'self'", 'data:', 'blob:'],
  'worker-src': ["'self'"],
  'manifest-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

export function contentSecurityPolicy(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}
