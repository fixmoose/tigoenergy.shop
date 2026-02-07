import { test, expect } from '@playwright/test'

test('visit products page and assert UI', async ({ page, baseURL }) => {
  await page.goto('/products')
  await expect(page).toHaveURL(/\/products/)
  // basic smoke check: product list container exists
  await expect(page.locator('main')).toBeVisible()
})
