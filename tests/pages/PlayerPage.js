import { expect } from '@playwright/test';

// Player flow: nickname screen (#/join/<CODE>) then play screen (#/play/<CODE>).
export class PlayerPage {
  constructor(page) {
    this.page = page;
    this.nicknameInput = page.getByLabel('Your nickname');
    this.joinButton = page.getByRole('button', { name: /Join game/ });
    this.waitingMessage = page.getByText(/Waiting for the host/i);
    this.lockedInMessage = page.getByText(/Locked in/i);
    this.gameOverHeading = page.getByRole('heading', { name: /Game over/ });
    this.selfRow = page.locator('.lb-row-self');
  }

  // Completes the nickname form (after reaching #/join/<CODE>).
  async joinAs(name) {
    await this.nicknameInput.fill(name);
    await this.joinButton.click();
    await expect(this.page).toHaveURL(/#\/play\//);
    await expect(this.waitingMessage).toBeVisible();
  }

  async expectQuestion(text) {
    await expect(this.page.getByRole('heading', { name: text })).toBeVisible();
  }

  async answer(optionText) {
    await this.page.getByRole('button', { name: new RegExp(optionText) }).click();
    await expect(this.lockedInMessage).toBeVisible();
  }

  async expectCorrect() {
    await expect(this.page.getByText(/✓ Correct!/)).toBeVisible();
  }

  async expectIncorrect() {
    await expect(this.page.getByText(/Not this time/)).toBeVisible();
  }

  async expectGameOver() {
    await expect(this.gameOverHeading).toBeVisible();
  }
}
