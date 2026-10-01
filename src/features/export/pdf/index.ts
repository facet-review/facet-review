import regular from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff?url';
import italic from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-italic.woff?url';
import bold from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff?url';
import { createElement } from 'react';
import type { AppendixPdfProps, ChecklistPdfProps } from './documents';

/** Loads react-pdf and the documents on first use only. */
async function load() {
  const [documents, runtime] = await Promise.all([import('./documents'), import('./runtime')]);
  runtime.registerFonts({ regular, bold, italic });
  return { ...documents, toBlob: runtime.toBlob };
}

export async function checklistPdf(props: ChecklistPdfProps): Promise<Blob> {
  const { ChecklistPdf, toBlob } = await load();
  return toBlob(createElement(ChecklistPdf, props));
}

export async function appendixPdf(props: AppendixPdfProps): Promise<Blob> {
  const { AppendixPdf, toBlob } = await load();
  return toBlob(createElement(AppendixPdf, props));
}
