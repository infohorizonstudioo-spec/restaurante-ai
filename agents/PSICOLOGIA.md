# AGENTE: PSICOLOGÍA
# Rama: feature/psicologia
# Tarea: Añadir soporte completo para centros de psicología

## PASO 1 — LEER PRIMERO
1. `CLAUDE.md` — reglas globales
2. `src/lib/templates.ts` — ver definición de `psicologia` en TYPE_MAP
   IMPORTANTE: labels.reserva = 'Sesión', labels.cliente = 'Paciente'
   agentContext: con TOTAL DISCRECIÓN, sin preguntar el motivo
3. `src/lib/event-schemas.ts` — ver `psicologia` en CONFIG_MAP (schemas propios: appointment con icon 🧠)
4. `src/app/(dashboard)/reservas/page.tsx` — patrón visual
5. `src/app/(dashboard)/clientes/page.tsx` — patrón clientes

## PASO 2 — CONSIDERACIONES ESPECIALES
Psicología requiere MÁXIMA discreción:
- NUNCA mostrar motivo de consulta en listas
- NUNCA mostrar notas clínicas en vistas principales
- Solo mostrar: nombre, fecha, hora, terapeuta, tipo (primera/seguimiento)
- Los datos sensibles solo visibles en detalle con click explícito

## PASO 3 — IMPLEMENTAR

### 3a. Vista de sesiones (psicología)
Crea `src/app/(dashboard)/reservas/PsicoReservasView.tsx`:
- Lista con: nombre paciente, fecha, hora, terapeuta, tipo sesión
- Badge: "Primera sesión" (verde) | "Seguimiento" (azul) | "Pareja" (violeta)
- Modalidad: presencial/online (si está en notes)
- SIN mostrar motivo ni notas en la lista
- Detalle al click: muestra más info pero sigue siendo discreto
- Color accent: violeta (`#A78BFA`) en lugar de teal
- Realtime subscription con cleanup

### 3b. Vista de pacientes psicología
Crea `src/app/(dashboard)/clientes/PsicoClientesView.tsx`:
- Lista de pacientes con número de sesiones y última sesión
- Avatar con inicial
- Terapeuta asignado si lo hay
- NUNCA mostrar notas ni motivo en la lista
- Historial discreto al click: solo fechas y tipo de sesión

### 3c. Integrar en páginas existentes
Edita `src/app/(dashboard)/reservas/page.tsx`:
```typescript
import PsicoReservasView from './PsicoReservasView'
if (tenant?.type === 'psicologia') return <PsicoReservasView />
```

Edita `src/app/(dashboard)/clientes/page.tsx`:
```typescript
import PsicoClientesView from './PsicoClientesView'
if (tenant?.type === 'psicologia') return <PsicoClientesView />
```

## PASO 4 — VERIFICAR
```
npx tsc --noEmit
```

## PASO 5 — COMMIT
```
git add -A
git commit -m "feat: psicologia — sesiones y pacientes con discrecion"
```

## PASO 6 — MARCAR COMPLETADO
Crea `agents/status/PSICOLOGIA.done`
