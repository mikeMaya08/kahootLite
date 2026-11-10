import { expect } from '@playwright/test';
import { setBypassHeader } from '../helpers';

// Landing screen (#/): join-by-PIN form and quiz-hosting shortcuts.
export class HomePage {
  constructor(page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /KahootLite/ });
    this.codeInput = page.getByPlaceholder('ABC123');
    this.joinButton = page.getByRole('button', { name: /Join game/ });
    this.newQuizButton = page.getByRole('button', { name: '+ New quiz' });
  }

  async open() {
    await setBypassHeader(this.page);
    await this.page.goto('/');
    await expect(this.heading).toBeVisible();
  }

  async startNewQuiz() {
    await this.newQuizButton.click();
    await expect(this.page).toHaveURL(/#\/create/);
  }

  // Enters a PIN and lands on the nickname/avatar screen.
  async joinWithCode(code) {
    await this.codeInput.fill(code);
    await this.joinButton.click();
    await expect(this.page).toHaveURL(new RegExp(`#/join/${code}`));
  }
}
