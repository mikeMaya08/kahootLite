import { expect } from '@playwright/test';

// Page object for the host tab once a room exists (lobby -> game -> results).
export class HostPage {
  constructor(page) {
    this.page = page;
    this.startButton = page.getByRole('button', { name: 'Start game' });
    this.revealButton = page.getByRole('button', { name: 'Reveal answer' });
    this.nextButton = page.getByRole('button', { name: /Next question →/ });
    this.finalResultsButton = page.getByRole('button', {
      name: /See final results →/,
    });
    this.timer = page.getByRole('timer');
    this.standingsHeading = page.getByRole('heading', { name: 'Standings' });
    this.finalHeading = page.getByRole('heading', { name: /Final results/ });
  }

  async startGame() {
    await this.startButton.click();
  }

  questionHeading(text) {
    return this.page.getByRole('heading', { name: text });
  }

  async revealAnswer() {
    await this.revealButton.click();
  }

  async nextQuestion() {
    await this.nextButton.click();
  }

  async seeFinalResults() {
    await this.finalResultsButton.click();
  }

  leaderboardRow(name) {
    return this.page.locator('.lb-row', { hasText: name });
  }

  /** Current score shown for a player in the host leaderboard. */
  async scoreOf(name) {
    const text = await this.leaderboardRow(name).locator('.lb-score').innerText();
    return Number(text.trim());
  }

  streakBadge(name) {
    return this.leaderboardRow(name).locator('.streak-badge');
  }

  /** Names in leaderboard order (top to bottom). */
  async rankedNames() {
    return this.page.locator('.lb-row .lb-name').allInnerTexts();
  }

  async expectQuestion(text) {
    await expect(this.questionHeading(text)).toBeVisible();
  }
}
