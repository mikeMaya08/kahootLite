import { test, expect } from '@playwright/test';

test.describe('CandyMapper – Contact Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://candymapper.com/');

    // Dismiss the Pop-Up Challenge modal if it appears
    const closeBtn = page.locator('.modal button').filter({ hasText: /^x$/i })
      .or(page.locator('[aria-label="Close"]'))
      .or(page.locator('.modal .close').first());

    if (await closeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await closeBtn.click();
      await expect(closeBtn).not.toBeVisible();
    }
  });

  test('shows email validation error then succeeds on valid submission', async ({ page }) => {
    // Scroll to the Contact Us section
    await page.getByText('Contact Us').first().scrollIntoViewIfNeeded();

    // Fill in only First Name, leaving required Email empty
    await page.getByLabel('First Name').fill('Miguel');

    // Submit — should trigger email validation error
    await page.getByRole('button', { name: /submit/i }).click();
    await expect(
      page.getByText(/please enter a valid email address/i)
    ).toBeVisible();

    // Enter a valid email and re-submit
    await page.getByLabel(/email/i).fill('migue@mailinator.com');
    await page.getByRole('button', { name: /submit/i }).click();

    // Verify the success confirmation message
    await expect(
      page.getByText(/thank you for your inquiry/i)
    ).toBeVisible();
  });
});
