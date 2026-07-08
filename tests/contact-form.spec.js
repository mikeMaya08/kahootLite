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
    // Scroll to the Contact Us section
    await page.locator('[data-aid="CONTACT_SECTION_TITLE_REND"]').scrollIntoViewIfNeeded();

    // Fill in only First Name, leaving required Email empty
    await page.locator('[data-aid="First Name"] input').fill('Miguel');

    // Scroll submit button into view and click — should trigger email validation error
    await page.locator('[data-aid="CONTACT_SUBMIT_BUTTON_REND"]').scrollIntoViewIfNeeded();
    await page.locator('[data-aid="CONTACT_SUBMIT_BUTTON_REND"]').click();
    await expect(
      page.locator('[data-aid="CONTACT_EMAIL_ERR_REND"]')
    ).toHaveText(/please enter a valid email address/i);

    // Enter a valid email and re-submit
    await page.locator('[data-aid="CONTACT_FORM_EMAIL"] input').fill('migue@mailinator.com');
    await page.locator('[data-aid="CONTACT_SUBMIT_BUTTON_REND"]').click();

    // Verify the success confirmation message
    await expect(
      page.getByText(/thank you for your inquiry/i)
    ).toBeVisible();
  });
});
