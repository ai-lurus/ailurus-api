import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// ─── GET /api/goals?projectId= ────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { projectId } = req.query
    if (!projectId) {
      return res.status(400).json({ error: 'projectId query param is required.' })
    }

    const goals = await prisma.goal.findMany({
      where: { projectId },
      orderBy: { deadline: 'asc' },
      select: { id: true, title: true, status: true, deadline: true },
    })

    res.json({ goals })
  } catch (err) {
    next(err)
  }
})

export default router
