import { createRequire } from 'node:module';
import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { checklistDocument } from '../../../domain/checklist/document';
import { searchAppendix } from '../../../domain/export/searchAppendix';
import { makeLinkedBundle } from '../../../domain/testing';
import { AppendixPdf, ChecklistPdf } from './documents';
import { registerFonts } from './runtime';

const require = createRequire(import.meta.url);
const font = (file: string) => require.resolve(`@fontsource/ibm-plex-sans/files/${file}`);
registerFonts({
  regular: font('ibm-plex-sans-latin-400-normal.woff'),
  bold: font('ibm-plex-sans-latin-600-normal.woff'),
  italic: font('ibm-plex-sans-latin-400-italic.woff'),
});

const pages = (buffer: Buffer) => buffer.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0;
const pageLabel = (page: number, total: number) => `${page} / ${total}`;

describe('PDF documents (smoke tests)', () => {
  it('renders the checklist in the layout of the original on several landscape pages', async () => {
    const buffer = await renderToBuffer(
      <ChecklistPdf
        title="PRISMA 2020 Checklist"
        subtitle="Peer tutoring review"
        columns={[
          'Section and Topic',
          'Item #',
          'Checklist item',
          'Location where item is reported',
        ]}
        sections={checklistDocument(
          [{ projectId: 'p', itemId: '6', status: 'done', location: 'p. 4 – Tabelle 1' }],
          'de',
          'Nicht zutreffend',
        )}
        notice="Inoffizielle Arbeitsübersetzung."
        footer={['From: Page MJ, et al. BMJ 2021;372:n71. CC BY 4.0']}
        language="de"
        pageLabel={pageLabel}
      />,
    );
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pages(buffer)).toBeGreaterThan(1);
    expect(buffer.toString('latin1')).toContain('/Title');
  }, 30_000);

  it('renders the PRISMA-S appendix with the full search strings', async () => {
    const bundle = makeLinkedBundle();
    const model = searchAppendix({
      ...bundle,
      sourceRuns: [
        { ...bundle.sourceRuns[0]!, searchString: 'S1  TI tutoring\nS2  S1 AND „grades“' },
      ],
    });
    const buffer = await renderToBuffer(
      <AppendixPdf
        model={model}
        label={(key) => key}
        footer={['Rethlefsen ML, et al. Syst Rev 2021;10:39. CC BY 4.0']}
        language="en"
        pageLabel={pageLabel}
      />,
    );
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pages(buffer)).toBeGreaterThanOrEqual(1);
  }, 30_000);
});
