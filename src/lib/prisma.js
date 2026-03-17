import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL },
  },
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

/**
 * Executes a Prisma operation with one retry to handle Neon cold starts.
 * On free tier, the DB suspends after inactivity and the first connection fails.
 */
export async function withRetry(fn) {
  try {
    return await fn()
  } catch (err) {
    const isConnectionError = err.code === 'P1001' || err.code === 'P1002' || err.message?.includes("Can't reach database")
    if (!isConnectionError) throw err
    // Wait for Neon to wake up, then retry once
    await new Promise((resolve) => setTimeout(resolve, 2000))
    return await fn()
  }
}

export default prisma
