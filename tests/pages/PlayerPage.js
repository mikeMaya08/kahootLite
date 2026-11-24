import { setBypassHeader } from '../helpers.js';

// Page object for a player tab: join form (#/join/<CODE>) and play screen (#/play/<CODE>).
export class PlayerPage {
  constructor(page) {
    this.page = page;
    this.nicknameInput = page.getByLabel('Your nickname');
    this.submitJoinButton = page.getByRole('button', { name: /Join game/ });
    this.waitingMessage = page.getByText(/Waiting for the host/i);
    this.lockedInMessage = page.getByText(/Locked in/i);
    this.correctMessage = page.getByText(/✓ Correct!/);
    this.wrongMessage = page.getByText(/Not this time/);
    this.gameOverHeading = page.getByRole('heading', { name: /Game over/ });
    this.rankCard = page.locator('.you-card');
    this.selfRow = page.locator('.lb-row-self');
  }

  async prepare() {
    // Each new Page needs its own bypass header.
    await setBypassHeader(this.page);
  }

  // Completes the join form shown after entering a PIN on the home screen.
  async joinAs(name) {
    await this.nicknameInput.fill(name);
    await this.submitJoinButton.click();
  }

  questionText(text) {
    return this.page.getByRole('heading', { name: text });
  }

  async answer(optionText) {
    await this.page.getByRole('button', { name: new RegExp(optionText) }).click();
  }
}
