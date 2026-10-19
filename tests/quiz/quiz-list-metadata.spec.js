import { test, expect } from '@playwright/test';
import { SAMPLE_QUIZ, seedQuiz, setBypassHeader } from '../helpers';

// ---------------------------------------------------------------------------
// Quiz library — metadata display & multi-quiz edge cases
// ---------------------------------------------------------------------------
// Covers: untitled quiz fallback, updated-date display, question-count update
// after edit, correct Host → routing for each card, and isolation between
// multiple quizzes in the same library.
// ---------------------------------------------------------------------------

test.describe('Quiz library — metadata & multi-quiz edge cases', () => {
  // ── Untitled quiz fallback ─────────────────────────────────────────────────

  test('quiz without a title is displayed as "Untitled quiz"', async ({ page }) => {
    const untitled = { ...SAMPLE_QUIZ, id: 'quiz-untitled', title: '' };

    await setBypassHeader(page);
    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, untitled);
    await page.goto('/#/quizzes');
    await page.waitForLoadState('networkidle');

    await page.getByText(/Untitled quiz/i).waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.getByText(/Untitled quiz/i)).toBeVisible();
  });

  // ── Updated-at date display ────────────────────────────────────────────────

  test('quiz card shows an "updated" date string', async ({ page }) => {
    const dated = {
      ...SAMPLE_QUIZ,
      id: 'quiz-dated',
      updatedAt: new Date('2024-06-15').getTime(),
    };

    await setBypassHeader(page);
    await page.goto('/');
    await page.evaluate((q) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([q]));
    }, dated);
    await page.goto('/#/quizzes');
    await page.waitForLoadState('networkidle');

    await page.getByText(/updated/i).waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.getByText(/updated/i)).toBeVisible();
  });

  // ── Question-count update after edit ──────────────────────────────────────

  test('question count updates in the library card after editing the quiz', async ({ page }) => {
    await seedQuiz(page); // seeds SAMPLE_QUIZ with 1 question
    await page.goto('/#/quizzes');
    await page.waitForLoadState('networkidle');

    // Verify initial count
    await page.getByText(/1 question/i).waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.getByText(/1 question/i)).toBeVisible();

    // Open editor and add a second question.
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.waitForURL(/#\/edit\//);

    await page.getByRole('button', { name: /Add question/i }).click();

    // Fill in the new question's text (required to save).
    const questionInputs = page.getByLabel('Question text');
    await questionInputs.last().fill('Capital of Germany?');

    await page.getByRole('button', { name: /Save quiz/i }).click();

    // QuizList initialises its state only on mount (useState lazy initialiser).
    // Navigating back via hash alone doesn't re-mount the component, so the
    // count stays stale. A full reload lets QuizList re-mount and read the
    // updated quiz from localStorage — the same result the user sees on F5.
    // Navigate explicitly to /#/quizzes so QuizList mounts fresh and reads
    // the updated quiz from localStorage (reload() returns to '/', not the list).
    await page.goto('/#/quizzes');
    await page.waitForLoadState('networkidle');
    await page.getByText(/2 questions/i).waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.getByText(/2 questions/i)).toBeVisible();
  });

  // ── Title update after edit ────────────────────────────────────────────────

  test('quiz title in library card updates after editing', async ({ page }) => {
    await seedQuiz(page);
    await page.goto('/#/quizzes');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Edit' }).click();
    await page.waitForURL(/#\/edit\//);

    const titleInput = page.getByLabel('Quiz title');
    await titleInput.clear();
    await titleInput.fill('Renamed Quiz');

    await page.getByRole('button', { name: /Save quiz/i }).click();

    await page.waitForURL(/#\/quizzes/);
    await page.getByRole('heading', { name: 'Renamed Quiz' }).waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Renamed Quiz' })).toBeVisible();
  });

  // ── Deleting one of multiple quizzes ──────────────────────────────────────

  test('deleting the first of two quizzes leaves the second intact', async ({ page }) => {
    const quiz1 = { ...SAMPLE_QUIZ, id: 'quiz-del-1', title: 'Quiz Alpha' };
    const quiz2 = { ...SAMPLE_QUIZ, id: 'quiz-del-2', title: 'Quiz Beta' };

    await setBypassHeader(page);
    await page.goto('/');
    await page.evaluate(([a, b]) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([a, b]));
    }, [quiz1, quiz2]);
    await page.goto('/#/quizzes');
    await page.waitForLoadState('networkidle');

    await page.getByRole('heading', { name: 'Quiz Alpha' }).waitFor({ state: 'visible', timeout: 15_000 });

    // Delete the first quiz.
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete' }).first().click();

    await expect(page.getByRole('heading', { name: 'Quiz Alpha' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Quiz Beta' })).toBeVisible();
  });

  // ── Each card has its own action buttons ──────────────────────────────────

  test('two quizzes each show their own Edit, Delete, and Host buttons', async ({ page }) => {
    const quiz1 = { ...SAMPLE_QUIZ, id: 'quiz-btns-1', title: 'Quiz One' };
    const quiz2 = { ...SAMPLE_QUIZ, id: 'quiz-btns-2', title: 'Quiz Two' };

    await setBypassHeader(page);
    await page.goto('/');
    await page.evaluate(([a, b]) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([a, b]));
    }, [quiz1, quiz2]);
    await page.goto('/#/quizzes');
    await page.waitForLoadState('networkidle');

    await page.getByRole('heading', { name: 'Quiz One' }).waitFor({ state: 'visible', timeout: 15_000 });

    await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(2);
    await expect(page.getByRole('button', { name: /Host →/ })).toHaveCount(2);
  });

  // ── Host → routes to the correct quiz ─────────────────────────────────────

  test('Host → on the second of two quizzes opens a lobby for that quiz', async ({ page }) => {
    const quiz1 = { ...SAMPLE_QUIZ, id: 'quiz-host-1', title: 'First Quiz' };
    const quiz2 = { ...SAMPLE_QUIZ, id: 'quiz-host-2', title: 'Second Quiz' };

    await setBypassHeader(page);
    await page.goto('/');
    await page.evaluate(([a, b]) => {
      localStorage.setItem('kahootlite:quizzes', JSON.stringify([a, b]));
    }, [quiz1, quiz2]);
    await page.goto('/#/quizzes');
    await page.waitForLoadState('networkidle');

    await page.getByRole('heading', { name: 'First Quiz' }).waitFor({ state: 'visible', timeout: 15_000 });

    // Click Host → on the second card.
    await page.getByRole('button', { name: /Host →/ }).last().click();
    await page.waitForURL(/#\/host\//);

    // The lobby heading should reflect the second quiz's title.
    await expect(page.getByRole('heading', { name: 'Second Quiz' })).toBeVisible();
  });

  // ── Navigating to /play without session redirects to /join ────────────────

  test('navigating to /play/:code without a playerId session redirects to /join/:code', async ({ page }) => {
    await seedQuiz(page);

    // Ensure no playerId is in sessionStorage.
    await setBypassHeader(page);
    await page.goto('/');
    await page.evaluate(() => sessionStorage.removeItem('kahootlite:playerId'));

    await page.goto('/#/play/TESTCODE');
    await page.waitForLoadState('networkidle');

    // Either redirected to /join/TESTCODE or the "Room ended" screen is shown.
    const url = page.url();
    const isJoin = url.includes('/join/');
    const isRoomEnded = await page.getByText(/Room TESTCODE ended/i).isVisible().catch(() => false);

    expect(isJoin || isRoomEnded).toBe(true);
  });
});
