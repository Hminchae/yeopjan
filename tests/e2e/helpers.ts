import { expect, type Page } from '@playwright/test';

export async function enterBar(page: Page, nickname: string) {
  await page.goto('/');
  await page.getByRole('button', { name: '바에 입장하기' }).click();
  await page.getByLabel('닉네임').fill(nickname);
  await page.getByLabel(/성인 대상 서비스임을 확인했어요/).check();
  await page.getByRole('button', { name: '이 모습으로 입장하기' }).click();
  await expect(page.getByLabel(/옆잔 바 내부/)).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`${nickname}, 나`) })).toBeVisible();
}
