import { test, expect } from '@playwright/test';
import { enterBar } from './helpers';

test('two isolated browsers see movement, chat, cheers, seat collision and cleanup', async ({ browser }) => {
  const contextA = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const contextB = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const contextC = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const a = await contextA.newPage(); const b = await contextB.newPage(); const c = await contextC.newPage();
  await enterBar(a, '밤산책A');
  await enterBar(b, '느린파도B');
  await enterBar(c, '창가별C');

  await expect(a.getByRole('button', { name: /^느린파도B/ })).toBeVisible();
  await expect(b.getByRole('button', { name: /^밤산책A/ })).toBeVisible();

  await Promise.all([
    a.getByTestId('seat-counter-1').click({ force: true }),
    b.getByTestId('seat-counter-1').click({ force: true })
  ]);
  await expect.poll(async () => {
    const values = await Promise.all([
      a.getByRole('button', { name: /밤산책A, 나/ }).getAttribute('data-seat'),
      b.getByRole('button', { name: /느린파도B, 나/ }).getAttribute('data-seat')
    ]);
    return values.filter((value) => value === 'counter-1').length;
  }).toBe(1);
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

  await b.screenshot({ path: 'artifacts/screenshots/bar-desktop-multiplayer.png', fullPage: true });
  await contextA.close();
  await expect(b.getByRole('button', { name: /^밤산책A/ })).toHaveCount(0, { timeout: 5_000 });

  await contextB.close(); await contextC.close();
});
