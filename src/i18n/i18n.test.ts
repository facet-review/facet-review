import { describe, expect, it } from 'vitest';
import de from './de.json';
import en from './en.json';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      entries.set(path, value);
    } else {
      for (const [childPath, childValue] of flatten(value, path)) {
        entries.set(childPath, childValue);
      }
    }
  }
  return entries;
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1] ?? '').sort();
}

const languages = { de: flatten(de), en: flatten(en) };

describe('translation files', () => {
  it('define exactly the same keys in German and English', () => {
    expect([...languages.en.keys()].sort()).toEqual([...languages.de.keys()].sort());
  });

  it.each(Object.entries(languages))('contain no empty strings (%s)', (_language, entries) => {
    const empty = [...entries].filter(([, value]) => value.trim() === '').map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it('use the same interpolation placeholders in both languages', () => {
    for (const [key, value] of languages.de) {
      expect(placeholders(languages.en.get(key) ?? ''), key).toEqual(placeholders(value));
    }
  });
});

/**
 * Keys whose English text may equal the German one: proper names, formats,
 * identifiers and loanwords used in both languages. Any other identical value
 * is a German leftover in en.json (milestone 7: English completed).
 */
const SAME_IN_BOTH = new Set([
  'app.name',
  'checklist.itemName',
  'checklist.statusLegend',
  'checklist.suggestion.excludedReports.line',
  'csvFields.abstract',
  'csvFields.doi',
  'csvFields.issn',
  'csvFields.pmid',
  'csvFields.url',
  'duplicates.fields.doi',
  'duplicates.fields.pmid',
  'duplicates.linkExplanation',
  'export.appendix.type.website',
  'export.appendix.updates',
  'export.appendix.url',
  'export.labels.doi',
  'export.labels.notInStage',
  'export.labels.pmid',
  'flow.diagram.csvBox',
  'flow.diagram.csvN',
  'flow.diagram.phaseScreening',
  'flow.diagram.websites',
  'flow.page.columnN',
  'formats.bibtex',
  'formats.csv',
  'formats.nbib',
  'formats.ris',
  'frameworkFields.evaluation',
  'frameworkFields.population',
  'frameworks.PICO',
  'frameworks.PICo',
  'frameworks.SPIDER',
  'home.chain.screening',
  'importPage.batches.format',
  'legal.privacy.sections.hosting.link',
  'modules.import.title',
  'modules.screening.title',
  'openalex.limitsHeading',
  'openalex.typeNames.dissertation',
  'openalex.typeNames.preprint',
  'openalex.typeNames.review',
  'project.fields.institution',
  'screening.columns.status',
  'screening.fields.abstract',
  'screening.links.doi',
  'screening.links.pubmed',
  'screening.listCaption',
  'screening.position.label',
  'screening.unitTitle',
  'search.runs.limits',
  'settings.theme.system',
]);

describe('English texts', () => {
  it('contain no untranslated German leftovers', () => {
    const identical = [...languages.en]
      .filter(([key, value]) => languages.de.get(key) === value && !SAME_IN_BOTH.has(key))
      .map(([key]) => key);
    expect(identical).toEqual([]);
  });

  it('use typographic apostrophes', () => {
    const straight = [...languages.en]
      .filter(([, value]) => /[A-Za-z]'[A-Za-z]/.test(value))
      .map(([key]) => key);
    expect(straight).toEqual([]);
  });

  it('use no German typography or umlauts', () => {
    const german = [...languages.en]
      .filter(([, value]) => /[„äöüßÄÖÜ]|\b(und|oder|nicht|der|die|das)\b/.test(value))
      .map(([key]) => key);
    expect(german).toEqual([]);
  });
});
