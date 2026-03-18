// Test del motor de plantillas — verifica que cada tipo de negocio
// recibe los módulos correctos y las etiquetas correctas.
import { resolveTemplate } from './src/lib/templates.js'

const CASOS = [
  // Hostelería
  { type:'restaurante', expectTemplate:'hosteleria', expectOrders:true,  expectSpaces:true,  expectUnit:'Mesa',     noModule:'citas' },
  { type:'bar',         expectTemplate:'hosteleria', expectOrders:true,  expectSpaces:true,  expectUnit:'Barra/Mesa',noModule:'citas' },
  // Servicios - sin espacios por defecto
  { type:'asesoria',    expectTemplate:'servicios',  expectOrders:false, expectSpaces:true,  expectUnit:'Despacho', noModule:'pedidos' },
  { type:'clinica_dental',expectTemplate:'servicios',expectOrders:false, expectSpaces:true,  expectUnit:'Silla',    noModule:'pedidos' },
  { type:'clinica_medica',expectTemplate:'servicios',expectOrders:false, expectSpaces:true,  expectUnit:'Consulta', noModule:'pedidos' },
  { type:'peluqueria',  expectTemplate:'servicios',  expectOrders:false, expectSpaces:true,  expectUnit:'Sillón',   noModule:'pedidos' },
  { type:'seguros',     expectTemplate:'servicios',  expectOrders:false, expectSpaces:false, expectUnit:'Consulta', noModule:'pedidos' },
  { type:'inmobiliaria',expectTemplate:'servicios',  expectOrders:false, expectSpaces:false, expectUnit:'Consulta', noModule:'pedidos' },
  { type:'otro',        expectTemplate:'servicios',  expectOrders:false, expectSpaces:false, expectUnit:'Consulta', noModule:'pedidos' },
]

console.log('\n═══════════════════════════════════════════════════')
console.log('  TEST MOTOR DE PLANTILLAS')
console.log('═══════════════════════════════════════════════════\n')

let pass = 0, fail = 0

for (const caso of CASOS) {
  const tmpl = resolveTemplate(caso.type)
  const errors = []

  if (tmpl.id !== caso.expectTemplate)
    errors.push(`template: esperado '${caso.expectTemplate}', got '${tmpl.id}'`)

  if (tmpl.hasOrders !== caso.expectOrders)
    errors.push(`hasOrders: esperado ${caso.expectOrders}, got ${tmpl.hasOrders}`)

  if (tmpl.hasSpaces !== caso.expectSpaces)
    errors.push(`hasSpaces: esperado ${caso.expectSpaces}, got ${tmpl.hasSpaces}`)

  if (tmpl.labels.unit.singular !== caso.expectUnit)
    errors.push(`unit.singular: esperado '${caso.expectUnit}', got '${tmpl.labels.unit.singular}'`)

  // Verificar que el módulo prohibido no está en el nav
  const modIds = tmpl.modules.map(m => m.id)
  if (caso.noModule === 'pedidos' && modIds.includes('pedidos'))
    errors.push(`módulo 'pedidos' NO debería estar en ${caso.type}`)
  if (caso.noModule === 'citas' && modIds.includes('citas'))
    errors.push(`módulo 'citas' NO debería estar en ${caso.type}`)

  // Verificar que tiene agentContext
  if (!tmpl.agentContext || tmpl.agentContext.length < 20)
    errors.push('agentContext vacío o muy corto')

  const ok = errors.length === 0
  ok ? pass++ : fail++

  const modules = modIds.join(', ')
  console.log((ok ? '  ✅' : '  ❌') + ` ${caso.type.padEnd(14)} → ${tmpl.id} | unit: ${tmpl.labels.unit.singular.padEnd(12)} | módulos: [${modules}]`)
  if (!ok) errors.forEach(e => console.log('         └─ ERROR:', e))
}

console.log(`\n  Resultado: ${pass}/${pass+fail} tests pasaron\n`)
if (fail > 0) process.exit(1)
