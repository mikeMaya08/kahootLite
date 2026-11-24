// Page object for the host screen (#/host/<CODE>): lobby, live game, final results.
export class HostPage {
  constructor(page) {
    this.page = page;
    this.pin = page.locator('.big-code').first();
    this.startButton = page.getByRole('button', { name: 'Start game' });
    this.revealButton = page.getByRole('button', { name: 'Reveal answer' });
    this.nextQuestionButton = page.getByRole('button', { name: /Next question →/ });
    this.finalResultsButton = page.getByRole('button', { name: /See final results →/ });
    this.finalHeading = page.getByRole('heading', { name: /Final results/ });
    this.leaderboardRows = page.locator('.lb-row');
  }

  async waitForLobby() {
    await this.page.waitForURL(/#\/host\//);
    await this.pin.waitFor({ state: 'visible' });
  }

  async getPin() {
    return (await this.pin.innerText()).trim();
  }

  playerChip(name) {
    return this.page.locator('.chip', { hasText: name });
  }

  questionText(text) {
    return this.page.getByRole('heading', { name: text });
  }

  async startGame() {
    await this.startButton.click();
  }

  // Ends the answering phase manually so the test never waits on the timer.
  async revealAnswer() {
    await this.revealButton.click();
  }

  async nextQuestion() {
    await this.nextQuestionButton.click();
  }

  async showFinalResults() {
    await this.finalResultsButton.click();
  }

  leaderboardRow(name) {
    return this.leaderboardRows.filter({ hasText: name });
  }

  async scoreOf(name) {
    const text = await this.leaderboardRow(name).locator('.lb-score').innerText();
    return Number(text);
  }
}
