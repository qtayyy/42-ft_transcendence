import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ping Pong Game',
  description: 'A beautiful glassmorphism ping pong game built with Next.js',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}