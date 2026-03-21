# AGENTE: PELUQUERÍA Y BARBERÍA
# Rama: feature/peluqueria
# Tarea: Añadir soporte completo para peluquerías y barberías

## PASO 1 — LEER PRIMERO
1. `CLAUDE.md` — reglas globales
2. `src/lib/templates.ts` — ver `peluqueria` y `barberia` en TYPE_MAP
   Ambas tienen: unitLabels sillón, hasSpaces: true
   peluqueria tiene módulo productos → `/productos` (Servicios y tarifas)
3. `src/lib/event-schemas.ts` — PELUQUERIA_CONFIG y entrada barberia
4. `src/app/(dashboard)/reservas/page.tsx` — patrón visual
5. `src/app/(dashboard)/productos/page.tsx` — ver si existe, si no crearlo

## PASO 2 — ANALIZAR
Peluquería/barbería tienen:
- Citas con: cliente, servicio, profesional, duración estimada
- Módulo de productos/servicios con precios
- Espacios: sillones

## PASO 3 — IMPLEMENTAR

### 3a. Vista de citas peluquería
Crea `src/app/(dashboard)/reservas/PeluReservasView.tsx`:
- Lista con: cliente, servicio (de `notes`), profesional (de `table_name`), hora, duración
- Badge de servicio: corte/tinte/mechas/tratamiento/barba
- Color accent: violeta para peluquería, gris para barbería
- Botón "Nueva cita"
- Realtime con cleanup

### 3b. Vista de servicios y tarifas
Verifica si existe `src/app/(dashboard)/productos/page.tsx`.
Si existe, añade vista específica para peluquería.
Si NO existe, crea `src/app/(dashboard)/productos/PeluProductosView.tsx`:
- Lista de servicios con nombre, precio, duración
- Categorías: corte / color / tratamiento / barba
- Tabla simple con datos mock (sin Supabase — servicios son estáticos)
- Botón "Añadir servicio" (solo UI, sin backend por ahora)

### 3c. Integrar
Edita `src/app/(dashboard)/reservas/page.tsx`:
```typescript
import PeluReservasView from './PeluReservasView'
if (tenant?.type === 'peluqueria' || tenant?.type === 'barberia') 
  return <PeluReservasView />
```

## PASO 4 — VERIFICAR
```
npx tsc --noEmit
```

## PASO 5 — COMMIT
```
git add -A
git commit -m "feat: peluqueria y barberia — citas y servicios"
```

## PASO 6 — MARCAR COMPLETADO
Crea `agents/status/PELUQUERIA.done`
