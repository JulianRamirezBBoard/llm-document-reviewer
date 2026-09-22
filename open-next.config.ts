import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// Adapter config for deploying this Next.js app to Cloudflare Workers.
// Defaults are fine for Stage 1: no incremental cache, no custom queue.
export default defineCloudflareConfig()
