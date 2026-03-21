# AGENTE: QA Y ERRORES
# Rama: feature/qa
# Tarea: Verificar que todo el código compila, detectar bugs y corregirlos

## PASO 1 — LEER PRIMERO
1. `CLAUDE.md` — reglas globales
2. Todos los archivos en `src/app/(dashboard)/`
3. Todos los archivos en `src/components/`
4. Todos los archivos en `src/lib/`

## PASO 2 — EJECUTAR VERIFICACIONES

### TypeScript
```
npx tsc --noEmit 2>&1
```
Lista TODOS los errores. No corrijas nada todavía.

### Build de Next.js
```
npm run build 2>&1
```
Lista todos los warnings y errores de build.

### Linting
```
npx eslint src/ --ext .ts,.tsx 2>&1
```

## PASO 3 — CORREGIR EN ORDEN DE PRIORIDAD

### Prioridad 1: Errores que rompen el build
- Errores TypeScript que impiden compilar
- Imports rotos
- Tipos incorrectos

### Prioridad 2: Errores de runtime
- undefined access sin nullcheck
- Async/await sin try-catch en rutas API
- Missing `.eq('tenant_id', tenantId)` en queries Supabase
- Subscriptions realtime sin cleanup

### Prioridad 3: Warnings importantes
- `any` types donde se puede ser más específico
- Variables no usadas
- Dependencias faltantes en useEffect

### Prioridad 4: UX bugs
- Modales que no cierran con Escape
- Dropdowns que no cierran al clickar fuera
- Loading states faltantes
- Empty states faltantes

## PASO 4 — VERIFICAR TENANT ISOLATION
Para CADA query Supabase en el proyecto:
```
grep -r "from('reservations')" src/ | grep -v "tenant_id"
grep -r "from('customers')" src/ | grep -v "tenant_id"
grep -r "from('calls')" src/ | grep -v "tenant_id"
```
Si hay queries sin tenant_id filter → corrígelas INMEDIATAMENTE.

## PASO 5 — VERIFICAR REALTIME CLEANUP
Para cada `supabase.channel(` en el proyecto, verificar que hay:
```typescript
return () => { supabase.removeChannel(ch) }
```
Si falta → añadirlo.

## PASO 6 — BUILD FINAL
```
npx tsc --noEmit
npm run build
```
Ambos deben pasar sin errores.

## PASO 7 — COMMIT
```
git add -A
git commit -m "fix: qa — errores TypeScript, tenant isolation, cleanup"
```

## PASO 8 — REPORTE
Crea `agents/status/QA.done` con:
- Número de errores TypeScript encontrados y corregidos
- Número de queries sin tenant_id encontradas y corregidas
- Número de subscriptions sin cleanup corregidas
- Lista de bugs de UX corregidos
- Lista de issues pendientes (que no pudo corregir)
- Estado final del build

## IMPORTANTE
Si encuentras un error que NO puedes corregir sin romper otra cosa,
documéntalo en QA.done y NO lo corrijas. El agente de deploy decidirá.
