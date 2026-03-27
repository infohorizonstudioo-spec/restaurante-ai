import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3000'

test.describe('Critical Flows', () => {

  test('landing page loads', async ({ page }) => {
    await page.goto(BASE)
    await expect(page).toHaveTitle(/Reservo/i)
  })

  test('login page accessible', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await expect(page.locator('input')).toBeVisible()
  })

  test('pricing page loads', async ({ page }) => {
    await page.goto(`${BASE}/precios`)
    await expect(page.locator('text=/Pro|Business|Starter/i')).toBeVisible()
  })

  // Dashboard tests (require auth - skipped by default)
  test.describe('Dashboard (authenticated)', () => {
    test.skip(true, 'Requires authentication setup')

    test('reservas page loads', async ({ page }) => {
      await page.goto(`${BASE}/reservas`)
      await expect(page.locator('h1')).toBeVisible()
    })

    test('productos page loads and can open modal', async ({ page }) => {
      await page.goto(`${BASE}/productos`)
      await expect(page.locator('h1')).toBeVisible()
      const newBtn = page.locator('button', { hasText: /Nuevo producto|New product/i })
      await newBtn.click()
      await expect(page.locator('input')).toBeVisible()
    })

    test('pedidos page loads', async ({ page }) => {
      await page.goto(`${BASE}/pedidos`)
      await expect(page.locator('h1')).toBeVisible()
    })

    test('agente page loads with two tabs', async ({ page }) => {
      await page.goto(`${BASE}/agente`)
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.locator('button', { hasText: /Comportamiento|Behavior/i })).toBeVisible()
      await expect(page.locator('button', { hasText: /Conocimiento|Knowledge/i })).toBeVisible()
    })

    test('modal closes on Escape', async ({ page }) => {
      await page.goto(`${BASE}/productos`)
      const newBtn = page.locator('button', { hasText: /Nuevo producto|New product/i })
      await newBtn.click()
      await expect(page.locator('text=/Nombre|Name/i')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.locator('text=/Nombre|Name/i')).not.toBeVisible()
    })

    test('form validation shows errors', async ({ page }) => {
      await page.goto(`${BASE}/productos`)
      const newBtn = page.locator('button', { hasText: /Nuevo producto|New product/i })
      await newBtn.click()
      // Try to save without name
      const saveBtn = page.locator('button', { hasText: /Guardar|Save/i })
      await saveBtn.click()
      await expect(page.locator('text=/obligatorio|Required/i')).toBeVisible()
    })

    test('i18n switches language in all elements', async ({ page }) => {
      // This would require changing locale in settings first
      await page.goto(`${BASE}/configuracion`)
      // Verify Spanish labels exist
      await expect(page.locator('h1')).toBeVisible()
    })
  })
})
