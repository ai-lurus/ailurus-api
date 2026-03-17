import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'

// Resolve absolute path to .env regardless of the working directory
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../../.env')

config({ path: envPath, override: true })

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET']
const missing = REQUIRED.filter((k) => !process.env[k])

if (missing.length) {
  console.error(`[startup] Missing required environment variables: ${missing.join(', ')}`)
  console.error(`[startup] Expected .env at: ${envPath}`)
  process.exit(1)
}

if (process.env.JWT_SECRET === 'change_me_in_production') {
  console.warn('[startup] Warning: JWT_SECRET is using the default placeholder. Set a real secret in .env')
}
