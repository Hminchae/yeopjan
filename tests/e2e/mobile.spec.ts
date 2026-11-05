import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

test('mobile guest enters and completes a touch seat journey', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /혼자 마시고 싶지만/ })).toBeVisible();
  await expect(page.getByText(/지금 0명이 머무는 중/)).toBeVisible();
  await page.screenshot({ path: 'artifacts/screenshots/landing-mobile.png', fullPage: true });

  await page.getByRole('button', { name: '바에 입장하기' }).tap();
  await page.getByLabel('닉네임').fill('모바일잔');
  await page.getByRole('button', { name: 'burgundy 아바타' }).tap();
  await page.getByRole('button', { name: '퇴근했어요' }).tap();
  await page.getByLabel(/성인 대상 서비스임을 확인했어요/).check();
  await page.getByRole('button', { name: '이 모습으로 입장하기' }).tap();
  await expect(page.getByLabel(/옆잔 바 내부/)).toBeVisible();
  await expect(page.getByRole('button', { name: '빗소리 켜기' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '빗소리 켜기' }).tap();
  await expect(page.getByRole('button', { name: '빗소리 끄기' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('seat-counter-1').tap({ force: true });
  await expect(page.getByRole('button', { name: /모바일잔, 나/ })).toHaveAttribute('data-seat', 'counter-1');
  await expect(page.getByLabel('메시지')).toBeVisible();
  await page.screenshot({ path: 'artifacts/screenshots/bar-mobile.png', fullPage: true });
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});

test('adult confirmation is required', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '바에 입장하기' }).click();
  await expect(page.getByRole('button', { name: '이 모습으로 입장하기' })).toBeDisabled();
});
