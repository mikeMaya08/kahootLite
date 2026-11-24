// Page object for the quiz editor (#/create).
export class QuizCreatorPage {
  constructor(page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'New quiz' });
    this.titleInput = page.getByLabel('Quiz title');
    this.addQuestionButton = page.getByRole('button', { name: /\+ Add question/ });
    this.saveAndHostButton = page.getByRole('button', { name: /Save .* host/i });
    this.questionEditors = page.locator('.question-editor');
  }

  async setTitle(title) {
    await this.titleInput.fill(title);
  }

  async addQuestion() {
    await this.addQuestionButton.click();
  }

  // Fills the question at `index` (0-based). Fields are scoped to that editor
  // so several questions can be filled without ambiguity.
  async fillQuestion(index, { text, options, correctIndex = 0 }) {
    const editor = this.questionEditors.nth(index);
    await editor.getByLabel('Question text').fill(text);
    const placeholders = ['Option A', 'Option B', 'Option C', 'Option D'];
    for (let i = 0; i < options.length; i++) {
      await editor.getByPlaceholder(placeholders[i]).fill(options[i]);
    }
    await editor.getByLabel('Correct answer').selectOption({ index: correctIndex });
  }

  async saveAndHost() {
    await this.saveAndHostButton.click();
  }
}
