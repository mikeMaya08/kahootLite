import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz, SAMPLE_QUIZ } from './helpers';

const TWO_QUESTION_QUIZ = {
  id: 'quiz-two-q',
  title: 'Two Question Quiz',
  questions: [
    {
      id: 'q-1',
      text: 'Capital of France?',
      options: ['Paris', 'Berlin', 'Madrid', 'Rome'],
      correctIndex: 0,
      timeLimit: 30,
    },
    {
      id: 'q-2',
      text: 'Capital of Germany?',
      options: ['Paris', 'Berlin', 'Madrid', 'Rome'],
      correctIndex: 1,
      timeLimit: 30,
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

test.describe('Host flow', () => {
  test('lobby renders the PIN and quiz title', async ({ page }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    await expect(page.locator('.big-code')).toHaveText(code);
    await expect(page.getByRole('heading', { name: SAMPLE_QUIZ.title })).toBeVisible();
  });

  test('player count badge updates as players join', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    await expect(page.locator('.badge')).toHaveText('0');

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');
    await expect(page.locator('.badge')).toHaveText('1');

    const bob = await context.newPage();
    await joinAs(bob, code, 'Bob');
    await expect(page.locator('.badge')).toHaveText('2');
  });

  test('joined players appear as chips in the lobby', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await expect(page.locator('.player-chips')).toContainText('Alice');
  });

  test('Start game is disabled when quiz has no questions', async ({ page }) => {
    const emptyQuiz = { ...SAMPLE_QUIZ, id: 'quiz-empty', questions: [] };
    await seedQuiz(page, emptyQuiz);
    await hostSeededQuiz(page);

    await expect(page.getByRole('button', { name: 'Start game' })).toBeDisabled();
  });

  test('starting with no players prompts a confirmation', async ({ page }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Start game' }).click();

    // After dismissing, still in lobby
    await expect(page.locator('.big-code')).toBeVisible();
  });

  test('host can start the game and question is shown', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();

    await expect(page.getByText('Capital of France?')).toBeVisible();
    await expect(page.getByText(/Question 1 \/ 1/i)).toBeVisible();
  });

  test('answer count updates as players respond', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');
    const bob = await context.newPage();
    await joinAs(bob, code, 'Bob');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    // Initially 0 answers
    await expect(page.getByText(/Answers/i)).toContainText('0');

    await alice.getByRole('button', { name: /Paris/ }).click();
    await expect(page.getByText(/Answers/i)).toContainText('1');

    await bob.getByRole('button', { name: /Berlin/ }).click();
    await expect(page.getByText(/Answers/i)).toContainText('2');
  });

  test('host can reveal the answer and correct/wrong states appear', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    await page.getByRole('button', { name: 'Reveal answer' }).click();

    // After reveal, correct answer option gets the 'correct' state
    await expect(page.locator('.answer-option.correct, [data-state="correct"]').first()).toBeVisible();
    // Wrong options should also be marked
    await expect(page.locator('.answer-option.wrong, [data-state="wrong"]').first()).toBeVisible();
    // Reveal button is gone, next/results button appears
    await expect(page.getByRole('button', { name: 'Reveal answer' })).toHaveCount(0);
  });

  test('single-question quiz shows "See final results →" after reveal', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    await expect(
      page.getByRole('button', { name: /See final results →/ })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Next question →/ })
    ).toHaveCount(0);
  });

  test('multi-question quiz shows "Next question →" after first reveal', async ({ page, context }) => {
    await seedQuiz(page, TWO_QUESTION_QUIZ);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();
    await page.getByRole('button', { name: 'Reveal answer' }).click();

    await expect(
      page.getByRole('button', { name: /Next question →/ })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /See final results →/ })
    ).toHaveCount(0);
  });

  test('host can advance to the next question', async ({ page, context }) => {
    await seedQuiz(page, TWO_QUESTION_QUIZ);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await expect(page.getByText('Capital of France?')).toBeVisible();

    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: /Next question →/ }).click();

    await expect(page.getByText('Capital of Germany?')).toBeVisible();
    await expect(page.getByText(/Question 2 \/ 2/i)).toBeVisible();
  });

  test('final results screen shows leaderboard, "Play again" and "End room"', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: /See final results →/ }).click();

    await expect(page.getByRole('heading', { name: /Final results/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'End room' })).toBeVisible();
  });

  test('"Play again" resets scores and returns to the lobby', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();
    await alice.getByRole('button', { name: /Paris/ }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: /See final results →/ }).click();

    await page.getByRole('button', { name: 'Play again' }).click();

    // Host is back in the lobby with the same PIN
    await expect(page.locator('.big-code')).toHaveText(code);
    await expect(page.getByRole('button', { name: 'Start game' })).toBeVisible();
  });

  test('"End room" confirms, deletes the room and navigates home', async ({ page }) => {
    await seedQuiz(page);
    await hostSeededQuiz(page);

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /← End room/ }).click();

    await expect(page).toHaveURL(/\/#?\/?$/);
  });

  test('invalid room code shows "Room not found" with a Home button', async ({ page }) => {
    await page.goto('/#/host/INVALID');

    await expect(page.getByText(/Room not found/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
  });

  test('"Home" button on "Room not found" navigates to home', async ({ page }) => {
    await page.goto('/#/host/INVALID');

    await page.getByRole('button', { name: 'Home' }).click();

    await expect(page).toHaveURL(/\/#?\/?$/);
  });

  test('second tab on the host URL becomes spectator, not controller', async ({ page, context }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    const spectator = await context.newPage();
    await spectator.goto(`/#/host/${code}`);

    await expect(spectator.getByRole('heading', { name: /Spectator view/i })).toBeVisible();
    await expect(spectator.getByRole('button', { name: 'Start game' })).toHaveCount(0);
  });
});
