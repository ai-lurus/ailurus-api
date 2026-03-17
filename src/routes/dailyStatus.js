import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

const VALID_MOODS = ['great', 'good', 'okay', 'struggling']

// ─── POST /api/daily-status ───────────────────────────────────────────────────
// Developers/designers submit their own daily check-in (upsert by userId + date).
router.post('/', requireAuth, requireRole('developer', 'designer'), async (req, res) => {
  const { date, mood, availableHrs, appointments, blockers, notes } = req.body

  if (!date || !mood) {
    return res.status(400).json({ error: 'date and mood are required.' })
  }

  if (!VALID_MOODS.includes(mood)) {
    return res.status(400).json({
      error: `Invalid mood. Must be one of: ${VALID_MOODS.join(', ')}.`,
    })
  }

  const parsedDate = new Date(date)
  if (isNaN(parsedDate.getTime())) {
    return res.status(400).json({ error: 'date must be a valid date (YYYY-MM-DD).' })
  }

  // Normalize to UTC midnight so the @@unique([userId, date]) constraint works
  const normalizedDate = new Date(parsedDate.toISOString().slice(0, 10) + 'T00:00:00.000Z')

  const status = await prisma.dailyStatus.upsert({
    where: {
      userId_date: {
        userId: req.user.id,
        date: normalizedDate,
      },
    },
    update: {
      mood,
      ...(availableHrs !== undefined && { availableHrs: availableHrs ? parseFloat(availableHrs) : null }),
      ...(appointments !== undefined && { appointments }),
      ...(blockers !== undefined && { blockers }),
      ...(notes !== undefined && { notes }),
    },
    create: {
      userId: req.user.id,
      date: normalizedDate,
      mood,
      availableHrs: availableHrs ? parseFloat(availableHrs) : null,
      appointments: appointments || null,
      blockers: blockers || null,
      notes: notes || null,
    },
  })

  return res.status(201).json({ status })
})

// ─── GET /api/daily-status ────────────────────────────────────────────────────
// Developers/designers see only their own entries. Admins/CEOs can filter by userId.
router.get('/', requireAuth, async (req, res) => {
  const { userId, date, from, to } = req.query
  const isDeveloper = ['developer', 'designer'].includes(req.user.role)

  // Developers/designers can only view their own statuses
  const targetUserId = isDeveloper ? req.user.id : (userId || undefined)

  const where = {}
  if (targetUserId) where.userId = targetUserId

  if (date) {
    const parsed = new Date(date)
    if (isNaN(parsed.getTime())) {
      return res.status(400).json({ error: 'date must be a valid date (YYYY-MM-DD).' })
    }
    where.date = new Date(parsed.toISOString().slice(0, 10) + 'T00:00:00.000Z')
  } else if (from || to) {
    where.date = {}
    if (from) {
      const parsedFrom = new Date(from)
      if (isNaN(parsedFrom.getTime())) {
        return res.status(400).json({ error: 'from must be a valid date (YYYY-MM-DD).' })
      }
      where.date.gte = new Date(parsedFrom.toISOString().slice(0, 10) + 'T00:00:00.000Z')
    }
    if (to) {
      const parsedTo = new Date(to)
      if (isNaN(parsedTo.getTime())) {
        return res.status(400).json({ error: 'to must be a valid date (YYYY-MM-DD).' })
      }
      where.date.lte = new Date(parsedTo.toISOString().slice(0, 10) + 'T00:00:00.000Z')
    }
  }

  const statuses = await prisma.dailyStatus.findMany({
    where,
    orderBy: { date: 'desc' },
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
  })

  return res.json({ statuses })
})

// ─── PATCH /api/daily-status/eod ─────────────────────────────────────────────
// Developers submit their end-of-day summary. Morning check-in must exist first.
router.patch('/eod', requireAuth, requireRole('developer', 'designer'), async (req, res) => {
  const { date, eodMood, eodCompleted, eodBlockers, eodNotes } = req.body

  if (!date) {
    return res.status(400).json({ error: 'date is required.' })
  }

  if (eodMood && !VALID_MOODS.includes(eodMood)) {
    return res.status(400).json({
      error: `Invalid eodMood. Must be one of: ${VALID_MOODS.join(', ')}.`,
    })
  }

  const parsed = new Date(date)
  if (isNaN(parsed.getTime())) {
    return res.status(400).json({ error: 'date must be a valid date (YYYY-MM-DD).' })
  }

  const normalizedDate = new Date(parsed.toISOString().slice(0, 10) + 'T00:00:00.000Z')

  const existing = await prisma.dailyStatus.findUnique({
    where: { userId_date: { userId: req.user.id, date: normalizedDate } },
  })

  if (!existing) {
    return res.status(404).json({ error: 'Morning check-in not found for this date. Submit it first.' })
  }

  const status = await prisma.dailyStatus.update({
    where: { userId_date: { userId: req.user.id, date: normalizedDate } },
    data: {
      ...(eodMood && { eodMood }),
      ...(eodCompleted !== undefined && { eodCompleted }),
      ...(eodBlockers !== undefined && { eodBlockers }),
      ...(eodNotes !== undefined && { eodNotes }),
      eodSubmittedAt: new Date(),
    },
  })

  return res.json({ status })
})

export default router
