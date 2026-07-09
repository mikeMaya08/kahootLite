import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz } from './helpers';

const STREAK_QUIZ = {
  id: 'quiz-streak-test',
  title: 'Colors quiz',
  questions: [
    {
      id: 'q-1',
      text: 'Color of the sky?',
      options: ['Blue', 'Green', 'Red', 'Yellow'],
      correctIndex: 0,
      timeLimit: 30,
    },
    {
      id: 'q-2',
      text: 'Color of grass?',
      options: ['Green', 'Blue', 'Red', 'Yellow'],
      correctIndex: 0,
      timeLimit: 30,
    },
    {
      id: 'q-3',
      text: 'Color of a banana?',
      options: ['Yellow', 'Blue', 'Green', 'Red'],
      correctIndex: 0,
      timeLimit: 30,
    },
  ],
  createdAt: 0,
  updatedAt: 0,
};

test.describe('Answer streaks', () => {
  test('consecutive correct answers earn a growing streak bonus', async ({
    page,
    context,
  }) => {
    await seedQuiz(page, STREAK_QUIZ);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();

    // Q1 — first correct answer, no streak bonus yet.
    await expect(alice.getByText('Color of the sky?')).toBeVisible();
    await alice.getByRole('button', { name: /Blue/ }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(alice.getByText(/in a row/i)).toHaveCount(0);
    await page.getByRole('button', { name: 'Next question →' }).click();

    // Q2 — second correct in a row, streak bonus kicks in.
    await expect(alice.getByText('Color of grass?')).toBeVisible();
    await alice.getByRole('button', { name: /Green/ }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(alice.getByText('🔥 2 in a row!')).toBeVisible();
    await page.getByRole('button', { name: 'Next question →' }).click();

    // Q3 — third correct in a row, streak bonus keeps growing.
    await expect(alice.getByText('Color of a banana?')).toBeVisible();
    await alice.getByRole('button', { name: /Yellow/ }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(alice.getByText('🔥 3 in a row!')).toBeVisible();

    // Final results show the streak on the leaderboard.
    await page.getByRole('button', { name: 'See final results →' }).click();
    await expect(
      page.locator('.lb-row', { hasText: 'Alice' })
    ).toContainText('🔥 3');
  });

  test('a wrong answer resets the streak', async ({ page, context }) => {
    await seedQuiz(page, STREAK_QUIZ);
    const code = await hostSeededQuiz(page);

    const alice = await context.newPage();
    await joinAs(alice, code, 'Alice');

    await page.getByRole('button', { name: 'Start game' }).click();

    // Q1 correct.
    await alice.getByRole('button', { name: /Blue/ }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByRole('button', { name: 'Next question →' }).click();

    // Q2 wrong — breaks the streak.
    await alice.getByRole('button', { name: /Blue/ }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(alice.getByText(/Not this time/i)).toBeVisible();
    await page.getByRole('button', { name: 'Next question →' }).click();

    // Q3 correct again — streak restarts at 1, no bonus text yet.
    await alice.getByRole('button', { name: /Yellow/ }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(alice.getByText(/in a row/i)).toHaveCount(0);
  });
});
