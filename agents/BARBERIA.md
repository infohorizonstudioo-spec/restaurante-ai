# AGENTE: BARBERÍA
# Rama: feature/barberia
# Tarea: Soporte completo para barberías (separado de peluquería)

## PASO 1 — LEER PRIMERO
1. `CLAUDE.md` — reglas globales
2. `src/lib/templates.ts` — ver `barberia` en TYPE_MAP
   unitLabels: sillón 🪒, agentContext especifico de barbería
3. `src/lib/event-schemas.ts` — ver entrada `barberia` en CONFIG_MAP
   (hereda de PELUQUERIA_CONFIG pero con demoEvents propios de barbería)
4. `src/app/(dashboard)/reservas/page.tsx` — patrón visual
5. Leer el agente PELUQUERIA.md para NO duplicar — barbería tiene diferencias reales

## PASO 2 — DIFERENCIAS BARBERÍA vs PELUQUERÍA
Barbería tiene servicios específicos: corte, barba, afeitado clásico, diseño barba, tinte barba.
La estética es más masculina/premium. Color accent: usar `#F0A84E` (amber) en vez de violeta.
Los "profesionales" se llaman barberos, no estilistas.

## PASO 3 — IMPLEMENTAR

### 3a. Vista de citas barbería
Crea `src/app/(dashboard)/reservas/BarbeReservasView.tsx`:
- Lista de citas con: cliente, servicio (de `notes`), barbero (de `table_name`), hora, duración
- Badges de servicio: corte/barba/afeitado/tinte/diseño
- Color amber para badges y accents (diferente a peluquería)
- Filtro por barbero (si hay varios en `table_name`)
- Botón "Nueva cita"
- Realtime subscription con cleanup
- Patrón visual IDÉNTICO al resto del proyecto (mismos colores bg/surface/border)

### 3b. Vista de servicios barbería
Crea `src/app/(dashboard)/productos/BarbeProductosView.tsx`:
- Catálogo de servicios con precio y duración
- Categorías: Corte | Barba | Combo | Tratamiento
- UI simple tipo tabla/cards
- Datos mock iniciales (Corte 15€/30min, Barba 12€/20min, Combo 22€/45min...)

### 3c. Integrar
Edita `src/app/(dashboard)/reservas/page.tsx`:
```typescript
import BarbeReservasView from './BarbeReservasView'
if (tenant?.type === 'barberia') return <BarbeReservasView />
```

## PASO 4 — VERIFICAR
```
npx tsc --noEmit
```

## PASO 5 — COMMIT
```
git add -A
git commit -m "feat: barberia — citas y servicios"
```

## PASO 6 — MARCAR COMPLETADO
Crea `agents/status/BARBERIA.done`
