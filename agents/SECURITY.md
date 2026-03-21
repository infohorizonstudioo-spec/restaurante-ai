# AGENTE: SEGURIDAD Y MIDDLEWARE
# Rama: feature/security
# Tarea: Auditoría de seguridad, middleware, errores y vulnerabilidades

## PASO 1 — LEER PRIMERO
1. `CLAUDE.md` — reglas globales
2. `middleware.ts` — ver middleware actual
3. `src/lib/supabase.ts` — cliente Supabase
4. `src/app/api/` — todas las rutas API
5. `next.config.js` — configuración Next.js
6. `package.json` — dependencias y versiones

## PASO 2 — AUDITAR (no modificar todavía, solo analizar)

### Checklist de seguridad:
- [ ] ¿Todas las rutas `/api/` verifican autenticación?
- [ ] ¿Hay rutas que usen service_role_key en el cliente browser?
- [ ] ¿Hay datos sensibles en logs/console.log?
- [ ] ¿El middleware protege todas las rutas del dashboard?
- [ ] ¿Hay RLS activado en todas las tablas Supabase?
- [ ] ¿Hay inputs sin sanitizar?
- [ ] ¿Las variables de entorno están correctamente separadas (NEXT_PUBLIC_ vs server)?
- [ ] ¿Hay rate limiting en las rutas API?
- [ ] ¿Los webhooks de voz verifican origen?

## PASO 3 — IMPLEMENTAR FIXES

### 3a. Middleware robusto
Edita `middleware.ts` para asegurar:
- Protección de todas las rutas `/dashboard/*`, `/panel`, `/reservas`, etc.
- Redirección a `/login` si no hay sesión
- Permitir `/login`, `/registro`, `/reset`, `/precios`, `/api/voice/webhook` sin auth
- Headers de seguridad: X-Frame-Options, X-Content-Type-Options, etc.

### 3b. Protección de rutas API
Para cada archivo en `src/app/api/`:
- Verificar que usan `createAdminClient()` (server-side) no el cliente browser
- Añadir verificación básica de origen en webhooks

### 3c. Variables de entorno
Verifica que NUNCA se expone al cliente:
- `SUPABASE_SERVICE_ROLE_KEY`
- `ELEVENLABS_API_KEY`
- `DEEPGRAM_API_KEY`
- `TWILIO_AUTH_TOKEN`
- `ANTHROPIC_API_KEY`

Si alguna está mal prefijada como `NEXT_PUBLIC_`, documentarlo en el .done.

### 3d. Error boundaries
Crea `src/components/ErrorBoundary.tsx` si no existe:
- Componente React error boundary básico
- Muestra mensaje amigable en lugar de crash
- Log del error (sin datos sensibles)

### 3e. Headers de seguridad en next.config.js
Añade si no existen:
```javascript
headers: async () => [{
  source: '/(.*)',
  headers: [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ]
}]
```

## PASO 4 — VERIFICAR
```
npx tsc --noEmit
```

## PASO 5 — COMMIT
```
git add -A
git commit -m "security: middleware, headers y proteccion de rutas"
```

## PASO 6 — REPORTE
Crea `agents/status/SECURITY.done` con:
- Lista completa de vulnerabilidades encontradas
- Fixes aplicados
- Vulnerabilidades pendientes (que requieren acción externa, ej: configurar RLS en Supabase)
- Recomendaciones adicionales
