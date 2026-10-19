import { test, expect } from '@playwright/test';
import { seedQuiz, setBypassHeader } from '../helpers';

// ---------------------------------------------------------------------------
// Theme toggle — global UI behaviour
// ---------------------------------------------------------------------------
// The toggle lives in <ThemeToggle /> inside App.jsx and is rendered on every
// page. It persists the user's preference to kahootlite:prefs in localStorage
// and applies it via document.documentElement.dataset.theme.
// ---------------------------------------------------------------------------

test.describe('Theme toggle', () => {
  // ── Initial state ─────────────────────────────────────────────────────────

  test('page loads with dark theme by default when no preference is stored', async ({ page }) => {
    await setBypassHeader(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('kahootlite:prefs'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    const theme = await page.evaluate(
      () => document.documentElement.dataset.theme
    );
    // Default theme when no pref is stored is 'dark'.
    expect(theme).toBe('dark');
  });

  test('theme toggle button is visible on the home page', async ({ page }) => {
    await setBypassHeader(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /Toggle theme/i })).toBeVisible();
  });

  // ── Toggle behaviour ──────────────────────────────────────────────────────

  test('clicking the toggle switches from dark to light', async ({ page }) => {
    await setBypassHeader(page);
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem('kahootlite:prefs', JSON.stringify({ theme: 'dark' }))
    );
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Toggle theme/i }).click();

    const theme = await page.evaluate(
      () => document.documentElement.dataset.theme
    );
    expect(theme).toBe('light');
  });

  test('clicking the toggle switches from light back to dark', async ({ page }) => {
    await setBypassHeader(page);
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem('kahootlite:prefs', JSON.stringify({ theme: 'light' }))
    );
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Toggle theme/i }).click();

    const theme = await page.evaluate(
      () => document.documentElement.dataset.theme
    );
    expect(theme).toBe('dark');
  });

  // ── Button emoji reflects current theme ──────────────────────────────────

  test('toggle button shows ☀️ when theme is dark', async ({ page }) => {
    await setBypassHeader(page);
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem('kahootlite:prefs', JSON.stringify({ theme: 'dark' }))
    );
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /Toggle theme/i })).toContainText('☀️');
  });

  test('toggle button shows 🌙 when theme is light', async ({ page }) => {
    await setBypassHeader(page);
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem('kahootlite:prefs', JSON.stringify({ theme: 'light' }))
    );
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /Toggle theme/i })).toContainText('🌙');
  });

  // ── Persistence across navigation ─────────────────────────────────────────

  test('light theme preference persists when navigating to quiz library', async ({ page }) => {
    await setBypassHeader(page);
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem('kahootlite:prefs', JSON.stringify({ theme: 'light' }))
    );
    await page.goto('/#/quizzes');
    await page.waitForLoadState('networkidle');

    const theme = await page.evaluate(
      () => document.documentElement.dataset.theme
    );
    expect(theme).toBe('light');
  });

  test('dark theme preference persists when navigating to quiz creator', async ({ page }) => {
    await setBypassHeader(page);
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem('kahootlite:prefs', JSON.stringify({ theme: 'dark' }))
    );
    await page.goto('/#/create');
    await page.waitForLoadState('networkidle');

    const theme = await page.evaluate(
      () => document.documentElement.dataset.theme
    );
    expect(theme).toBe('dark');
  });

  test('preference is written to localStorage after toggling', async ({ page }) => {
    await setBypassHeader(page);
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem('kahootlite:prefs', JSON.stringify({ theme: 'dark' }))
    );
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Toggle theme/i }).click();

    const prefs = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kahootlite:prefs') || '{}')
    );
    expect(prefs.theme).toBe('light');
  });

  // ── Toggle visible on other pages ─────────────────────────────────────────

  test('theme toggle is visible on the quiz library page', async ({ page }) => {
    await setBypassHeader(page);
    await page.goto('/#/quizzes');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /Toggle theme/i })).toBeVisible();
  });

  test('theme toggle is visible on the quiz creator page', async ({ page }) => {
    await setBypassHeader(page);
    await page.goto('/#/create');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /Toggle theme/i })).toBeVisible();
  });

  test('theme toggle is visible on the join page', async ({ page }) => {
    await setBypassHeader(page);
    await page.goto('/#/join/TEST123');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /Toggle theme/i })).toBeVisible();
  });

  // ── Toggle works on the quiz library page too ─────────────────────────────

  test('toggling on the quiz library page also updates the theme attribute', async ({ page }) => {
    await setBypassHeader(page);
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem('kahootlite:prefs', JSON.stringify({ theme: 'dark' }))
    );
    await page.goto('/#/quizzes');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Toggle theme/i }).click();

    const theme = await page.evaluate(
      () => document.documentElement.dataset.theme
    );
    expect(theme).toBe('light');
  });
});
