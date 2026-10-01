/// <reference lib="dom" />
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { decideAndWait, recordTitle, setUpScreening } from './helpers';

/**
 * Accessibility audit (WCAG 2.1 AA, milestone 7): every route of the app with
 * data, in light and dark mode, checked by axe, plus reflow at 320 px (1.4.10)
 * and text spacing (1.4.12). Manual keyboard checks: docs/a11y-audit.md.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** A project with decisions in both stages; returns every route worth auditing. */
async function collectRoutes(page: Page): Promise<string[]> {
  await setUpScreening(page);
  await page.getByRole('link', { name: 'Screening starten' }).click();
  await expect(recordTitle(page)).toBeFocused();
  await decideAndWait(page, 'i', 'Informationskompetenz');
  await decideAndWait(page, 'i', 'INFORMATIONSKOMPETENZ');
  const unitStage1 = new URL(page.url()).pathname;
  const base = unitStage1.replace(/\/screening\/.*$/, '');

  await page.goto(`${base}/search`);
  await expect(page.getByRole('article', { name: 'Testdatenbank' })).toBeVisible();
  const searchLinks = await page
    .locator('main a[href*="/search/"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).pathname));
  await page.goto(`${base}/import`);
  await expect(page.locator('main a[href*="/import/runs/"]').first()).toBeVisible();
  const importLinks = await page
    .locator('main a[href*="/import/runs/"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).pathname));
  await page.goto(`${base}/screening?stage=full-text`);
  await expect(page.locator('main a[href*="/screening/full-text/"]').first()).toBeVisible();
  const fullTextUnits = await page
    .locator('main a[href*="/screening/full-text/"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).pathname));

  return [
    '/',
    '/projects/new',
    '/impressum',
    '/datenschutz',
    '/does-not-exist',
    `${base}/project`,
    `${base}/search`,
    ...new Set(searchLinks),
    `${base}/import`,
    ...new Set(importLinks),
    `${base}/import/duplicates`,
    `${base}/screening`,
    `${base}/screening?stage=full-text`,
    unitStage1,
    ...fullTextUnits.slice(0, 1),
    `${base}/flow`,
    `${base}/checklist`,
    `${base}/export`,
  ];
}

async function axe(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    label,
  ).toEqual([]);
}

/** No horizontal scrolling of the page itself (tables may scroll in their own container). */
async function expectNoPageScroll(page: Page, label: string) {
  const offenders = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth - width <= 1) return [];
    return [...document.querySelectorAll('body *')]
      .filter((element) => element.getBoundingClientRect().right > width + 1)
      .map((element) => `${element.tagName.toLowerCase()}.${String(element.className)}`)
      .slice(-5);
  });
  expect(offenders, label).toEqual([]);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`every route passes axe (${scheme})`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: scheme });
    const routes = await collectRoutes(page);
    expect(routes.length).toBeGreaterThanOrEqual(20);
    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await axe(page, `${route} (${scheme})`);
    }

    // States that only exist after interaction.
    const base = routes.find((route) => route.endsWith('/flow'))!.replace(/\/flow$/, '');
    await page.goto('/projects/new');
    await page.getByRole('button', { name: 'Projekt anlegen' }).click();
    await expect(page.getByLabel('Titel des Reviews')).toHaveAttribute('aria-invalid', 'true');
    await axe(page, 'field error');

    await page.goto(`${base}/search`);
    await page
      .getByRole('link', { name: /^Suchlauf hinzufügen/ })
      .first()
      .click();
    await page.getByLabel('Suchstring').fill('');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByRole('alert')).toBeFocused();
    await axe(page, 'error summary');

    await page.goto(`${base}/flow`);
    await page
      .getByRole('group', { name: /PRISMA-2020-Flow-Diagramm/ })
      .getByRole('button', { name: /^Records screened/ })
      .click();
    await axe(page, 'flow drill-down');

    await page.goto('/');
    await page
      .getByRole('button', { name: /^Löschen/ })
      .first()
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await axe(page, 'delete dialog');
  });
}

test.describe('reflow', () => {
  // The text-spacing override is injected as a style tag, which the CSP would block.
  test.use({ bypassCSP: true });

  test('reflows at 320 px without horizontal page scrolling, also with text spacing', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const routes = await collectRoutes(page);
    await page.setViewportSize({ width: 320, height: 800 });
    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expectNoPageScroll(page, `${route} at 320 px`);
      // WCAG 1.4.12: content must survive these spacing overrides.
      await page.addStyleTag({
        content:
          '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }',
      });
      await expectNoPageScroll(page, `${route} at 320 px with text spacing`);
    }
  });
});

/**
 * Keyboard (WCAG 2.1.1, 2.1.2, 2.4.7): on every route, Tab reaches the end of
 * the page without getting stuck, and every stop shows a visible focus outline.
 */
test('every route is keyboard-operable with visible focus and no trap', async ({ page }) => {
  test.setTimeout(240_000);
  const routes = await collectRoutes(page);
  for (const route of routes) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    const seen = new Set<string>();
    let previous = '';
    let reachedEnd = false;
    for (let step = 0; step < 400 && !reachedEnd; step++) {
      await page.keyboard.press('Tab');
      const stop = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element || element === document.body) return null;
        const style = getComputedStyle(element);
        // SVG boxes of the flow diagram show focus as a 3 px frame instead of an outline.
        const svgFrame = element.querySelector(':scope > rect');
        const outlined =
          (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2) ||
          (svgFrame !== null && parseFloat(getComputedStyle(svgFrame).strokeWidth) >= 3);
        const path: string[] = [];
        for (let node: Element | null = element; node; node = node.parentElement) {
          path.unshift(
            `${node.tagName}:${[...(node.parentElement?.children ?? [])].indexOf(node)}`,
          );
        }
        return {
          key: path.join('/'),
          label: `${element.tagName.toLowerCase()}#${element.id} "${(element.textContent ?? '').trim().slice(0, 40)}"`,
          outlined,
          last: element.textContent?.trim() === 'Quellcode',
        };
      });
      if (!stop) continue; // focus left the document (end of the tab cycle)
      expect(stop.outlined, `${route}: focus not visible on ${stop.label}`).toBe(true);
      // Date inputs keep focus while Tab moves through day, month and year.
      const sameField = stop.key === previous;
      if (seen.has(stop.key) && !sameField && !stop.last) {
        throw new Error(`${route}: keyboard trap or loop at ${stop.label}`);
      }
      seen.add(stop.key);
      previous = stop.key;
      reachedEnd = stop.last;
    }
    expect(reachedEnd, `${route}: the end of the page was not reached by Tab`).toBe(true);
  }
});
