# AGENTE: FISIOTERAPIA
# Rama: feature/fisioterapia
# Tarea: Añadir soporte completo para clínicas de fisioterapia

## PASO 1 — LEER PRIMERO
Lee estos archivos antes de escribir una sola línea:
1. `CLAUDE.md` — reglas globales
2. `src/lib/templates.ts` — ver definición de `fisioterapia` en TYPE_MAP
3. `src/lib/event-schemas.ts` — ver entrada `fisioterapia` en CONFIG_MAP
4. `src/app/(dashboard)/reservas/page.tsx` — patrón visual a seguir
5. `src/app/(dashboard)/clientes/page.tsx` — patrón de clientes
6. `src/lib/clinic-engine.ts` — motor de decisión clínico (úsalo como referencia)

## PASO 2 — ANALIZAR
- ¿Qué labels usa fisioterapia? (paciente, cita, sin mesas/espacios)
- ¿Qué template base hereda? (servicios)
- ¿Qué tabla usa para citas? (`reservations` — UNIVERSAL)

## PASO 3 — IMPLEMENTAR

### 3a. Vista de citas fisio
Crea `src/app/(dashboard)/reservas/FisioReservasView.tsx`:
- Lista de citas con: nombre paciente, zona del cuerpo (de `notes`), fisioterapeuta (de `table_name` o `notes`)
- Badge de sesión: "Primera visita" vs "Seguimiento" vs "Urgente"
- Campo `notes` parseado para mostrar info relevante
- Filtro por estado (pendiente/confirmada/completada)
- Realtime subscription con cleanup
- Botón "Nueva cita" → `/reservas/nueva`
- Estilos inline idénticos al resto del proyecto

### 3b. Vista de pacientes fisio
Crea `src/app/(dashboard)/clientes/FisioClientesView.tsx`:
- Lista de pacientes con número de sesiones realizadas
- Indicador de "tratamiento activo" si tiene citas futuras
- Historial de sesiones al hacer click
- Datos de `customers` + join con `reservations` para contar sesiones

### 3c. Integrar en páginas existentes
Edita `src/app/(dashboard)/reservas/page.tsx`:
```typescript
import FisioReservasView from './FisioReservasView'
if (tenant?.type === 'fisioterapia') return <FisioReservasView />
```

Edita `src/app/(dashboard)/clientes/page.tsx`:
```typescript
import FisioClientesView from './FisioClientesView'
if (tenant?.type === 'fisioterapia') return <FisioClientesView />
```

### 3d. Motor de decisión fisio (opcional si da tiempo)
Si tienes tiempo, crea `src/lib/fisio-engine.ts` siguiendo el patrón de `clinic-engine.ts`:
- Clasificar sesión: primera_visita / seguimiento / urgente / valoracion
- Detectar palabras clave de urgencia específicas de fisio
- Duración por tipo: valoracion=60min, seguimiento=45min, urgente=30min

## PASO 4 — VERIFICAR
```
npx tsc --noEmit
```

## PASO 5 — COMMIT
```
git add -A
git commit -m "feat: fisioterapia — citas y pacientes"
```

## PASO 6 — MARCAR COMPLETADO
Crea `agents/status/FISIOTERAPIA.done`
