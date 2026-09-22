import type { NextConfig } from 'next'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

const nextConfig: NextConfig = {
  // pdfjs-dist loads its worker script via a relative dynamic import at
  // runtime. Bundling the package moves it away from that file, breaking
  // the import; excluding it keeps it as a plain, unbundled Node module so
  // its own relative paths keep working.
  serverExternalPackages: ['pdfjs-dist'],
}

export default nextConfig

// Lets `next dev` see Cloudflare bindings through the OpenNext adapter. A
// no-op for a plain `next dev`; matters only for the Cloudflare preview.
// See README.md for deployment.
initOpenNextCloudflareForDev()
