# AGENTE: DEPLOY
# Rama: main (trabaja directamente en main)
# Tarea: Merge de todas las ramas, verificación final y deploy a Vercel
# IMPORTANTE: Este agente se ejecuta ÚLTIMO, cuando todos los otros han terminado

## PASO 1 — VERIFICAR QUE TODOS ESTÁN LISTOS
Comprueba que existen estos archivos:
- `agents/status/VETERINARIA.done`
- `agents/status/FISIOTERAPIA.done`
- `agents/status/PSICOLOGIA.done`
- `agents/status/INMOBILIARIA.done`
- `agents/status/PELUQUERIA.done`
- `agents/status/BARBERIA.done`
- `agents/status/ASESORIA.done`
- `agents/status/ECOMMERCE.done`
- `agents/status/ACADEMIA.done`
- `agents/status/SECURITY.done`
- `agents/status/QA.done`

Si alguno NO existe, NO hagas el merge. Espera.

## PASO 2 — MERGE EN ORDEN

Ejecuta en orden, resolviendo conflictos si los hay:
```
git checkout main
git merge feature/security --no-ff -m "merge: security"
git merge feature/veterinaria --no-ff -m "merge: veterinaria"
git merge feature/fisioterapia --no-ff -m "merge: fisioterapia"
git merge feature/psicologia --no-ff -m "merge: psicologia"
git merge feature/inmobiliaria --no-ff -m "merge: inmobiliaria"
git merge feature/peluqueria --no-ff -m "merge: peluqueria"
git merge feature/barberia --no-ff -m "merge: barberia"
git merge feature/asesoria --no-ff -m "merge: asesoria"
git merge feature/ecommerce --no-ff -m "merge: ecommerce"
git merge feature/academia --no-ff -m "merge: academia"
git merge feature/qa --no-ff -m "merge: qa"
```

### Si hay conflictos en reservas/page.tsx o clientes/page.tsx:
Estos archivos tendrán múltiples `if (tenant?.type === 'X') return <XView />`.
La versión correcta es la que tiene TODOS los tipos. Toma la versión más completa.

## PASO 3 — VERIFICACIÓN FINAL
```
npx tsc --noEmit
npm run build
```

Si TypeScript falla:
- Lee el error
- Corrígelo
- Vuelve al paso 3

Si el build falla:
- Lee el error
- Corrígelo
- Vuelve al paso 3

NO hagas push hasta que ambos pasen.

## PASO 4 — PUSH A VERCEL
```
git push origin main
```

Vercel desplegará automáticamente desde main.

## PASO 5 — VERIFICAR DEPLOY
Espera 2-3 minutos y comprueba:
- `https://restaurante-ai.vercel.app` carga sin error
- El panel `/panel` funciona
- El login `/login` funciona

## PASO 6 — REPORTE FINAL
Crea `agents/status/DEPLOY.done` con:
- Timestamp del deploy
- Lista de ramas mergeadas
- Resultado del build
- URL de producción
- Cualquier issue detectado post-deploy

## EN CASO DE FALLO DEL DEPLOY
Si Vercel falla:
1. Lee los logs de Vercel
2. Corrige el error
3. `git push origin main` de nuevo
4. Si no puedes corregirlo, documenta en DEPLOY.done y para
