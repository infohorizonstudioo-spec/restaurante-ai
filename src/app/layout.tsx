import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Reservo.AI — Centro de Control',
  description: 'Recepcionista con IA. Gestión inteligente de llamadas, reservas y pedidos en tiempo real.',
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23F0A84E'/><path d='M16 7a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 10c4.42 0 8 1.79 8 4v2H8v-2c0-2.21 3.58-4 8-4z' fill='%230C1018'/></svg>" }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
