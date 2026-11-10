import { expect } from '@playwright/test';

// Quiz builder (#/create). Questions are <fieldset> groups named "Question N".
export class QuizCreatorPage {
  constructor(page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'New quiz' });
    this.titleInput = page.getByLabel('Quiz title');
    this.addQuestionButton = page.getByRole('button', { name: '+ Add question' });
    this.saveAndHostButton = page.getByRole('button', { name: /Save & host/ });
  }

  question(number) {
    return this.page.getByRole('group', { name: `Question ${number}` });
  }

  async expectOpen() {
    await expect(this.heading).toBeVisible();
  }

  async setTitle(title) {
    await this.titleInput.fill(title);
  }

  async addQuestion() {
    await this.addQuestionButton.click();
  }

  /**
   * Fills the question with the given number.
   * @param {number} number 1-based question number
   * @param {{text: string, options: string[], correctIndex: number}} data
   */
  async fillQuestion(number, { text, options, correctIndex }) {
    const q = this.question(number);
    await expect(q).toBeVisible();
    await q.getByLabel('Question text').fill(text);
    const letters = ['A', 'B', 'C', 'D'];
    for (const [i, option] of options.entries()) {
      await q.getByPlaceholder(`Option ${letters[i]}`).fill(option);
    }
    await q.getByLabel('Correct answer').selectOption({ index: correctIndex });
  }

  // Saves the quiz and opens the host lobby; returns the 6-char PIN.
  async saveAndHost() {
    await this.saveAndHostButton.click();
    await expect(this.page).toHaveURL(/#\/host\//);
  }
}
