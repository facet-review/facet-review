import type { ChecklistEntry } from '../types';
import { checklistSections, itemText, type ItemLanguage } from './items';

export interface ChecklistDocumentRow {
  topic: string;
  /** Topic shown only on the first row of a topic, like the original table. */
  showTopic: boolean;
  id: string;
  text: string;
  location: string;
}

/**
 * Rows of the checklist in the layout of the original (Page et al. 2021):
 * section rows, then topic | item # | checklist item | location reported.
 * "Not applicable" without a location is written as such.
 */
export function checklistDocument(
  entries: readonly ChecklistEntry[],
  language: ItemLanguage,
  notApplicable: string,
) {
  const byItem = new Map(entries.map((entry) => [entry.itemId, entry]));
  return checklistSections().map((section) => {
    let previousTopic = '';
    return {
      section: itemText(section.items[0]!, language).section,
      rows: section.items.map((item): ChecklistDocumentRow => {
        const { topic, text } = itemText(item, language);
        const entry = byItem.get(item.id);
        const location = entry?.location?.trim() || (entry?.status === 'na' ? notApplicable : '');
        const showTopic = topic !== previousTopic;
        previousTopic = topic;
        return { topic, showTopic, id: item.id, text, location };
      }),
    };
  });
}
