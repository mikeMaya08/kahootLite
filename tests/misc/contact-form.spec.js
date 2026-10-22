import { test, expect } from '@playwright/test';

test.describe('CandyMapper - Contact Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://candymapper.com/');

    // Dismiss the Pop-Up Challenge modal using the X close icon
    const modal = page.locator('[data-aid="POPUP_MODAL"]');
    const closeIcon = page.locator('#popup-widget5912-close-icon');

    if (await modal.isVisible({ timeout: 5000 }).catch(() => false)) {
      await closeIcon.click();
      await expect(modal).not.toBeVisible();
    }
  });

  test('shows email validation error then succeeds on valid submission', { tag: ['@contact', '@smoke', '@validation'] }, async ({ page }) => {
    // Use the stable contact section widget id as the form container
    const form = page.locator('[id="13177999-c08f-4f9c-ba5a-5b9aab59e4b5"]');

    // Scroll into view to ensure the form is visible before interacting
    await form.scrollIntoViewIfNeeded();

    // Type First Name then submit without an email — should trigger email validation error
    await form.locator('input[data-aid="First Name"]').type('Miguel');
    await form.locator('[data-aid="CONTACT_SUBMIT_BUTTON_REND"]').click();
    await expect(
      form.locator(':text-matches("please enter a valid email address", "i")')
    ).toBeVisible({ timeout: 15000 });

    // Enter a valid email and re-submit
    await form.locator('input[id="input10"]').type('migue@mailinator.com');
    await form.locator('[data-aid="CONTACT_SUBMIT_BUTTON_REND"]').click();

    // Verify the success confirmation message
    await expect(
      form.getByText(/thank you for your inquiry/i)
    ).toBeVisible();
  });
});
