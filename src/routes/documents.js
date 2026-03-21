import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const VALID_TYPES = ['specification', 'meeting_notes', 'wiki', 'other']

// ─── GET /api/documents?projectId=X ──────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { projectId } = req.query
    if (!projectId) {
      return res.status(400).json({ error: 'projectId query param is required.' })
    }

    const documents = await prisma.projectDocument.findMany({
      where: { projectId },
      include: {
        creator:    { select: { id: true, name: true } },
        lastEditor: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return res.json({ documents })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/documents/:id ───────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const doc = await prisma.projectDocument.findUnique({
      where: { id: req.params.id },
      include: {
        creator:    { select: { id: true, name: true } },
        lastEditor: { select: { id: true, name: true } },
      },
    })

    if (!doc) return res.status(404).json({ error: 'Document not found.' })

    return res.json({ document: doc })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/documents ──────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { projectId, title, type } = req.body

    if (!projectId || !title?.trim()) {
      return res.status(400).json({ error: 'projectId and title are required.' })
    }

    if (type && !VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}.` })
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return res.status(404).json({ error: 'Project not found.' })

    const doc = await prisma.projectDocument.create({
      data: {
        projectId,
        title: title.trim(),
        type: type ?? 'wiki',
        createdBy: req.user.id,
        updatedBy: req.user.id,
      },
      include: {
        creator:    { select: { id: true, name: true } },
        lastEditor: { select: { id: true, name: true } },
      },
    })

    return res.status(201).json({ document: doc })
  } catch (err) {
    next(err)
  }
})

// ─── PUT /api/documents/:id ───────────────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { title, type, content } = req.body

    const existing = await prisma.projectDocument.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Document not found.' })

    if (type && !VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}.` })
    }

    const updates = { updatedBy: req.user.id }
    if (title !== undefined) updates.title = title.trim()
    if (type  !== undefined) updates.type  = type
    if (content !== undefined) updates.content = content

    const doc = await prisma.projectDocument.update({
      where: { id: req.params.id },
      data: updates,
      include: {
        creator:    { select: { id: true, name: true } },
        lastEditor: { select: { id: true, name: true } },
      },
    })

    return res.json({ document: doc })
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/documents/:id ────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.projectDocument.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Document not found.' })

    await prisma.projectDocument.delete({ where: { id: req.params.id } })

    return res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
