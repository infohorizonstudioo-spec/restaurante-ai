# AGENTE: ECOMMERCE
# Rama: feature/ecommerce
# Tarea: Añadir soporte ecommerce — tipo NO existe todavía en templates.ts, hay que crearlo

## PASO 1 — LEER PRIMERO
1. `CLAUDE.md` — reglas globales
2. `src/lib/templates.ts` — leer COMPLETO para entender la estructura antes de añadir
3. `src/lib/event-schemas.ts` — leer COMPLETO para añadir config de ecommerce
4. `src/types/index.ts` — ver BusinessType union — hay que añadir 'ecommerce'
5. `src/app/(dashboard)/pedidos/page.tsx` — ver si ya existe para hostelería
6. `src/app/(dashboard)/panel/page.tsx` — ver cómo usa order_events

## PASO 2 — AÑADIR TIPO ECOMMERCE A LA ARQUITECTURA

### 2a. Edita `src/types/index.ts`
Añade `'ecommerce'` a la union `BusinessType`:
```typescript
export type BusinessType =
  | 'restaurante' | 'bar' | 'cafeteria'
  | 'clinica_dental' | 'clinica_medica' | 'asesoria'
  | 'peluqueria' | 'barberia' | 'seguros' | 'inmobiliaria'
  | 'veterinaria' | 'fisioterapia' | 'psicologia'
  | 'ecommerce' | 'otro'  // ← añadir ecommerce
```

### 2b. Edita `src/lib/templates.ts`
Añade en TYPE_MAP:
```typescript
ecommerce: {
  template: 'servicios',
  reservaLabel: 'Pedido',
  reservasLabel: 'Pedidos',
  clienteLabel: 'Cliente',
  clientesLabel: 'Clientes',
  agentContext: 'Eres el asistente de ventas virtual de este comercio online. Gestiona pedidos, consultas sobre productos y estado de envíos. Pregunta: producto, cantidad, dirección de envío y teléfono de contacto.',
},
```

### 2c. Añade ECOMMERCE_CONFIG en `src/lib/event-schemas.ts`
Antes del CONFIG_MAP, añade:
```typescript
const ECOMMERCE_CONFIG: BusinessEventConfig = {
  businessType: 'ecommerce',
  activeCallLabel: 'Cliente en línea',
  intentMap: {
    pedido:      'order',
    consulta:    'inquiry',
    devolucion:  'return',
    cancelacion: 'cancellation',
    otro:        'inquiry',
  },
  schemas: [
    {
      type: 'order', label: 'Pedido', labelPlural: 'Pedidos',
      icon: '🛍️', color: COL.violet, priority: 'high',
      fields: [
        { key:'customer_name', label:'Cliente',   icon:'👤', important:true },
        { key:'product',       label:'Producto',  icon:'📦', important:true },
        { key:'quantity',      label:'Cantidad',  icon:'🔢', format:'number' },
        { key:'address',       label:'Dirección', icon:'📍' },
        { key:'phone',         label:'Teléfono',  icon:'📞', format:'phone' },
      ],
      actions: [
        { id:'confirm', label:'Confirmar pedido', icon:'✓', color:COL.green,  style:'primary', href:'/pedidos' },
        { id:'review',  label:'Revisar',          icon:'👁', color:COL.amber,  style:'secondary', href:'/pedidos' },
      ],
      callStates: {
        escuchando:    { label:'Escuchando…',        color:COL.teal   },
        tomando_pedido:{ label:'Tomando pedido',      color:COL.violet },
        confirmando:   { label:'Confirmando pedido…', color:COL.green  },
        finalizando:   { label:'Cerrando llamada…',   color:'#8895A7'  },
      },
    },
    {
      type: 'inquiry', label: 'Consulta', labelPlural: 'Consultas',
      icon: '❓', color: COL.blue, priority: 'normal',
      fields: [{ key:'question', label:'Consulta', icon:'💬', important:true }],
      actions: [{ id:'view', label:'Ver llamada', icon:'📞', color:COL.blue, style:'secondary', href:'/llamadas' }],
      callStates: { escuchando:{label:'Escuchando…',color:COL.teal}, respondiendo:{label:'Respondiendo…',color:COL.blue} },
    },
    {
      type: 'return', label: 'Devolución', labelPlural: 'Devoluciones',
      icon: '↩️', color: COL.yellow, priority: 'normal',
      fields: [
        { key:'customer_name', label:'Cliente',  icon:'👤', important:true },
        { key:'product',       label:'Producto', icon:'📦', important:true },
        { key:'reason',        label:'Motivo',   icon:'💬' },
      ],
      actions: [{ id:'process', label:'Gestionar', icon:'✓', color:COL.yellow, style:'primary', href:'/pedidos' }],
      callStates: { escuchando:{label:'Escuchando…',color:COL.teal} },
    },
    {
      type: 'cancellation', label: 'Cancelación', labelPlural: 'Cancelaciones',
      icon: '❌', color: COL.red, priority: 'normal',
      fields: [{ key:'customer_name', label:'Cliente', icon:'👤', important:true }],
      actions: [{ id:'process', label:'Procesar', icon:'✓', color:COL.red, style:'primary' }],
      callStates: { escuchando:{label:'Escuchando…',color:COL.teal} },
    },
  ],
  demoEvents: [
    { schemaType:'order',    priority:'high',   title:'Nuevo pedido — García', sub:'2x Camiseta M negra · envío a Madrid' },
    { schemaType:'order',    priority:'high',   title:'Pedido confirmado — López', sub:'1x Zapatillas 42 · recogida en tienda' },
    { schemaType:'inquiry',  priority:'normal',  title:'Consulta sobre stock respondida', sub:'Preguntó por tallas disponibles' },
    { schemaType:'return',   priority:'normal',  title:'Devolución — Martínez', sub:'Talla incorrecta · gestionar cambio' },
    { schemaType:'order',    priority:'high',   title:'Pedido — Sánchez', sub:'3x Funda móvil · envío urgente' },
    { schemaType:'cancellation',priority:'normal',title:'Cancelación — Ruiz', sub:'Pedido de ayer · cambio de opinión' },
  ],
}
```

Y añade en CONFIG_MAP:
```typescript
ecommerce: ECOMMERCE_CONFIG,
```

## PASO 3 — IMPLEMENTAR VISTAS

### 3a. Vista de pedidos ecommerce
Crea `src/app/(dashboard)/pedidos/EcomPedidosView.tsx`:
- Lista de pedidos con: cliente, producto, cantidad, dirección, estado
- Badge estado: nuevo (amber) / confirmado (verde) / enviado (azul) / entregado (teal) / cancelado (rojo)
- Fuente: tabla `reservations` (usando notes para producto/dirección) O `order_events` si existe
- Realtime subscription con cleanup
- Color accent: violeta

### 3b. Integrar
Edita `src/app/(dashboard)/reservas/page.tsx`:
```typescript
import EcomReservasView from './EcomReservasView'
if (tenant?.type === 'ecommerce') return <EcomReservasView />
```

## PASO 4 — VERIFICAR
```
npx tsc --noEmit
```
Asegúrate de que el nuevo tipo `ecommerce` en BusinessType no rompe nada.

## PASO 5 — COMMIT
```
git add -A
git commit -m "feat: ecommerce — tipo nuevo, pedidos y clientes"
```

## PASO 6 — MARCAR COMPLETADO
Crea `agents/status/ECOMMERCE.done` con todos los archivos modificados
