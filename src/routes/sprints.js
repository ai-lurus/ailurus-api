import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

const VALID_STATUSES = ['planned', 'active', 'completed']

// ─── GET /api/sprints ─────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const { projectId, status } = req.query

  if (!projectId) {
    return res.status(400).json({ error: 'projectId query param is required.' })
  }

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.`,
    })
  }

  const where = { projectId }
  if (status) where.status = status

  const sprints = await prisma.sprint.findMany({
    where,
    orderBy: { startDate: 'asc' },
    include: {
      milestones: { orderBy: { dueDate: 'asc' } },
      _count: { select: { tasks: true } },
    },
  })

  return res.json({ sprints })
})

// ─── POST /api/sprints ────────────────────────────────────────────────────────
router.post('/', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const { projectId, name, startDate, endDate, objective } = req.body

  if (!projectId || !name || !startDate || !endDate) {
    return res.status(400).json({ error: 'projectId, name, startDate, and endDate are required.' })
  }

  const start = new Date(startDate)
  const end = new Date(endDate)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ error: 'startDate and endDate must be valid dates.' })
  }

  if (end <= start) {
    return res.status(400).json({ error: 'endDate must be after startDate.' })
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' })
  }

  const sprint = await prisma.sprint.create({
    data: {
      projectId,
      name,
      objective: objective || null,
      startDate: start,
      endDate: end,
    },
    include: {
      milestones: true,
      _count: { select: { tasks: true } },
    },
  })

  return res.status(201).json({ sprint })
})

// ─── GET /api/sprints/:id ─────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  const sprint = await prisma.sprint.findUnique({
    where: { id: req.params.id },
    include: {
      milestones: { orderBy: { dueDate: 'asc' } },
      tasks: {
        include: {
          assignee: { select: { id: true, name: true } },
          goal: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!sprint) {
    return res.status(404).json({ error: 'Sprint not found.' })
  }

  return res.json({ sprint })
})

// ─── PUT /api/sprints/:id ─────────────────────────────────────────────────────
router.put('/:id', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const { name, startDate, endDate, status, objective } = req.body

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.`,
    })
  }

  const existing = await prisma.sprint.findUnique({ where: { id: req.params.id } })
  if (!existing) {
    return res.status(404).json({ error: 'Sprint not found.' })
  }

  const start = startDate ? new Date(startDate) : null
  const end = endDate ? new Date(endDate) : null

  if (start && isNaN(start.getTime())) {
    return res.status(400).json({ error: 'startDate must be a valid date.' })
  }
  if (end && isNaN(end.getTime())) {
    return res.status(400).json({ error: 'endDate must be a valid date.' })
  }

  const resolvedStart = start ?? existing.startDate
  const resolvedEnd = end ?? existing.endDate
  if (resolvedEnd <= resolvedStart) {
    return res.status(400).json({ error: 'endDate must be after startDate.' })
  }

  const sprint = await prisma.sprint.update({
    where: { id: req.params.id },
    data: {
      ...(name && { name }),
      ...(start && { startDate: start }),
      ...(end && { endDate: end }),
      ...(status && { status }),
      ...('objective' in req.body && { objective: objective || null }),
    },
    include: {
      milestones: { orderBy: { dueDate: 'asc' } },
      _count: { select: { tasks: true } },
    },
  })

  return res.json({ sprint })
})

// ─── DELETE /api/sprints/:id ──────────────────────────────────────────────────
router.delete('/:id', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const existing = await prisma.sprint.findUnique({ where: { id: req.params.id } })
  if (!existing) {
    return res.status(404).json({ error: 'Sprint not found.' })
  }

  // Unlink tasks from this sprint before deleting
  await prisma.task.updateMany({
    where: { sprintId: req.params.id },
    data: { sprintId: null },
  })

  await prisma.sprint.delete({ where: { id: req.params.id } })
  return res.json({ ok: true })
})

export default router
