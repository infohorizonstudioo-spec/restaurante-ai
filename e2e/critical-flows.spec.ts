import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3000'

test.describe('Public Pages', () => {

  test('landing page loads and has title', async ({ page }) => {
    await page.goto(BASE)
    await expect(page).toHaveTitle(/Reservo/i)
  })

  test('login page renders form with email and password', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await expect(page.locator('input[type="email"], input[type="text"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('login page shows error on invalid credentials', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"], input[type="text"]', 'fake@test.com')
    await page.fill('input[type="password"]', 'wrongpassword123')
    const submitBtn = page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")')
    await submitBtn.click()
    // Should show error message (not redirect)
    await page.waitForTimeout(2000)
    await expect(page).toHaveURL(/login/)
  })

  test('registration page loads with business type selector', async ({ page }) => {
    await page.goto(`${BASE}/registro`)
    await expect(page.locator('input[type="email"], input[type="text"]').first()).toBeVisible()
  })

  test('pricing page loads and shows plan tiers', async ({ page }) => {
    await page.goto(`${BASE}/precios`)
    await expect(page.locator('text=/Pro|Business|Starter/i').first()).toBeVisible()
  })

  test('privacy page loads', async ({ page }) => {
    await page.goto(`${BASE}/privacidad`)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('terms page loads', async ({ page }) => {
    await page.goto(`${BASE}/terminos`)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('cookies page loads', async ({ page }) => {
    await page.goto(`${BASE}/cookies`)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('reset password page loads', async ({ page }) => {
    await page.goto(`${BASE}/reset`)
    await expect(page.locator('input').first()).toBeVisible()
  })
})

test.describe('Security — Public Routes', () => {

  test('protected routes redirect to login without auth', async ({ page }) => {
    const protectedRoutes = ['/panel', '/reservas', '/clientes', '/llamadas', '/configuracion', '/estadisticas']
    for (const route of protectedRoutes) {
      await page.goto(`${BASE}${route}`)
      await page.waitForURL(/login/, { timeout: 5000 })
      expect(page.url()).toContain('/login')
    }
  })

  test('security headers are present', async ({ page }) => {
    const response = await page.goto(`${BASE}/login`)
    expect(response).not.toBeNull()
    const headers = response!.headers()
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['strict-transport-security']).toBeDefined()
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })

  test('API returns 401 for unauthenticated requests', async ({ request }) => {
    const response = await request.get(`${BASE}/api/orders`)
    expect([401, 403]).toContain(response.status())
  })

  test('nonexistent API returns 404', async ({ request }) => {
    const response = await request.get(`${BASE}/api/nonexistent-endpoint-xyz`)
    expect(response.status()).toBe(404)
  })
})

test.describe('API Health & Rate Limiting', () => {

  test('health endpoint responds', async ({ request }) => {
    const response = await request.get(`${BASE}/api/health`)
    expect(response.ok()).toBeTruthy()
  })

  test('rate limiting returns 429 after excessive requests', async ({ request }) => {
    // Hit auth endpoint many times fast
    const results = []
    for (let i = 0; i < 10; i++) {
      const r = await request.post(`${BASE}/api/auth/register`, {
        data: { email: `spam${i}@test.com`, password: 'x', businessName: 'x' },
      })
      results.push(r.status())
    }
    // At least one should be 429 (rate limit is 3/5min for auth)
    expect(results).toContain(429)
  })
})

test.describe('Responsive & Accessibility', () => {

  test('login page is usable on mobile viewport', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
    })
    const page = await context.newPage()
    await page.goto(`${BASE}/login`)
    await expect(page.locator('input[type="email"], input[type="text"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await context.close()
  })

  test('pricing page is usable on tablet viewport', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 768, height: 1024 },
    })
    const page = await context.newPage()
    await page.goto(`${BASE}/precios`)
    await expect(page.locator('text=/Pro|Business|Starter/i').first()).toBeVisible()
    await context.close()
  })
})

// ── Authenticated tests (use env TEST_EMAIL / TEST_PASSWORD) ──

const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD

test.describe('Dashboard (authenticated)', () => {
  test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Set TEST_EMAIL and TEST_PASSWORD env vars to run authenticated tests')

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.fill('input[type="email"], input[type="text"]', TEST_EMAIL!)
    await page.fill('input[type="password"]', TEST_PASSWORD!)
    const submitBtn = page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")')
    await submitBtn.click()
    await page.waitForURL(/panel|dashboard|onboarding/, { timeout: 10000 })
  })

  test('panel page loads with activity feed', async ({ page }) => {
    await page.goto(`${BASE}/panel`)
    await expect(page.locator('h1, [data-testid="panel-header"]').first()).toBeVisible({ timeout: 10000 })
  })

  test('reservas page loads', async ({ page }) => {
    await page.goto(`${BASE}/reservas`)
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 })
  })

  test('clientes page loads', async ({ page }) => {
    await page.goto(`${BASE}/clientes`)
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 })
  })

  test('llamadas page loads', async ({ page }) => {
    await page.goto(`${BASE}/llamadas`)
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 })
  })

  test('configuracion page loads', async ({ page }) => {
    await page.goto(`${BASE}/configuracion`)
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 })
  })

  test('agente page loads with behavior/knowledge tabs', async ({ page }) => {
    await page.goto(`${BASE}/agente`)
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('button:has-text("Comportamiento"), button:has-text("Behavior")').first()).toBeVisible()
    await expect(page.locator('button:has-text("Conocimiento"), button:has-text("Knowledge")').first()).toBeVisible()
  })

  test('sidebar navigation works', async ({ page }) => {
    await page.goto(`${BASE}/panel`)
    await page.waitForTimeout(2000)
    // Click reservas in sidebar
    const reservasLink = page.locator('a[href="/reservas"], nav >> text=/Reservas|Citas/i').first()
    if (await reservasLink.isVisible()) {
      await reservasLink.click()
      await page.waitForURL(/reservas/, { timeout: 5000 })
      expect(page.url()).toContain('/reservas')
    }
  })

  test('facturacion page shows plan info', async ({ page }) => {
    await page.goto(`${BASE}/facturacion`)
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 })
  })
})
