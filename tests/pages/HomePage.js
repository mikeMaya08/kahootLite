import { setBypassHeader } from '../helpers.js';

// Page object for the landing screen (#/).
export class HomePage {
  constructor(page) {
    this.page = page;
    this.newQuizButton = page.getByRole('button', { name: '+ New quiz' });
    this.pinInput = page.getByPlaceholder('ABC123');
    this.joinButton = page.getByRole('button', { name: /Join game/ });
  }

  async open() {
    // Bypass Vercel bot-protection so the headless browser reaches the app.
    await setBypassHeader(this.page);
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
    await this.newQuizButton.waitFor({ state: 'visible', timeout: 30_000 });
  }

  async startNewQuiz() {
    await this.newQuizButton.click();
  }

  // Enters the PIN in the "Have a code?" form and submits it.
  async joinWithPin(code) {
    await this.pinInput.fill(code);
    await this.joinButton.click();
  }
}
