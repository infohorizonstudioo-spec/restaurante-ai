# AGENTE: ASESORÍA Y SEGUROS
# Rama: feature/asesoria
# Tarea: Soporte completo para asesorías (laboral, fiscal, jurídica) y corredurías de seguros

## PASO 1 — LEER PRIMERO
1. `CLAUDE.md` — reglas globales
2. `src/lib/templates.ts` — ver `asesoria` y `seguros` en TYPE_MAP
   asesoria: hasSpaces=true, unitLabels: Despacho 💼
   seguros: template servicios sin spaces, agentContext de seguros
3. `src/lib/event-schemas.ts` — ver ASESORIA_CONFIG y entrada `seguros`
   Schemas: appointment (cita) + inquiry (consulta) + cancellation
4. `src/app/(dashboard)/reservas/page.tsx` — patrón visual
5. `src/app/(dashboard)/clientes/page.tsx` — patrón clientes

## PASO 2 — DIFERENCIAS ASESORÍA vs SEGUROS
Asesoría: citas con especialidad (laboral/fiscal/jurídica), despachos como espacios, cliente empresarial.
Seguros: llamadas + citas, tipo de seguro (auto/hogar/salud/vida), gestión de siniestros.

## PASO 3 — IMPLEMENTAR

### 3a. Vista de citas asesoría
Crea `src/app/(dashboard)/reservas/AsesorReservasView.tsx`:
- Lista de citas con: cliente/empresa, especialidad, abogado/asesor, fecha/hora, modalidad (presencial/online)
- Badge de especialidad: Laboral / Fiscal / Jurídica / Contable / Otro
- Badge modalidad: Presencial / Online / Teléfono
- Filtro por especialidad
- Color accent: azul (`#60A5FA`)
- Botón "Nueva cita"
- Realtime subscription con cleanup

### 3b. Vista de clientes asesoría
Crea `src/app/(dashboard)/clientes/AsesorClientesView.tsx`:
- Lista de clientes/empresas con: nombre, tipo (particular/empresa), especialidad principal
- Al click: historial de citas y llamadas
- Campo empresa si tiene nombre de empresa en `notes`
- Fuente: tabla `customers`

### 3c. Vista de citas seguros
Crea `src/app/(dashboard)/reservas/SegurosReservasView.tsx`:
- Lista de citas/llamadas con: cliente, tipo de seguro, motivo (nueva póliza/siniestro/renovación)
- Badge de tipo: Auto / Hogar / Salud / Vida / Empresa
- Badge de motivo: Nueva póliza / Siniestro (rojo) / Renovación / Consulta
- Color accent: azul oscuro/navy

### 3d. Integrar
Edita `src/app/(dashboard)/reservas/page.tsx`:
```typescript
import AsesorReservasView from './AsesorReservasView'
import SegurosReservasView from './SegurosReservasView'
if (tenant?.type === 'asesoria') return <AsesorReservasView />
if (tenant?.type === 'seguros') return <SegurosReservasView />
```

Edita `src/app/(dashboard)/clientes/page.tsx`:
```typescript
import AsesorClientesView from './AsesorClientesView'
if (tenant?.type === 'asesoria' || tenant?.type === 'seguros')
  return <AsesorClientesView />
```

## PASO 4 — VERIFICAR
```
npx tsc --noEmit
```

## PASO 5 — COMMIT
```
git add -A
git commit -m "feat: asesoria y seguros — citas y clientes"
```

## PASO 6 — MARCAR COMPLETADO
Crea `agents/status/ASESORIA.done`
