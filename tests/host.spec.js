import { test, expect } from '@playwright/test';

test.describe('Host page', () => {
  test('shows "Room not found" when the room ID is invalid', async ({ page }) => {
    // Navigate directly to a host URL with a non-existent room ID.
    await page.goto('/#/host/INVALID999');

    // The host page should display the "Room not found" fallback.
    await expect(page.getByText('Room not found.')).toBeVisible();

    // A Home button should be present to let the user recover.
    await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
  });
});
