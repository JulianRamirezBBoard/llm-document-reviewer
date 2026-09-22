import type { Metadata } from 'next'
import { IBM_Plex_Mono, Source_Serif_4, Special_Elite } from 'next/font/google'
import './globals.css'

const specialElite = Special_Elite({
  variable: '--font-special-elite',
  weight: '400',
  subsets: ['latin'],
})

const sourceSerif = Source_Serif_4({
  variable: '--font-source-serif',
  subsets: ['latin'],
})

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  weight: ['400', '500'],
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Structured Data Extractor',
  description:
    'Paste or upload a document and review AI-extracted structured fields.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${specialElite.variable} ${sourceSerif.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="paper-ruled bg-paper font-body text-ink flex min-h-full flex-col">
        {children}
      </body>
    </html>
  )
}
