import checklist from '../../../docs/reference/prisma2020-checklist.json';

/** One of the 42 entries of the PRISMA 2020 checklist (Page et al. 2021, CC BY 4.0). */
export interface ChecklistItem {
  id: string;
  section: string;
  topic: string;
  text_en: string;
  section_de: string;
  topic_de: string;
  text_de: string;
}

export const CHECKLIST_ITEMS: readonly ChecklistItem[] = checklist.items;
export const CHECKLIST_SOURCE: string = checklist.source;
export const CHECKLIST_LICENSE: string = checklist.license;
/** Shown wherever German item texts appear: unofficial working translation. */
export const TRANSLATION_NOTICE_DE: string = checklist.translation.notice_de;

export type ItemLanguage = 'en' | 'de';

export function itemText(item: ChecklistItem, language: ItemLanguage) {
  return language === 'de'
    ? { section: item.section_de, topic: item.topic_de, text: item.text_de }
    : { section: item.section, topic: item.topic, text: item.text_en };
}

/** Items grouped by section in the order of the original checklist. */
export function checklistSections(items: readonly ChecklistItem[] = CHECKLIST_ITEMS) {
  const sections: { section: string; items: ChecklistItem[] }[] = [];
  for (const item of items) {
    const last = sections.at(-1);
    if (last?.section === item.section) last.items.push(item);
    else sections.push({ section: item.section, items: [item] });
  }
  return sections;
}
