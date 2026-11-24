import { expect } from '@playwright/test';
import { setBypassHeader } from '../helpers';

// Page object for a player tab (join -> lobby -> questions -> results).
export class PlayerPage {
  constructor(page) {
    this.page = page;
    this.nicknameInput = page.getByLabel('Your nickname');
    this.joinButton = page.getByRole('button', { name: /Join game/ });
    this.waitingMessage = page.getByText(/Waiting for the host/i);
    this.lockedIn = page.getByText(/Locked in/i);
    this.correctBanner = page.getByRole('heading', { name: /Correct!/ });
    this.wrongBanner = page.getByRole('heading', { name: /Not this time/ });
    this.outOfTimeBanner = page.getByRole('heading', { name: /Out of time/ });
    this.gameOverHeading = page.getByRole('heading', { name: /Game over/ });
    this.timer = page.getByRole('timer');
  }

  async join(code, name) {
    await setBypassHeader(this.page);
    await this.page.goto(`/#/join/${code}`);
    await this.nicknameInput.fill(name);
    await this.joinButton.click();
    await expect(this.waitingMessage).toBeVisible();
  }

  questionHeading(text) {
    return this.page.getByRole('heading', { name: text });
  }

  /** Clicks the answer button whose text matches (aria-label "Option X: text"). */
  async answer(optionText) {
    await this.page.getByRole('button', { name: new RegExp(optionText) }).click();
  }

  /** Points awarded on the reveal screen ("✓ Correct! +N pts"). */
  async awardedPoints() {
    const text = await this.correctBanner.innerText();
    const match = text.match(/\+(\d+)\s*pts/);
    if (!match) throw new Error(`Could not read awarded points from: ${text}`);
    return Number(match[1]);
  }

  leaderboardRow(name) {
    return this.page.locator('.lb-row', { hasText: name });
  }

  /** Final rank shown in the "You finished" card, e.g. "#1". */
  finalRank(rank) {
    return this.page.getByText(`#${rank}`, { exact: true });
  }
}
