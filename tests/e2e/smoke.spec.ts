import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('app shell', () => {
  test('shows wordmark, German by default, the project overview and attribution', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.getByRole('link', { name: /Facet Review/ })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Facet Review' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Ihre Projekte' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Neues Projekt' })).toBeVisible();
    await expect(page.getByText('Ein Projekt von')).toBeVisible();
    await expect(page.getByRole('link', { name: 'doi:10.1136/bmj.n71' })).toBeVisible();
  });

  test('switches language to English and remembers it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'English' }).click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('link', { name: 'New project' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { level: 2, name: 'Your projects' })).toBeVisible();
    await expect(page).toHaveTitle('Every facet of your search. Traceable. – Facet Review');
  });

  test('offers a skip link as first keyboard stop', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Zum Inhalt springen' });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });

  test('loads a deep link directly and survives a reload', async ({ page }) => {
    await page.goto('/projects/new');
    await expect(page.getByRole('heading', { level: 1, name: 'Neues Projekt' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Neues Projekt' })).toBeVisible();
  });

  test('shows a not-found page for unknown routes and unknown projects', async ({ page }) => {
    await page.goto('/does-not-exist');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Seite nicht gefunden' }),
    ).toBeVisible();
    await page.goto('/projects/00000000-0000-0000-0000-000000000000/project');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Seite nicht gefunden' }),
    ).toBeVisible();
  });
});

test.describe('accessibility (WCAG 2.1 AA)', () => {
  for (const theme of ['Hell', 'Dunkel'] as const) {
    test(`has no axe violations on the overview in theme "${theme}"`, async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: theme }).click();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
