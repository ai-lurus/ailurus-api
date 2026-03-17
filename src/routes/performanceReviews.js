import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// ─── GET /api/performance-reviews?subjectId=X ────────────────────────────────
router.get('/', requireAuth, requireRole('admin', 'ceo'), async (req, res, next) => {
  try {
    const { subjectId } = req.query
    if (!subjectId) {
      return res.status(400).json({ error: 'subjectId query param is required.' })
    }

    const reviews = await prisma.performanceReview.findMany({
      where: { subjectId },
      orderBy: { periodEnd: 'desc' },
      include: {
        author: { select: { id: true, name: true } },
      },
    })

    return res.json({ reviews })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/performance-reviews ───────────────────────────────────────────
router.post('/', requireAuth, requireRole('admin', 'ceo'), async (req, res, next) => {
  try {
    const {
      subjectId,
      periodLabel,
      periodStart,
      periodEnd,
      ratingTechnical,
      ratingComms,
      ratingAutonomy,
      ratingTeamwork,
      overallRating,
      summary,
    } = req.body

    if (!subjectId || !periodLabel || !periodStart || !periodEnd) {
      return res.status(400).json({ error: 'subjectId, periodLabel, periodStart, and periodEnd are required.' })
    }

    const parsedStart = new Date(periodStart)
    const parsedEnd   = new Date(periodEnd)
    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return res.status(400).json({ error: 'periodStart and periodEnd must be valid dates (YYYY-MM-DD).' })
    }

    const subject = await prisma.user.findUnique({ where: { id: subjectId } })
    if (!subject) {
      return res.status(404).json({ error: 'Subject user not found.' })
    }

    function toRating(val) {
      if (val === undefined || val === null) return null
      const n = parseInt(val)
      if (isNaN(n) || n < 1 || n > 5) return null
      return n
    }

    const review = await prisma.performanceReview.create({
      data: {
        subjectId,
        authorId: req.user.id,
        periodLabel,
        periodStart: new Date(parsedStart.toISOString().slice(0, 10) + 'T00:00:00.000Z'),
        periodEnd:   new Date(parsedEnd.toISOString().slice(0, 10) + 'T00:00:00.000Z'),
        ratingTechnical: toRating(ratingTechnical),
        ratingComms:     toRating(ratingComms),
        ratingAutonomy:  toRating(ratingAutonomy),
        ratingTeamwork:  toRating(ratingTeamwork),
        overallRating:   toRating(overallRating),
        summary: summary || null,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    })

    return res.status(201).json({ review })
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/performance-reviews/:id ────────────────────────────────────────
router.put('/:id', requireAuth, requireRole('admin', 'ceo'), async (req, res, next) => {
  try {
    const {
      periodLabel,
      periodStart,
      periodEnd,
      ratingTechnical,
      ratingComms,
      ratingAutonomy,
      ratingTeamwork,
      overallRating,
      summary,
    } = req.body

    const existing = await prisma.performanceReview.findUnique({ where: { id: req.params.id } })
    if (!existing) {
      return res.status(404).json({ error: 'Review not found.' })
    }

    function toRating(val) {
      if (val === undefined || val === null) return undefined
      const n = parseInt(val)
      if (isNaN(n) || n < 1 || n > 5) return null
      return n
    }

    const data = {}
    if (periodLabel !== undefined)     data.periodLabel = periodLabel
    if (summary !== undefined)         data.summary = summary || null
    if (ratingTechnical !== undefined) data.ratingTechnical = toRating(ratingTechnical)
    if (ratingComms !== undefined)     data.ratingComms     = toRating(ratingComms)
    if (ratingAutonomy !== undefined)  data.ratingAutonomy  = toRating(ratingAutonomy)
    if (ratingTeamwork !== undefined)  data.ratingTeamwork  = toRating(ratingTeamwork)
    if (overallRating !== undefined)   data.overallRating   = toRating(overallRating)

    if (periodStart !== undefined) {
      const parsed = new Date(periodStart)
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'periodStart must be a valid date (YYYY-MM-DD).' })
      }
      data.periodStart = new Date(parsed.toISOString().slice(0, 10) + 'T00:00:00.000Z')
    }

    if (periodEnd !== undefined) {
      const parsed = new Date(periodEnd)
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'periodEnd must be a valid date (YYYY-MM-DD).' })
      }
      data.periodEnd = new Date(parsed.toISOString().slice(0, 10) + 'T00:00:00.000Z')
    }

    const review = await prisma.performanceReview.update({
      where: { id: req.params.id },
      data,
      include: {
        author: { select: { id: true, name: true } },
      },
    })

    return res.json({ review })
  } catch (err) {
    next(err)
  }
})

export default router
