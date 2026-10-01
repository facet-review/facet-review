import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, CSP_DIRECTIVES } from './csp';

describe('content security policy', () => {
  it('allows connections only to the app itself and the OpenAlex API', () => {
    expect(CSP_DIRECTIVES['connect-src']).toEqual(["'self'", 'https://api.openalex.org']);
  });

  it('loads scripts, styles and fonts only from the app (no CDN, no inline code)', () => {
    expect(CSP_DIRECTIVES['default-src']).toEqual(["'self'"]);
    expect(CSP_DIRECTIVES['style-src']).toEqual(["'self'"]);
    expect(CSP_DIRECTIVES['font-src']).toEqual(["'self'"]);
    expect(CSP_DIRECTIVES['script-src']).toEqual(["'self'", "'wasm-unsafe-eval'"]);
    expect(CSP_DIRECTIVES['object-src']).toEqual(["'none'"]);
  });

  it('never contains unsafe-inline, unsafe-eval or wildcards', () => {
    const policy = contentSecurityPolicy();
    expect(policy).not.toMatch(
      /'unsafe-inline'|'unsafe-eval'|\*|https?:(?!\/\/api\.openalex\.org)/,
    );
  });

  it('serialises every directive once', () => {
    const policy = contentSecurityPolicy();
    expect(policy.split('; ')).toHaveLength(Object.keys(CSP_DIRECTIVES).length);
    expect(policy).toContain("connect-src 'self' https://api.openalex.org");
  });
});
