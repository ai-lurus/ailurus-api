import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns the percentage of project timeline elapsed (0–100). */
function budgetBurnPercent(createdAt, deadline) {
  if (!deadline) return null
  const start = new Date(createdAt).getTime()
  const end = new Date(deadline).getTime()
  const now = Date.now()
  const total = end - start
  if (total <= 0) return 100
  return Math.min(100, Math.round(((now - start) / total) * 100))
}

// ─── GET /api/projects ───────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const { type, status } = req.query

  const where = {}
  if (type) where.type = type
  if (status) where.status = status

  // Developers, designers and clients only see projects they belong to
  if (['developer', 'designer', 'client'].includes(req.user.role)) {
    where.teams = {
      some: { teamMembers: { some: { userId: req.user.id } } },
    }
  }

  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { tasks: true, goals: true } },
      teams: {
        include: {
          teamMembers: {
            include: {
              user: { select: { id: true, name: true, role: true } },
            },
          },
        },
      },
    },
  })

  return res.json({ projects })
})

// ─── POST /api/projects ──────────────────────────────────────────────────────
router.post('/', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const { name, description, type, budget, deadline, clientName } = req.body

  if (!name || !type) {
    return res.status(400).json({ error: 'name and type are required.' })
  }

  if (!['external', 'internal'].includes(type)) {
    return res.status(400).json({ error: 'type must be "external" or "internal".' })
  }

  const project = await prisma.project.create({
    data: {
      name,
      description,
      type,
      budget: budget ? parseFloat(budget) : undefined,
      deadline: deadline ? new Date(deadline) : undefined,
      clientName: clientName || null,
    },
  })

  return res.status(201).json({ project })
})

// ─── GET /api/projects/:id ───────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      goals: { orderBy: { deadline: 'asc' } },
      teams: {
        include: {
          teamMembers: {
            include: {
              user: { select: { id: true, name: true, email: true, role: true } },
            },
          },
        },
      },
      sprints: {
        where: { status: 'active' },
        take: 1,
        include: {
          tasks: {
            include: {
              assignee: { select: { id: true, name: true } },
            },
          },
          milestones: true,
        },
      },
    },
  })

  if (!project) {
    return res.status(404).json({ error: 'Project not found.' })
  }

  return res.json({ project })
})

// ─── PUT /api/projects/:id ───────────────────────────────────────────────────
router.put('/:id', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const { name, description, type, status, budget, deadline, clientName } = req.body

  const existing = await prisma.project.findUnique({ where: { id: req.params.id } })
  if (!existing) {
    return res.status(404).json({ error: 'Project not found.' })
  }

  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(type && { type }),
      ...(status && { status }),
      ...(budget !== undefined && { budget: budget ? parseFloat(budget) : null }),
      ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
      ...(clientName !== undefined && { clientName }),
    },
  })

  return res.json({ project })
})

// ─── DELETE /api/projects/:id ────────────────────────────────────────────────
router.delete('/:id', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } })
  if (!project) return res.status(404).json({ error: 'Project not found.' })

  // Delete in dependency order to satisfy FK constraints
  await prisma.$transaction([
    prisma.projectDriveFolder.deleteMany({ where: { projectId: req.params.id } }),
    prisma.report.deleteMany({ where: { projectId: req.params.id } }),
    prisma.task.deleteMany({ where: { projectId: req.params.id } }),
    prisma.roadmapMilestone.deleteMany({ where: { projectId: req.params.id } }),
    prisma.teamMember.deleteMany({
      where: { team: { projectId: req.params.id } },
    }),
    prisma.team.deleteMany({ where: { projectId: req.params.id } }),
    prisma.sprint.deleteMany({ where: { projectId: req.params.id } }),
    prisma.goal.deleteMany({ where: { projectId: req.params.id } }),
    prisma.project.delete({ where: { id: req.params.id } }),
  ])

  return res.json({ message: 'Project deleted.' })
})

// ─── GET /api/projects/:id/dashboard ─────────────────────────────────────────
router.get('/:id/dashboard', requireAuth, async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
  })

  if (!project) {
    return res.status(404).json({ error: 'Project not found.' })
  }

  // Run all three queries in parallel
  const [activeSprint, openBlockers, taskCounts] = await Promise.all([
    prisma.sprint.findFirst({
      where: { projectId: project.id, status: 'active' },
      include: { tasks: true },
    }),
    prisma.task.findMany({
      where: { projectId: project.id, status: 'blocked' },
      select: {
        id: true,
        title: true,
        assignee: { select: { id: true, name: true } },
      },
    }),
    prisma.task.groupBy({
      by: ['status'],
      where: { projectId: project.id },
      _count: { status: true },
    }),
  ])

  // Sprint velocity: story points of done tasks in the active sprint
  const sprintVelocity = activeSprint
    ? activeSprint.tasks
        .filter((t) => t.status === 'done')
        .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
    : 0

  const totalSprintPoints = activeSprint
    ? activeSprint.tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
    : 0

  const taskBreakdown = Object.fromEntries(
    taskCounts.map(({ status, _count }) => [status, _count.status])
  )

  return res.json({
    dashboard: {
      projectId: project.id,
      name: project.name,
      status: project.status,
      budget: project.budget,
      deadline: project.deadline,
      budgetBurnPercent: budgetBurnPercent(project.createdAt, project.deadline),
      activeSprint: activeSprint
        ? {
            id: activeSprint.id,
            name: activeSprint.name,
            startDate: activeSprint.startDate,
            endDate: activeSprint.endDate,
            velocity: sprintVelocity,
            totalPoints: totalSprintPoints,
          }
        : null,
      openBlockers,
      taskBreakdown,
    },
  })
})

export default router
