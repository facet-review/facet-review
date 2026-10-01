import { describe, expect, it } from 'vitest';
import {
  CHECKLIST_ITEMS,
  CHECKLIST_LICENSE,
  CHECKLIST_SOURCE,
  TRANSLATION_NOTICE_DE,
  checklistSections,
  itemText,
} from './items';

describe('PRISMA 2020 checklist', () => {
  it('has the 42 entries of the original with unique ids', () => {
    expect(CHECKLIST_ITEMS).toHaveLength(42);
    expect(new Set(CHECKLIST_ITEMS.map((item) => item.id)).size).toBe(42);
    expect(CHECKLIST_ITEMS[0]?.id).toBe('1');
    expect(CHECKLIST_ITEMS.at(-1)?.id).toBe('27');
  });

  it('has English and German texts for every entry', () => {
    for (const item of CHECKLIST_ITEMS) {
      for (const language of ['en', 'de'] as const) {
        const text = itemText(item, language);
        expect(text.section && text.topic && text.text, `${item.id} ${language}`).toBeTruthy();
      }
    }
  });

  it('carries source, licence and the notice for the German working translation', () => {
    expect(CHECKLIST_SOURCE).toContain('Page MJ');
    expect(CHECKLIST_LICENSE).toBe('CC BY 4.0');
    expect(TRANSLATION_NOTICE_DE).toContain('Arbeitsübersetzung');
  });

  it('groups the entries in seven sections', () => {
    expect(checklistSections().map((s) => [s.section, s.items.length])).toEqual([
      ['TITLE', 1],
      ['ABSTRACT', 1],
      ['INTRODUCTION', 2],
      ['METHODS', 17],
      ['RESULTS', 11],
      ['DISCUSSION', 4],
      ['OTHER INFORMATION', 6],
    ]);
  });
});
