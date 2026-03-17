import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// ─── GET /api/one-on-ones?subjectId=X ────────────────────────────────────────
router.get('/', requireAuth, requireRole('admin', 'ceo'), async (req, res, next) => {
  try {
    const { subjectId } = req.query
    if (!subjectId) {
      return res.status(400).json({ error: 'subjectId query param is required.' })
    }

    const notes = await prisma.oneOnOneNote.findMany({
      where: { subjectId },
      orderBy: { sessionDate: 'desc' },
      include: {
        author: { select: { id: true, name: true } },
      },
    })

    return res.json({ notes })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/one-on-ones ────────────────────────────────────────────────────
router.post('/', requireAuth, requireRole('admin', 'ceo'), async (req, res, next) => {
  try {
    const { subjectId, sessionDate, notes, strengths, improvements, agreements } = req.body

    if (!subjectId || !sessionDate || !notes) {
      return res.status(400).json({ error: 'subjectId, sessionDate, and notes are required.' })
    }

    const parsed = new Date(sessionDate)
    if (isNaN(parsed.getTime())) {
      return res.status(400).json({ error: 'sessionDate must be a valid date (YYYY-MM-DD).' })
    }

    const subject = await prisma.user.findUnique({ where: { id: subjectId } })
    if (!subject) {
      return res.status(404).json({ error: 'Subject user not found.' })
    }

    const note = await prisma.oneOnOneNote.create({
      data: {
        subjectId,
        authorId: req.user.id,
        sessionDate: new Date(parsed.toISOString().slice(0, 10) + 'T00:00:00.000Z'),
        notes,
        strengths: strengths || null,
        improvements: improvements || null,
        agreements: agreements || null,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    })

    return res.status(201).json({ note })
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/one-on-ones/:id ─────────────────────────────────────────────────
router.put('/:id', requireAuth, requireRole('admin', 'ceo'), async (req, res, next) => {
  try {
    const { sessionDate, notes, strengths, improvements, agreements } = req.body

    const existing = await prisma.oneOnOneNote.findUnique({ where: { id: req.params.id } })
    if (!existing) {
      return res.status(404).json({ error: 'Note not found.' })
    }

    const data = {}
    if (notes !== undefined) data.notes = notes
    if (strengths !== undefined) data.strengths = strengths || null
    if (improvements !== undefined) data.improvements = improvements || null
    if (agreements !== undefined) data.agreements = agreements || null
    if (sessionDate !== undefined) {
      const parsed = new Date(sessionDate)
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'sessionDate must be a valid date (YYYY-MM-DD).' })
      }
      data.sessionDate = new Date(parsed.toISOString().slice(0, 10) + 'T00:00:00.000Z')
    }

    const note = await prisma.oneOnOneNote.update({
      where: { id: req.params.id },
      data,
      include: {
        author: { select: { id: true, name: true } },
      },
    })

    return res.json({ note })
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/one-on-ones/:id ──────────────────────────────────────────────
router.delete('/:id', requireAuth, requireRole('admin', 'ceo'), async (req, res, next) => {
  try {
    const existing = await prisma.oneOnOneNote.findUnique({ where: { id: req.params.id } })
    if (!existing) {
      return res.status(404).json({ error: 'Note not found.' })
    }

    await prisma.oneOnOneNote.delete({ where: { id: req.params.id } })

    return res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
