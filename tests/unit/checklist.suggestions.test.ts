import { describe, expect, it } from 'vitest';
import { checklistSuggestions, type SuggestionKey } from '../../src/domain/checklist/suggestions';
import { playGoldenScenario } from './golden';

/** Labels as "<key|var=value|…>" so tests see which text and which values were chosen. */
const t = (key: SuggestionKey, vars: Record<string, string | number> = {}) =>
  `<${[key, ...Object.entries(vars).map(([k, v]) => `${k}=${v}`)].join('|')}>`;

function golden() {
  const session = playGoldenScenario();
  session.project = {
    ...session.project,
    eligibility: { inclusion: ['Peer tutoring', 'Higher education'], exclusion: ['Schools'] },
    registration: { registry: 'OSF', id: 'abc12', url: 'https://osf.io/abc12', protocolUrl: '' },
  };
  return session;
}

describe('checklist suggestions from project data (golden scenario)', () => {
  const suggestions = checklistSuggestions(golden().bundle(), t);

  it('makes suggestions for items 5, 6, 7, 8, 16a, 16b, 24a and 24b only', () => {
    expect(Object.keys(suggestions).sort()).toEqual(
      ['16a', '16b', '24a', '24b', '5', '6', '7', '8'].sort(),
    );
  });

  it('5: lists inclusion and exclusion criteria', () => {
    expect(suggestions['5']?.note).toBe(
      '<eligibility.inclusion|list=Peer tutoring; Higher education>\n<eligibility.exclusion|list=Schools>',
    );
  });

  it('6: lists every source with the date it was last searched', () => {
    expect(suggestions['6']?.note.split('\n')).toEqual([
      '<sources.line|source=Synthetic CSV-DB|date=2026-09-01>',
      '<sources.line|source=Synthetic PubMed|date=2026-09-01>',
      '<sources.line|source=Synthetic Scopus|date=2026-09-01>',
    ]);
  });

  it('7: points to the search appendix', () => {
    expect(suggestions['7']).toEqual({ note: '<appendix.note>', location: '<appendix.location>' });
  });

  it('8: states a single reviewer without independent second screening, and automation', () => {
    expect(suggestions['8']?.note).toBe('<selection.single|name=Ada>\n<selection.noAutomation>');
  });

  it('16a: summarises the flow diagram with the golden numbers', () => {
    expect(suggestions['16a']?.note).toBe(
      '<flow.summary|identified=16|duplicates=4|removed=0|screened=12|excluded=5|sought=7|notRetrieved=1|assessed=6|reportsExcluded=3|studies=2|reports=3>',
    );
  });

  it('16b: lists the full-text exclusions with their reason', () => {
    const lines = suggestions['16b']!.note.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines.filter((l) => l.includes('reason=Falsches Studiendesign'))).toHaveLength(2);
    expect(lines.filter((l) => l.includes('reason=Falsche Sprache'))).toHaveLength(1);
  });

  it('24a/24b: registration and protocol', () => {
    expect(suggestions['24a']?.note).toBe(
      '<registration.registered|registry=OSF|id=abc12|url=https://osf.io/abc12>',
    );
    expect(suggestions['24b']?.note).toBe('<protocol.none>');
  });
});

describe('checklist suggestions for an empty project', () => {
  it('still says honestly what is missing', () => {
    const session = playGoldenScenario();
    session.decisions = [];
    session.project = {
      ...session.project,
      eligibility: { inclusion: [], exclusion: [] },
      registration: { registry: '', id: '', url: '', protocolUrl: 'https://example.org/p' },
    };
    const s = checklistSuggestions(session.bundle(), t);
    expect(s['5']?.note).toBe('<eligibility.none>');
    expect(s['16b']?.note).toBe('<excludedReports.none>');
    expect(s['24a']?.note).toBe('<registration.none>');
    expect(s['24b']?.note).toBe('<protocol.url|url=https://example.org/p>');
  });

  it('reports automation tools when records were removed by them', () => {
    const session = playGoldenScenario();
    session.decide('F1', { stage: 'pre_screening', value: 'remove_automation', note: 'ASReview' });
    expect(checklistSuggestions(session.bundle(), t)['8']?.note).toContain(
      '<selection.automation|count=1>',
    );
  });
});

describe('checklist suggestions: details', () => {
  it('names the platform of a source and lists exclusions of other methods', () => {
    const session = playGoldenScenario();
    session.sources = session.sources.map((s, i) => (i === 0 ? { ...s, platform: 'Elsevier' } : s));
    const run = session.addSource('Citation chasing', 'citation_search');
    session.importFile('synthetic/late-import.ris', 'ris', run);
    session.decide('N1', {
      stage: 'full_text',
      value: 'exclude',
      reasonId: session.reasonId('Falsche Population'),
    });
    const s = checklistSuggestions(session.bundle(), t);
    expect(s['6']?.note).toContain('source=Synthetic Scopus (Elsevier)');
    expect(s['16b']?.note).toContain('reason=Falsche Population');
  });

  it('says so when nothing was searched and works without a reviewer name', () => {
    const session = playGoldenScenario();
    session.runs = [];
    session.project = { ...session.project, reviewers: [] };
    const s = checklistSuggestions(session.bundle(), t);
    expect(s['6']?.note).toBe('<sources.none>');
    expect(s['8']?.note).toContain('<selection.single|name=>');
  });
});
