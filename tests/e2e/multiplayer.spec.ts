import { test, expect } from '@playwright/test';
import { enterBar } from './helpers';

test('two isolated browsers see movement, chat, cheers, seat collision and cleanup', async ({ browser }) => {
  test.setTimeout(60_000);
  const contextA = await browser.newContext({ viewport: { width: 1280, height: 820 }, reducedMotion: 'reduce' });
  const contextB = await browser.newContext({ viewport: { width: 1280, height: 820 }, reducedMotion: 'reduce' });
  const contextC = await browser.newContext({ viewport: { width: 1280, height: 820 }, reducedMotion: 'reduce' });
  const a = await contextA.newPage(); const b = await contextB.newPage(); const c = await contextC.newPage();
  await enterBar(a, '밤산책A');
  await enterBar(b, '느린파도B');
  await enterBar(c, '창가별C');

  await expect(a.getByRole('button', { name: /^느린파도B/ })).toBeVisible();
  await expect(b.getByRole('button', { name: /^밤산책A/ })).toBeVisible();
  await expect(a.locator('canvas[data-renderer="three-webgl"]')).toBeVisible();

  await a.keyboard.down('ArrowLeft');
  await a.waitForTimeout(300);
  await a.keyboard.up('ArrowLeft');
  await expect.poll(async () => Number(await b.getByRole('button', { name: /^밤산책A/ }).getAttribute('data-x'))).toBeLessThan(90);

  await a.getByRole('button', { name: /내 잔:/ }).click();
  await a.getByRole('button', { name: /위스키/ }).click();
  await expect(a.getByRole('button', { name: /밤산책A, 나/ })).toHaveAttribute('data-drink', 'whiskey');
  await expect(b.getByRole('button', { name: /^밤산책A/ })).toHaveAttribute('data-drink', 'whiskey');
  await expect(b.getByRole('button', { name: /^밤산책A/ }).getByLabel('선택한 주종: 위스키')).toHaveText('🥃');

  await Promise.all([
    a.getByTestId('seat-counter-1').click({ force: true }),
    b.getByTestId('seat-counter-1').click({ force: true })
  ]);
  await expect(a.locator('.guest-avatar[data-seat="counter-1"]')).toHaveCount(1);
  await expect(b.locator('.guest-avatar[data-seat="counter-1"]')).toHaveCount(1);

  const aSeat = await a.getByRole('button', { name: /밤산책A, 나/ }).getAttribute('data-seat');
  const counterA = aSeat === 'counter-1' ? a : b;
  const counterB = aSeat === 'counter-1' ? b : a;
  if (aSeat === 'counter-1') {
    await b.getByTestId('seat-counter-2').click({ force: true });
    await expect(b.getByRole('button', { name: /느린파도B, 나/ })).toHaveAttribute('data-seat', 'counter-2');
  } else {
    await a.getByTestId('seat-counter-2').click({ force: true });
    await expect(a.getByRole('button', { name: /밤산책A, 나/ })).toHaveAttribute('data-seat', 'counter-2');
  }
  await c.getByTestId('seat-table-2-1').click({ force: true });
  await expect(c.getByRole('button', { name: /창가별C, 나/ })).toHaveAttribute('data-seat', 'table-2-1');

  await counterA.getByLabel('메시지').fill('<script>safe text</script>');
  await counterA.getByRole('button', { name: '보내기' }).click();
  await expect(counterA.getByText('<script>safe text</script>')).toBeVisible();
  await expect(counterB.getByText('<script>safe text</script>')).toBeVisible();
  await expect(c.getByText('<script>safe text</script>')).toHaveCount(0);

  await counterA.getByRole('button', { name: /짠!/ }).click();
  await expect(counterB.getByRole('status')).toContainText('짠!');
  await expect(c.getByRole('status')).not.toContainText('짠!');

  const otherName = counterA === a ? '느린파도B' : '밤산책A';
  await counterA.getByRole('button', { name: new RegExp(`^${otherName}`) }).click();
  await counterA.getByRole('button', { name: '음소거' }).click();
  await counterA.getByRole('button', { name: '차단 전환' }).click();
  await expect(counterA.getByRole('status')).toContainText('차단');
  await counterA.getByRole('button', { name: '신고하기' }).click();
  await expect(counterA.getByRole('status')).toContainText('신고가 접수');
  await counterA.getByRole('button', { name: '닫기' }).click();

  await b.screenshot({ path: 'artifacts/screenshots/bar-desktop-multiplayer.png' });
  await contextA.close();
  await expect(b.getByRole('button', { name: /^밤산책A/ })).toHaveCount(0, { timeout: 5_000 });

  await contextB.close(); await contextC.close();
});
