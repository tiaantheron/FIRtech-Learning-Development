import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { WorkbookProvider } from '@/lib/workbook-context'
import { AppShell } from '@/components/app-shell'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'FIRtech Intelligent Automation Hub',
  description:
    'Executive dashboard tracking FIRtech progress toward UiPath Resell Diamond and Services Gold partner status.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  themeColor: '#2a2f52',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className={`${inter.variable} ${mono.variable} font-sans antialiased`}>
        <WorkbookProvider>
          <AppShell>{children}</AppShell>
        </WorkbookProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
