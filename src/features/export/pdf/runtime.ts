import { Font, pdf } from '@react-pdf/renderer';
import type { ReactElement } from 'react';

export interface FontFiles {
  regular: string;
  bold: string;
  italic: string;
}

export const FAMILY = 'IBM Plex Sans';
let registered = false;

export function registerFonts(files: FontFiles) {
  if (registered) return;
  Font.register({
    family: FAMILY,
    fonts: [
      { src: files.regular, fontWeight: 400 },
      { src: files.bold, fontWeight: 600 },
      { src: files.italic, fontWeight: 400, fontStyle: 'italic' },
    ],
  });
  // No hyphenation: search strings and identifiers must stay exactly as written.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

export function toBlob(document: ReactElement): Promise<Blob> {
  // react-pdf's own element types are a narrower ReactElement.
  return pdf(document as Parameters<typeof pdf>[0]).toBlob();
}
