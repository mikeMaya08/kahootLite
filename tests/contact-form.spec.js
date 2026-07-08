import { test, expect } from '@playwright/test';

test.describe('CandyMapper – Contact Form', () => {
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

  test('shows email validation error then succeeds on valid submission', async ({ page }) => {
    // Scope all form interactions inside the form container
    const form = page.locator('[data-aid="CONTACT_FORM_CONTAINER_REND"]');

    // Type First Name and click submit — should trigger email validation error
    await form.locator('[data-aid="First Name"] input').type('Miguel');
    await form.locator('[data-aid="CONTACT_SUBMIT_BUTTON_REND"]').click();
    await expect(
      page.locator('[data-aid="CONTACT_EMAIL_ERR_REND"]')
    ).toHaveText(/please enter a valid email address/i, { timeout: 15000 });

    // Enter a valid email and re-submit
    await page.locator('[data-aid="CONTACT_FORM_EMAIL"] input').click();
    await page.locator('[data-aid="CONTACT_FORM_EMAIL"] input').type('migue@mailinator.com');
    await page.locator('[data-aid="CONTACT_SUBMIT_BUTTON_REND"]').click();

    // Verify the success confirmation message
    await expect(
      page.getByText(/thank you for your inquiry/i)
    ).toBeVisible();
  });
});
