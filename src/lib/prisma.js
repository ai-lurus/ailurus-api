import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis

function createPrismaClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export async function withRetry(fn) {
  try {
    return await fn()
  } catch (err) {
    const isConnectionError = err.code === 'P1001' || err.code === 'P1002' || err.message?.includes("Can't reach database")
    if (!isConnectionError) throw err
    await new Promise((resolve) => setTimeout(resolve, 2000))
    return await fn()
  }
}

export default prisma
