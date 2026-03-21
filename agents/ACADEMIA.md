# AGENTE: ACADEMIA / CENTRO EDUCATIVO
# Rama: feature/academia
# Tarea: Añadir soporte para academias, centros de formación, autoescuelas, clases particulares
# IMPORTANTE: Este tipo NO existe en templates.ts — hay que crearlo desde cero

## PASO 1 — LEER PRIMERO
1. `CLAUDE.md` — reglas globales
2. `src/lib/templates.ts` — leer COMPLETO, vas a añadir un tipo nuevo
3. `src/lib/event-schemas.ts` — leer COMPLETO, vas a añadir config nueva
4. `src/types/index.ts` — añadir 'academia' a BusinessType
5. `src/app/(dashboard)/reservas/page.tsx` — patrón visual

## PASO 2 — ANÁLISIS DEL NEGOCIO
Una academia/centro educativo tiene:
- **Clases** (en vez de citas/reservas): alumno, profesor, materia, fecha/hora, duración
- **Alumnos** (en vez de clientes/pacientes)
- **Materias/cursos** como catálogo
- Tipos: academia inglés, clases particulares, autoescuela, música, informática, etc.
- El agente de voz gestiona: inscripciones, horarios, dudas sobre cursos

## PASO 3 — AÑADIR A LA ARQUITECTURA

### 3a. Edita `src/types/index.ts`
```typescript
export type BusinessType =
  | ... (existentes)
  | 'academia' | 'otro'
```

### 3b. Edita `src/lib/templates.ts`
En BusinessType del templates.ts (hay una copia aquí también), añadir `'academia'`.
En TYPE_MAP añadir:
```typescript
academia: {
  template: 'servicios',
  hasSpaces: true,
  clienteLabel: 'Alumno',
  clientesLabel: 'Alumnos',
  reservaLabel: 'Clase',
  reservasLabel: 'Clases',
  unitLabels: {
    singular: 'Aula', plural: 'Aulas', icon: '📚',
    zoneLabel: 'Planta', zonesLabel: 'Plantas'
  },
  agentContext: 'Eres la recepcionista virtual de esta academia. Gestiona inscripciones y consultas sobre clases. Pregunta: nombre del alumno, curso o materia de interés, nivel (principiante/intermedio/avanzado), horario preferido. Si llama un padre/tutor, anota también el nombre del menor.',
},
```

### 3c. Añade ACADEMIA_CONFIG en `src/lib/event-schemas.ts`
Antes del CONFIG_MAP:
```typescript
const ACADEMIA_CONFIG: BusinessEventConfig = {
  businessType: 'academia',
  activeCallLabel: 'Alumno/tutor en línea',
  intentMap: {
    reserva:       'enrollment',
    clase:         'enrollment',
    inscripcion:   'enrollment',
    consulta:      'inquiry',
    cancelacion:   'cancellation',
    otro:          'inquiry',
  },
  schemas: [
    {
      type: 'enrollment', label: 'Inscripción/Clase', labelPlural: 'Clases',
      icon: '📚', color: COL.blue, priority: 'high',
      fields: [
        { key:'student_name', label:'Alumno',    icon:'👤', important:true },
        { key:'subject',      label:'Materia',   icon:'📖', important:true },
        { key:'level',        label:'Nivel',     icon:'📊', format:'badge' },
        { key:'schedule',     label:'Horario',   icon:'🕐' },
        { key:'teacher',      label:'Profesor',  icon:'👨‍🏫' },
        { key:'parent_name',  label:'Tutor',     icon:'👪' },
      ],
      actions: [
        { id:'confirm', label:'Confirmar inscripción', icon:'✓', color:COL.green, style:'primary', href:'/reservas' },
        { id:'review',  label:'Revisar',               icon:'👁', color:COL.amber, style:'secondary', href:'/reservas' },
      ],
      callStates: {
        escuchando:       { label:'Escuchando…',                 color:COL.teal },
        tomando_datos:    { label:'Recogiendo datos de alumno',   color:COL.blue },
        confirmando:      { label:'Confirmando inscripción…',     color:COL.green },
        finalizando:      { label:'Cerrando llamada…',            color:'#8895A7' },
      },
    },
    {
      type: 'inquiry', label: 'Consulta', labelPlural: 'Consultas',
      icon: '❓', color: COL.violet, priority: 'normal',
      fields: [
        { key:'topic',    label:'Tema',     icon:'💬', important:true },
        { key:'interest', label:'Interés',  icon:'📚' },
      ],
      actions: [{ id:'view', label:'Ver llamada', icon:'📞', color:COL.blue, style:'secondary', href:'/llamadas' }],
      callStates: { escuchando:{label:'Escuchando…',color:COL.teal}, respondiendo:{label:'Informando…',color:COL.violet} },
    },
    {
      type: 'cancellation', label: 'Cancelación', labelPlural: 'Cancelaciones',
      icon: '❌', color: COL.yellow, priority: 'normal',
      fields: [
        { key:'student_name', label:'Alumno', icon:'👤', important:true },
        { key:'subject',      label:'Clase',  icon:'📖' },
      ],
      actions: [{ id:'process', label:'Procesar', icon:'✓', color:COL.yellow, style:'primary' }],
      callStates: { escuchando:{label:'Escuchando…',color:COL.teal} },
    },
  ],
  demoEvents: [
    { schemaType:'enrollment', priority:'high',   title:'Inscripción — García, inglés B2', sub:'Nivel intermedio · martes/jueves 19:00' },
    { schemaType:'inquiry',    priority:'normal',  title:'Consulta sobre cursos de verano', sub:'Preguntó por horarios y precios' },
    { schemaType:'enrollment', priority:'high',   title:'Nueva alumna — Martínez, matemáticas', sub:'Selectividad · horario flexible' },
    { schemaType:'cancellation',priority:'normal', title:'Cancelación — López', sub:'Clase de guitarra del miércoles' },
    { schemaType:'enrollment', priority:'high',   title:'Inscripción — niño 8 años, robótica', sub:'Tutor: Sr. Sánchez · sábados 10:00' },
    { schemaType:'inquiry',    priority:'normal',  title:'Consulta sobre autoescuela respondida', sub:'Precios y disponibilidad de prácticas' },
  ],
}
```

Y en CONFIG_MAP añadir: `academia: ACADEMIA_CONFIG,`

## PASO 4 — IMPLEMENTAR VISTAS

### 4a. Vista de clases academia
Crea `src/app/(dashboard)/reservas/AcademiaClasesView.tsx`:
- Lista de clases/inscripciones con: alumno, materia, nivel, profesor, horario
- Badge de nivel: Principiante / Intermedio / Avanzado
- Badge de materia con icono
- Color accent: azul (`#60A5FA`)
- Botón "Nueva inscripción"
- Realtime subscription con cleanup

### 4b. Vista de alumnos
Crea `src/app/(dashboard)/clientes/AcademiaAlumnosView.tsx`:
- Lista de alumnos con: nombre, cursos activos, tutor si es menor
- Número de clases realizadas
- Al click: historial de inscripciones y asistencia

### 4c. Integrar
Edita `src/app/(dashboard)/reservas/page.tsx`:
```typescript
import AcademiaClasesView from './AcademiaClasesView'
if (tenant?.type === 'academia') return <AcademiaClasesView />
```

Edita `src/app/(dashboard)/clientes/page.tsx`:
```typescript
import AcademiaAlumnosView from './AcademiaAlumnosView'
if (tenant?.type === 'academia') return <AcademiaAlumnosView />
```

## PASO 5 — VERIFICAR
```
npx tsc --noEmit
```
Revisar especialmente que BusinessType y CONFIG_MAP están bien tipados.

## PASO 6 — COMMIT
```
git add -A
git commit -m "feat: academia — tipo nuevo, clases e inscripciones"
```

## PASO 7 — MARCAR COMPLETADO
Crea `agents/status/ACADEMIA.done` con lista de todos los archivos modificados
(templates.ts, event-schemas.ts, types/index.ts + los nuevos componentes)
