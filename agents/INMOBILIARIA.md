# AGENTE: INMOBILIARIA
# Rama: feature/inmobiliaria
# Tarea: Añadir soporte completo para inmobiliarias

## PASO 1 — LEER PRIMERO
1. `CLAUDE.md` — reglas globales
2. `src/lib/templates.ts` — ver `inmobiliaria` en TYPE_MAP
   labels.reserva = 'Visita', labels.reservas = 'Visitas'
3. `src/lib/event-schemas.ts` — ver INMOBILIARIA_CONFIG completo
   Schemas: `lead` (nuevo contacto) + `visit` (visita)
   intentMap: visita→visit, consulta→lead, interesado→lead
4. `src/app/(dashboard)/reservas/page.tsx` — patrón visual
5. `src/app/(dashboard)/clientes/page.tsx` — patrón clientes

## PASO 2 — ANALIZAR
Inmobiliaria tiene DOS flujos principales:
1. **Leads** — clientes interesados que llaman (tabla `customers`)
2. **Visitas** — citas para ver propiedades (tabla `reservations`)

## PASO 3 — IMPLEMENTAR

### 3a. Vista de visitas (reservas)
Crea `src/app/(dashboard)/reservas/InmoReservasView.tsx`:
- Lista de visitas programadas con: cliente, propiedad (de `notes`), agente, fecha/hora
- Badge de estado: programada/realizada/cancelada
- Filtro por fecha: hoy / esta semana / todas
- Color accent: amber (`#F0A84E`)
- Realtime subscription con cleanup
- Botón "Nueva visita"

### 3b. Vista de leads/clientes
Crea `src/app/(dashboard)/clientes/InmoClientesView.tsx`:
- Lista de leads con: nombre, teléfono, qué busca (comprar/alquilar/vender)
- Badge de estado: nuevo/contactado/en_proceso/cerrado
- Presupuesto si está disponible en `notes`
- Al click: historial de contactos (calls) y visitas (reservations)
- Columna de "Última interacción"

### 3c. Panel de llamadas activas (leads en tiempo real)
El panel ya maneja esto vía INMOBILIARIA_CONFIG en event-schemas.ts.
Verifica que el panel /panel muestra bien los leads cuando tenant.type === 'inmobiliaria'.
Si no funciona, documenta el problema en el .done.

### 3d. Integrar en páginas existentes
Edita `src/app/(dashboard)/reservas/page.tsx`:
```typescript
import InmoReservasView from './InmoReservasView'
if (tenant?.type === 'inmobiliaria') return <InmoReservasView />
```

Edita `src/app/(dashboard)/clientes/page.tsx`:
```typescript
import InmoClientesView from './InmoClientesView'
if (tenant?.type === 'inmobiliaria') return <InmoClientesView />
```

## PASO 4 — VERIFICAR
```
npx tsc --noEmit
```

## PASO 5 — COMMIT
```
git add -A
git commit -m "feat: inmobiliaria — visitas y leads"
```

## PASO 6 — MARCAR COMPLETADO
Crea `agents/status/INMOBILIARIA.done`
