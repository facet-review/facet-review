import { writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('start page: name, slogan, chain, entry points and the data promise', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Facet Review' })).toBeVisible();
  await expect(page.getByText('Jede Facette Ihrer Suche. Nachvollziehbar.')).toBeVisible();
  await expect(
    page.getByText('Systematic Reviews nach PRISMA 2020 & PRISMA-S').first(),
  ).toBeVisible();
  const chain = page.getByRole('list', { name: 'Die Kette eines Reviews in Facet Review' });
  await expect(chain.getByRole('listitem')).toHaveText([
    'Suche (PRISMA-S)',
    'Treffer',
    'Dubletten',
    'Screening',
    'Flow-Diagramm (PRISMA 2020)',
    'Checkliste',
  ]);
  await expect(page.getByRole('link', { name: 'Neues Projekt' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Projekt öffnen' })).toBeVisible();

  const privacy = page.getByRole('region', { name: 'Ihre Daten bleiben in Ihrem Browser.' });
  await expect(privacy).toContainText('kein Tracking');
  await privacy.getByRole('link', { name: 'Mehr dazu in der Datenschutzerklärung' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Datenschutz' })).toBeVisible();
});

test('the open-project button reads a project file', async ({ page }, testInfo) => {
  // Full export → import round trip: projects.spec.ts. Here: the entry point is wired up.
  const path = testInfo.outputPath('newer.json');
  await writeFile(path, '{ "format": "facet-review-project", "schemaVersion": 99 }');
  await page.goto('/');
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Projekt öffnen' }).click(),
  ]);
  expect(chooser.isMultiple()).toBe(false);
  await chooser.setFiles(path);
  await expect(page.getByRole('alert')).toContainText('neueren Version von Facet Review');
});

test('legal pages are linked from every page and carry the hosting notice', async ({ page }) => {
  await page.goto('/projects/new');
  const legal = page.getByRole('navigation', { name: 'Rechtliches' });
  await legal.getByRole('link', { name: 'Impressum' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Impressum' })).toBeVisible();
  await expect(page.getByText('[PLATZHALTER: Name]', { exact: false })).toBeVisible();
  await expect(page.getByText('Entwurf: Die mit [PLATZHALTER]')).toBeVisible();

  await legal.getByRole('link', { name: 'Datenschutz' }).click();
  const hosting = page.getByRole('region', { name: 'Bereitstellung über GitHub Pages' });
  await expect(hosting).toContainText('GitHub Inc., USA');
  await expect(hosting).toContainText('IP-Adresse');
  await expect(
    hosting.getByRole('link', { name: 'GitHub General Privacy Statement' }),
  ).toHaveAttribute('href', /docs\.github\.com/);
  await expect(page.getByRole('region', { name: 'Suche in OpenAlex' })).toContainText(
    'OurResearch',
  );

  // Direct load (deep link) and English.
  await page.goto('/datenschutz');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Hosting on GitHub Pages' })).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`start and legal pages have no axe violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    for (const path of ['/', '/impressum', '/datenschutz']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(results.violations, path).toEqual([]);
    }
  });
}
