# AGENTE: VETERINARIA
# Rama: feature/veterinaria
# Tarea: Añadir soporte completo para clínicas veterinarias

## PASO 1 — LEER PRIMERO
Lee estos archivos antes de escribir una sola línea:
1. `CLAUDE.md` — reglas globales
2. `src/lib/templates.ts` — ver definición de `veterinaria` en TYPE_MAP
3. `src/lib/event-schemas.ts` — ver VETERINARIA_CONFIG completo
4. `src/app/(dashboard)/reservas/page.tsx` — patrón a seguir para listas
5. `src/app/(dashboard)/clientes/page.tsx` — patrón a seguir para clientes
6. `src/app/(dashboard)/panel/page.tsx` — ver cómo usa `resolveTemplate` y `getEventConfig`

## PASO 2 — ANALIZAR
Responde estas preguntas ANTES de crear archivos:
- ¿Qué labels usa `veterinaria` en templates.ts? (cliente, reserva, unit...)
- ¿Qué schemas tiene VETERINARIA_CONFIG en event-schemas.ts?
- ¿Qué módulos de nav tiene la plantilla veterinaria?
- ¿Qué tabla Supabase existe para citas? (reservations — UNIVERSAL)

## PASO 3 — IMPLEMENTAR

### 3a. Página de citas veterinarias especializada
Crea `src/app/(dashboard)/reservas/VetReservasView.tsx`:
- Lista de citas con campos específicos: dueño, nombre mascota, especie, servicio
- Filtro por especie (perro/gato/conejo/otro)
- Badge de urgencia si `notes` contiene palabras clave urgentes
- Modal de detalle con todos los campos
- Realtime subscription a `reservations` con tenant_id
- Patrón visual IDÉNTICO a reservas/page.tsx (mismos colores, estilos inline)

### 3b. Vista de mascotas/clientes
Crea `src/app/(dashboard)/clientes/VetClientesView.tsx`:
- Lista de dueños con sus mascotas agrupadas
- Avatar con inicial del dueño
- Badge con especie de cada mascota
- Historial de visitas al hacer click
- Fuente de datos: tabla `customers` (con .eq('tenant_id', tenantId))

### 3c. Integrar en las páginas existentes
Edita `src/app/(dashboard)/reservas/page.tsx`:
```typescript
import VetReservasView from './VetReservasView'
// Al inicio del componente, ANTES del return principal:
if (tenant?.type === 'veterinaria') return <VetReservasView />
```

Edita `src/app/(dashboard)/clientes/page.tsx`:
```typescript
import VetClientesView from './VetClientesView'
if (tenant?.type === 'veterinaria') return <VetClientesView />
```

### 3d. Contexto de voz específico
Verifica que en `templates.ts` el `agentContext` de veterinaria pregunta:
nombre del dueño, nombre y especie de la mascota, motivo y fecha.
Si NO está — NO modificar templates.ts, solo documentarlo en el .done.

## PASO 4 — VERIFICAR
```
npx tsc --noEmit
```
0 errores TypeScript antes de hacer commit.

## PASO 5 — COMMIT
```
git add -A
git commit -m "feat: veterinaria — citas y clientes"
```

## PASO 6 — MARCAR COMPLETADO
Crea `agents/status/VETERINARIA.done` con:
- Lista de archivos creados
- Lista de archivos modificados
- Resultado del tsc
- Cualquier decisión arquitectónica tomada
