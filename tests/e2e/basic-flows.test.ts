/**
 * Basic E2E tests for critical flows.
 * Run with: npx tsx tests/e2e/basic-flows.test.ts
 */

const BASE = process.env.TEST_URL || 'https://restaurante-ai.vercel.app'

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    console.log(`\u2705 ${name}`)
  } catch (e: any) {
    console.error(`\u274C ${name}: ${e.message}`)
  }
}

async function main() {
  console.log('\uD83E\uDDEA Running E2E tests against', BASE)

  // Test 1: Landing loads
  await test('Landing page loads', async () => {
    const res = await fetch(BASE)
    if (!res.ok) throw new Error(`Status ${res.status}`)
    const html = await res.text()
    if (!html.includes('Reservo')) throw new Error('Missing Reservo text')
  })

  // Test 2: API health
  await test('Health API responds', async () => {
    const res = await fetch(`${BASE}/api/health`)
    if (!res.ok) throw new Error(`Status ${res.status}`)
    const data = await res.json()
    if (!data.status) throw new Error('Missing status field')
  })

  // Test 3: Public menu loads
  await test('Public menu page loads', async () => {
    // Need to find the slug first
    const res = await fetch(`${BASE}/carta/test`)
    // 404 is OK (no tenant), but should not be 500
    if (res.status === 500) throw new Error('Server error on carta page')
  })

  // Test 4: Public order API rejects invalid data
  await test('Public order API validates input', async () => {
    const res = await fetch(`${BASE}/api/orders/public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`)
  })

  // Test 5: Pricing page loads
  await test('Pricing page loads', async () => {
    const res = await fetch(`${BASE}/precios`)
    if (!res.ok) throw new Error(`Status ${res.status}`)
  })

  // Test 6: Tables API responds
  await test('Tables API responds', async () => {
    const res = await fetch(`${BASE}/api/tables`)
    if (!res.ok) throw new Error(`Status ${res.status}`)
    const data = await res.json()
    if (!Array.isArray(data.tables)) throw new Error('Invalid response format')
  })

  // Test 7: Login page loads
  await test('Login page loads', async () => {
    const res = await fetch(`${BASE}/login`)
    if (!res.ok) throw new Error(`Status ${res.status}`)
  })

  // Test 8: Register page loads
  await test('Register page loads', async () => {
    const res = await fetch(`${BASE}/registro`)
    if (!res.ok) throw new Error(`Status ${res.status}`)
  })

  console.log('\n\uD83C\uDFC1 Tests complete')
}

main()
