import { describe, expect, it } from 'vitest';
import {
  decodeEntities,
  firstAuthorKey,
  normalizeDoi,
  normalizePmid,
  normalizeTitle,
  parsePersonName,
  yearOf,
} from './normalize';

describe('normalizeDoi', () => {
  it('lower-cases and strips resolver prefixes (case A)', () => {
    expect(normalizeDoi('10.5555/FR.TEST.0001')).toBe('10.5555/fr.test.0001');
    expect(normalizeDoi('https://doi.org/10.5555/fr.test.0001')).toBe('10.5555/fr.test.0001');
    expect(normalizeDoi('http://dx.doi.org/10.1/X')).toBe('10.1/x');
    expect(normalizeDoi('doi: 10.1/X')).toBe('10.1/x');
    expect(normalizeDoi('DOI:10.1/X')).toBe('10.1/x');
  });

  it('strips the PubMed [doi] suffix and trailing punctuation (case B)', () => {
    expect(normalizeDoi('10.5555/fr.test.0011 [doi]')).toBe('10.5555/fr.test.0011');
    expect(normalizeDoi(' 10.1/x. ')).toBe('10.1/x');
  });

  it('returns undefined for empty or invalid values (case C1: empty DO)', () => {
    expect(normalizeDoi('')).toBeUndefined();
    expect(normalizeDoi('   ')).toBeUndefined();
    expect(normalizeDoi(undefined)).toBeUndefined();
    expect(normalizeDoi('S0140-6736(20)30183-5')).toBeUndefined();
    expect(normalizeDoi('10.1234')).toBeUndefined();
  });
});

describe('normalizePmid', () => {
  it('keeps digits only and rejects anything else', () => {
    expect(normalizePmid(' 99000002 ')).toBe('99000002');
    expect(normalizePmid('PMID: 33499930')).toBe('33499930');
    expect(normalizePmid('')).toBeUndefined();
    expect(normalizePmid('n/a')).toBeUndefined();
    expect(normalizePmid(undefined)).toBeUndefined();
  });
});

describe('decodeEntities', () => {
  it('decodes named and numeric HTML entities (case G)', () => {
    expect(decodeEntities('Grey literature &amp; documentation')).toBe(
      'Grey literature & documentation',
    );
    expect(decodeEntities('&lt;i&gt; &quot;x&quot; &#39;y&#39; &#x2013; &nbsp;z')).toBe(
      '<i> "x" \'y\' –  z',
    );
    expect(decodeEntities('&unknown; stays')).toBe('&unknown; stays');
  });
});

describe('normalizeTitle', () => {
  it('makes German original and transliterated capitals identical (case C)', () => {
    expect(
      normalizeTitle(
        'Informationskompetenz und systematische Übersichtsarbeiten an Fachhochschulen',
      ),
    ).toBe(
      normalizeTitle(
        'INFORMATIONSKOMPETENZ UND SYSTEMATISCHE UEBERSICHTSARBEITEN AN FACHHOCHSCHULEN',
      ),
    );
  });

  it('removes punctuation, case, diacritics and entities', () => {
    expect(normalizeTitle('Reporting searches: An audit.')).toBe('reporting searches an audit');
    expect(normalizeTitle('Grey literature &amp; documentation – a guide')).toBe(
      'grey literature documentation a guide',
    );
    expect(normalizeTitle("García-López's café")).toBe('garcia lopez s cafe');
    expect(normalizeTitle('Straße')).toBe('strasse');
    expect(normalizeTitle(undefined)).toBe('');
  });
});

describe('parsePersonName', () => {
  it('splits "Family, Given" and drops trailing titles (ProQuest)', () => {
    expect(parsePersonName('Berger, Anna')).toEqual({ family: 'Berger', given: 'Anna' });
    expect(parsePersonName('Raszewski, Rebecca, AHIP')).toEqual({
      family: 'Raszewski',
      given: 'Rebecca',
      suffix: 'AHIP',
    });
    expect(parsePersonName('van der Berg, Johannes')).toEqual({
      family: 'van der Berg',
      given: 'Johannes',
    });
  });

  it('splits MEDLINE and Scopus style "Family Initials"', () => {
    expect(parsePersonName('Rethlefsen ML')).toEqual({ family: 'Rethlefsen', given: 'ML' });
    expect(parsePersonName('van der Berg J')).toEqual({ family: 'van der Berg', given: 'J' });
    expect(parsePersonName('Pasupuleti M.K.')).toEqual({ family: 'Pasupuleti', given: 'M.K.' });
  });

  it('keeps organisations and single names as literal', () => {
    expect(parsePersonName('Cochrane Collaboration')).toEqual({
      literal: 'Cochrane Collaboration',
    });
    expect(parsePersonName('Plato')).toEqual({ literal: 'Plato' });
    expect(parsePersonName('  ')).toBeUndefined();
  });
});

describe('firstAuthorKey / yearOf', () => {
  it('compares surnames independent of accents, umlaut spelling and particles', () => {
    expect(firstAuthorKey({ author: [{ family: 'García-López', given: 'María' }] })).toBe(
      firstAuthorKey({ author: [{ family: 'Garcia-Lopez', given: 'MJ' }] }),
    );
    expect(firstAuthorKey({ author: [{ family: 'Müller' }] })).toBe(
      firstAuthorKey({ author: [{ family: 'Mueller' }] }),
    );
    expect(firstAuthorKey({ author: [{ literal: 'WHO' }] })).toBe('who');
    expect(firstAuthorKey({})).toBeUndefined();
  });

  it('reads the year from date-parts', () => {
    expect(yearOf({ issued: { 'date-parts': [[2024, 3]] } })).toBe(2024);
    expect(yearOf({ issued: { 'date-parts': [['2023']] } })).toBe(2023);
    expect(yearOf({})).toBeUndefined();
  });
});
