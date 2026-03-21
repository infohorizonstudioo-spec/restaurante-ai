# RESERVO.AI — REGLAS GLOBALES PARA AGENTES

## PROYECTO
- Repo: `C:\Users\krush\restaurante-ai`
- Stack: Next.js + TypeScript + Supabase + Tailwind
- Deploy: Vercel (auto desde `main`)

## ARQUITECTURA — LEE ESTO ANTES DE TOCAR NADA

### Motor de plantillas (FUENTE DE VERDAD)
- `src/lib/templates.ts` — define todos los tipos de negocio y sus labels/módulos
- `src/lib/event-schemas.ts` — define schemas de eventos por tipo de negocio
- `src/contexts/TenantContext.tsx` — contexto React con tenant + template
- `src/lib/supabase.ts` — cliente Supabase (NO modificar)

### Patrón de páginas existente
Cada página usa `useTenant()` para obtener labels dinámicos:
```typescript
const { tenant, template } = useTenant()
const L = template?.labels  // labels dinámicos (reserva, citas, paciente...)
```

### Paleta de colores (NO inventar colores nuevos)
```
bg: #0C1018 | surface: #131920 | surface2: #1A2230
amber: #F0A84E | teal: #2DD4BF | green: #34D399
red: #F87171 | violet: #A78BFA | blue: #60A5FA
text: #E8EEF6 | text2: #8895A7 | text3: #49566A
border: rgba(255,255,255,0.07)
```

### Estructura de componentes existentes
```
src/components/
  Sidebar.tsx          — NO TOCAR
  DashboardShell.tsx   — NO TOCAR
  NotifBell.tsx        — NO TOCAR
  NotificationBell.tsx — NO TOCAR
  ui/                  — componentes base reutilizables
src/lib/
  templates.ts         — NO TOCAR (solo leer)
  event-schemas.ts     — NO TOCAR (solo leer)
  supabase.ts          — NO TOCAR
  agent-decision.ts    — NO TOCAR (solo leer)
  clinic-engine.ts     — NO TOCAR (solo leer, úsalo como referencia)
src/types/index.ts     — NO TOCAR
src/contexts/          — NO TOCAR
```

## REGLAS OBLIGATORIAS

1. **TODAS las queries Supabase DEBEN tener `.eq('tenant_id', tenantId)`** — sin excepción
2. **Seguir el patrón de colores y estilos inline** — igual que panel/page.tsx y reservas/page.tsx
3. **Usar `useTenant()` y `template?.labels`** para todos los textos dinámicos
4. **Cada vertical usa `if (tenant?.type !== 'TIPO') return null`** en sus componentes específicos
5. **NO crear nuevas tablas Supabase** sin consultar primero las existentes
6. **NO modificar archivos protegidos** (listados arriba)
7. **NO usar `console.log` en producción** — usar solo para debug temporal
8. **Realtime subscriptions DEBEN tener cleanup**: `return () => { supabase.removeChannel(ch) }`

## TABLAS SUPABASE EXISTENTES
- `tenants` — datos del negocio
- `profiles` — usuarios vinculados a tenants
- `reservations` — citas/reservas (UNIVERSAL para todas las verticales)
- `customers` — clientes/pacientes
- `calls` — llamadas del agente de voz
- `notifications` — notificaciones
- `order_events` — pedidos (hostelería)
- `consultation_events` — consultas clínica

## CÓMO NOTIFICAR COMPLETADO
Al terminar, crear el archivo:
`agents/status/NOMBRE_AGENTE.done`
Con contenido: `COMPLETADO` y lista de archivos creados/modificados.
