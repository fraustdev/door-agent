import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '2389 Door',
  description: '2389.ai office access control',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
