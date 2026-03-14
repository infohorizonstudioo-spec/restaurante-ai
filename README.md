# 🍕 Restaurante AI — Sistema de Pedidos por Voz

IA con voz real que atiende pedidos por teléfono para restaurantes.
Panel en tiempo real para ver y gestionar pedidos.

## Stack
- **Next.js 14** — Frontend + API
- **Twilio** — Llamadas telefónicas + Media Streams
- **Deepgram** — Transcripción de voz en tiempo real
- **ElevenLabs** — Síntesis de voz natural
- **Claude (Anthropic)** — IA que entiende y gestiona el pedido
- **Supabase** — BD + Realtime para el panel

---

## Setup en 5 pasos

### 1. Cuentas necesarias (todas tienen free tier)
- [Twilio](https://twilio.com) — compra un número de teléfono (~1$/mes)
- [Deepgram](https://deepgram.com) — $200 gratis al inicio
- [ElevenLabs](https://elevenlabs.io) — 10.000 chars gratis/mes
- Anthropic API — ya la tienes

### 2. Variables de entorno
Edita `.env.local` con tus claves:
```
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_PHONE_NUMBER=+34xxx

DEEPGRAM_API_KEY=xxxx
ELEVENLABS_API_KEY=xxxx
ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL  # Sarah (español)

ANTHROPIC_API_KEY=sk-ant-xxx
BASE_URL=https://tu-app.vercel.app
```

### 3. Deploy en Vercel
```bash
npm install -g vercel
vercel --prod
```
⚠️ Vercel NO soporta WebSockets nativos.
Necesitas Railway o Render para el servidor custom.

**Opción recomendada — Railway:**
```bash
# Instala Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up
```

### 4. Configurar Twilio
En tu cuenta Twilio:
1. Ve a Phone Numbers → tu número
2. En "Voice Configuration" → Webhook
3. URL: `https://tu-app.railway.app/api/call`
4. Método: HTTP POST

### 5. Arrancar en local (para probar)
```bash
npm run dev
# Panel: http://localhost:3000/panel
# Para exponer el webhook usa ngrok:
npx ngrok http 3000
# Copia la URL https://xxxx.ngrok.io y ponla en Twilio
```

---

## Añadir un restaurante
```sql
INSERT INTO restaurants (name, phone_number, address, greeting, menu)
VALUES (
  'Mi Restaurante',
  '+34600000000',  -- número Twilio asignado
  'Calle X, Ciudad',
  '¡Hola! Bienvenido a Mi Restaurante. ¿Qué desea pedir?',
  '[{"name":"Plato 1","price":10.00,"description":"Descripción"}]'
);
```

---

## Flujo de una llamada
1. Cliente llama al número de Twilio
2. Twilio llama a `/api/call` → responde con TwiML
3. Se abre WebSocket en `/api/stream`
4. Deepgram transcribe el audio en tiempo real
5. Claude procesa y genera respuesta
6. ElevenLabs sintetiza la voz
7. Audio va de vuelta al cliente por Twilio
8. Pedido aparece en el panel `/panel` vía Supabase Realtime

## Panel de pedidos
- URL: `https://tu-app/panel`
- Se actualiza en tiempo real sin recargar
- Sonido cuando llega pedido nuevo
- Botones para avanzar el estado del pedido
