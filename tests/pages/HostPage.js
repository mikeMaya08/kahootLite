import { expect } from '@playwright/test';

// Host screen (#/host/<CODE>): lobby, live question controls and final results.
export class HostPage {
  constructor(page) {
    this.page = page;
    this.pin = page.locator('.big-code').first();
    this.playerCount = page.locator('.badge');
    this.startButton = page.getByRole('button', { name: 'Start game' });
    this.revealButton = page.getByRole('button', { name: 'Reveal answer' });
    this.nextButton = page.getByRole('button', { name: /Next question →/ });
    this.finalResultsButton = page.getByRole('button', { name: /See final results →/ });
    this.finalHeading = page.getByRole('heading', { name: /Final results/ });
    this.leaderboardRows = page.locator('.lb-row');
  }

  async getPin() {
    await expect(this.pin).toHaveText(/^[A-Z0-9]{6}$/);
    return (await this.pin.innerText()).trim();
  }

  async expectPlayerInLobby(name) {
    await expect(this.page.locator('.chip', { hasText: name })).toBeVisible();
  }

  async expectPlayerCount(count) {
    await expect(this.playerCount).toHaveText(String(count));
  }

  async startGame() {
    await this.startButton.click();
  }

  async expectQuestion(text) {
    await expect(this.page.getByRole('heading', { name: text })).toBeVisible();
  }

  async revealAnswer() {
    await this.revealButton.click();
  }

  async nextQuestion() {
    await this.nextButton.click();
  }

  async showFinalResults() {
    await this.finalResultsButton.click();
    await expect(this.finalHeading).toBeVisible();
  }

  async scoreOf(name) {
    const text = await this.leaderboardRows
      .filter({ hasText: name })
      .locator('.lb-score')
      .innerText();
    return Number(text);
  }
}
