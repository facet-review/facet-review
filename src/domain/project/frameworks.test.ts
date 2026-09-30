import { describe, expect, it } from 'vitest';
import { FRAMEWORK_FIELDS, switchFramework } from './frameworks';

describe('FRAMEWORK_FIELDS', () => {
  it('defines the components of each framework', () => {
    expect(FRAMEWORK_FIELDS.PICO).toEqual(['population', 'intervention', 'comparison', 'outcome']);
    expect(FRAMEWORK_FIELDS.PICo).toEqual(['population', 'phenomenon', 'context']);
    expect(FRAMEWORK_FIELDS.SPIDER).toEqual([
      'sample',
      'phenomenon',
      'design',
      'evaluation',
      'researchType',
    ]);
    expect(FRAMEWORK_FIELDS.free).toEqual([]);
  });
});

describe('switchFramework', () => {
  const question = {
    text: 'Q',
    framework: 'PICO' as const,
    fields: { population: 'Students', intervention: 'Tutoring', comparison: '', outcome: 'Grades' },
  };

  it('keeps values of fields shared by both frameworks', () => {
    const { question: next } = switchFramework(question, 'PICo');
    expect(next.framework).toBe('PICo');
    expect(next.fields).toEqual({ population: 'Students', phenomenon: '', context: '' });
    expect(next.text).toBe('Q');
  });

  it('reports non-empty values that would be discarded', () => {
    expect(switchFramework(question, 'PICo').discarded).toEqual(['intervention', 'outcome']);
    expect(switchFramework(question, 'free').discarded).toEqual([
      'population',
      'intervention',
      'outcome',
    ]);
  });

  it('discards nothing when switching to the same framework', () => {
    const result = switchFramework(question, 'PICO');
    expect(result.discarded).toEqual([]);
    expect(result.question.fields).toEqual(question.fields);
  });
});
