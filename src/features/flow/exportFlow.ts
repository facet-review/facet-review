import plex400 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2?url';
import plex600 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2?url';
import { createElement } from 'react';
import { FlowSvg } from './FlowSvg';
import type { FlowLayout } from './layout';

/**
 * Exports of the diagram (PRD Modul 5): SVG with embedded fonts so it looks
 * the same everywhere, PNG at twice the size, CSV. Everything happens in the
 * browser; nothing is sent anywhere.
 */

async function dataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('font'));
    reader.readAsDataURL(blob);
  });
}

async function fontCss(): Promise<string> {
  const [regular, bold] = await Promise.all([dataUrl(plex400), dataUrl(plex600)]);
  return [
    `@font-face{font-family:'IBM Plex Sans';font-weight:400;src:url(${regular}) format('woff2')}`,
    `@font-face{font-family:'IBM Plex Sans';font-weight:600;src:url(${bold}) format('woff2')}`,
  ].join('');
}

/** Standalone SVG document (print colours, fonts embedded, attribution in the footer). */
export async function svgDocument(layout: FlowLayout, title: string): Promise<string> {
  // react-dom/server is only needed here: loaded on demand, not in the main bundle.
  const [{ renderToStaticMarkup }, css] = await Promise.all([
    import('react-dom/server'),
    fontCss(),
  ]);
  const markup = renderToStaticMarkup(
    createElement(FlowSvg, { layout, palette: 'print', title, fontCss: css }),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`;
}

/** PNG at twice the layout size, rendered from the SVG document. */
export async function pngBlob(svg: string, layout: FlowLayout): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = layout.width * 2;
    canvas.height = layout.height * 2;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas not available');
    context.scale(2, 2);
    context.drawImage(image, 0, 0, layout.width, layout.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function download(content: Blob | string, fileName: string, type: string) {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
