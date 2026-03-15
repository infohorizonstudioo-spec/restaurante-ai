import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Reservo.AI — Recepcionista con IA',
  description: 'Gestión inteligente de reservas, llamadas y pedidos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
