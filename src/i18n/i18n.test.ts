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
