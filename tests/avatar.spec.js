import { test, expect } from '@playwright/test';
import { hostSeededQuiz, joinAs, seedQuiz } from './helpers';

function readEmojis(page, code) {
  return page.evaluate((roomKey) => {
    const room = JSON.parse(localStorage.getItem(roomKey) || 'null');
    return Object.values(room?.players ?? {}).map((p) => p.emoji);
  }, `kahootlite:room:${code}`);
}

test.describe('Flaky emoji-uniqueness suite', () => {
  test('2 players always receive different avatars', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    await joinAs(await context.newPage(), code, 'Alice');
    await joinAs(await context.newPage(), code, 'Bob');

    await expect(page.locator('.badge')).toHaveText('2');

    const emojis = await readEmojis(page, code);
    expect(emojis[0]).not.toBe(emojis[1]);
  });

  test('3 players all receive different avatars', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    await joinAs(await context.newPage(), code, 'Alice');
    await joinAs(await context.newPage(), code, 'Bob');
    await joinAs(await context.newPage(), code, 'Carol');

    await expect(page.locator('.badge')).toHaveText('3');

    const emojis = await readEmojis(page, code);
    const unique = new Set(emojis);
    expect(unique.size).toBe(emojis.length);
  });

  test('4 players all receive different avatars', async ({
    page,
    context,
  }) => {
    await seedQuiz(page);
    const code = await hostSeededQuiz(page);

    await joinAs(await context.newPage(), code, 'Alice');
    await joinAs(await context.newPage(), code, 'Bob');
    await joinAs(await context.newPage(), code, 'Carol');
    await joinAs(await context.newPage(), code, 'Dave');

    await expect(page.locator('.badge')).toHaveText('4');

    const emojis = await readEmojis(page, code);
    const unique = new Set(emojis);
    expect(unique.size).toBe(emojis.length);
  });
});
