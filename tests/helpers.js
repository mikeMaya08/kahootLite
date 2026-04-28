// Shared utilities so individual specs stay focused on their scenario.

export const SAMPLE_QUIZ = {
  id: 'quiz-test-1',
  title: 'Capitals',
  questions: [
    {
      id: 'q-1',
      text: 'Capital of France?',
      options: ['Paris', 'Berlin', 'Madrid', 'Rome'],
      correctIndex: 0,
      timeLimit: 30,
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

// Pre-seeds a quiz directly into localStorage so multiplayer tests don't
// have to re-traverse the creator UI.
export async function seedQuiz(page, quiz = SAMPLE_QUIZ) {
  await page.goto('/');
  await page.evaluate((q) => {
    localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
  }, quiz);
}

// Drives a host page from quiz library to the live lobby and returns the PIN.
export async function hostSeededQuiz(page) {
  await page.goto('/#/quizzes');
  await page.getByRole('button', { name: /Host →/ }).click();
  await page.waitForURL(/#\/host\//);
  const code = (await page.locator('.big-code').first().innerText()).trim();
  return code;
}

export async function joinAs(page, code, name) {
  await page.goto(`/#/join/${code}`);
  await page.getByLabel('Your nickname').fill(name);
  await page.getByRole('button', { name: /Join game/ }).click();
}
