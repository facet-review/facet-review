import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('app shell', () => {
  test('shows wordmark, German by default, and all six modules', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.getByRole('link', { name: /Facet Review/ })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Projektübersicht' })).toBeVisible();

    const nav = page.getByRole('navigation', { name: 'Module' });
    for (const name of ['Projekt', 'Suche', 'Import', 'Screening', 'Flow-Diagramm', 'Checkliste']) {
      await expect(nav.getByRole('link', { name })).toBeVisible();
    }
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
    await expect(
      page.getByRole('navigation', { name: 'Modules' }).getByRole('link', { name: 'Checklist' }),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
    await expect(page).toHaveTitle('Projects – Facet Review');
  });

  test('navigates to a module and marks it as current page', async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('navigation', { name: 'Module' }).getByRole('link', {
      name: 'Screening',
    });
    await link.click();

    await expect(page).toHaveURL(/\/screening$/);
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { level: 1, name: 'Screening' })).toBeVisible();
    await expect(page.locator('main')).toBeFocused();
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
    await page.goto('/screening');
    await expect(page.getByRole('heading', { level: 1, name: 'Screening' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Screening' })).toBeVisible();
  });

  test('shows a not-found page for unknown routes', async ({ page }) => {
    await page.goto('/does-not-exist');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Seite nicht gefunden' }),
    ).toBeVisible();
  });
});

test.describe('accessibility (WCAG 2.1 AA)', () => {
  for (const theme of ['Hell', 'Dunkel'] as const) {
    test(`has no axe violations in theme "${theme}"`, async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: theme }).click();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
