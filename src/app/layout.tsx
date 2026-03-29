import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from '@/contexts/ThemeContext'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'Reservo.AI — IA para restaurantes, bares y cafeterías',
  description: 'Automatiza reservas, pedidos y llamadas en tu restaurante con inteligencia artificial. Recepcionista virtual 24/7.',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23F0A84E'/><path d='M16 7a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 10c4.42 0 8 1.79 8 4v2H8v-2c0-2.21 3.58-4 8-4z' fill='%230C1018'/></svg>" },
  openGraph: {
    title: 'Reservo.AI — IA para restaurantes, bares y cafeterías',
    description: 'Automatiza reservas, pedidos y llamadas en tu restaurante con inteligencia artificial. Recepcionista virtual 24/7.',
    type: 'website',
  },
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
