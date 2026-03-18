import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

const VALID_STATUSES = ['backlog', 'ready', 'in_progress', 'blocked', 'in_review', 'done']
const VALID_CATEGORIES = ['engineering', 'design', 'marketing', 'other']

// ─── GET /api/tasks/today-activity ───────────────────────────────────────────
// Admin/CEO: returns tasks touched today, grouped by assignee.
// Query param: date (YYYY-MM-DD, defaults to today)
router.get('/today-activity', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const { date } = req.query
  const target = date ? new Date(date) : new Date()
  const dayStr = target.toISOString().slice(0, 10)
  const startOfDay = new Date(dayStr + 'T00:00:00.000Z')
  const endOfDay   = new Date(dayStr + 'T23:59:59.999Z')

  const tasks = await prisma.task.findMany({
    where: {
      assignedTo: { not: null },
      updatedAt: { gte: startOfDay, lte: endOfDay },
    },
    include: {
      assignee: { select: { id: true, name: true } },
      project:  { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Group by assignee userId
  const byUser = {}
  for (const task of tasks) {
    const uid = task.assignedTo
    if (!byUser[uid]) byUser[uid] = { user: task.assignee, tasks: [] }
    byUser[uid].tasks.push(task)
  }

  return res.json({ activity: Object.values(byUser) })
})

// ─── GET /api/tasks/history?userId=X&from=YYYY-MM-DD&to=YYYY-MM-DD ───────────
// Admin/CEO: completed/in_review tasks for a user, grouped by ISO week.
router.get('/history', requireAuth, requireRole('admin', 'ceo'), async (req, res, next) => {
  try {
    const { userId, from, to } = req.query
    if (!userId) {
      return res.status(400).json({ error: 'userId query param is required.' })
    }

    const where = {
      assignedTo: userId,
      status: { in: ['done', 'in_review'] },
    }

    if (from || to) {
      where.updatedAt = {}
      if (from) {
        const parsedFrom = new Date(from)
        if (isNaN(parsedFrom.getTime())) {
          return res.status(400).json({ error: 'from must be a valid date (YYYY-MM-DD).' })
        }
        where.updatedAt.gte = new Date(parsedFrom.toISOString().slice(0, 10) + 'T00:00:00.000Z')
      }
      if (to) {
        const parsedTo = new Date(to)
        if (isNaN(parsedTo.getTime())) {
          return res.status(400).json({ error: 'to must be a valid date (YYYY-MM-DD).' })
        }
        where.updatedAt.lte = new Date(parsedTo.toISOString().slice(0, 10) + 'T23:59:59.999Z')
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        project: { select: { id: true, name: true } },
        sprint:  { select: { id: true, name: true } },
      },
    })

    // Group by ISO week (YYYY-Www)
    function getISOWeek(date) {
      const d = new Date(date)
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() + 4 - (d.getDay() || 7))
      const yearStart = new Date(d.getFullYear(), 0, 1)
      const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
      return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
    }

    const byWeek = {}
    for (const task of tasks) {
      const week = getISOWeek(task.updatedAt)
      if (!byWeek[week]) byWeek[week] = { week, tasks: [], totalPoints: 0 }
      byWeek[week].tasks.push(task)
      byWeek[week].totalPoints += task.storyPoints ?? 0
    }

    const weeks = Object.values(byWeek).sort((a, b) => b.week.localeCompare(a.week))

    return res.json({ weeks, tasks })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/tasks/backlog ───────────────────────────────────────────────────
// Must be defined BEFORE /:id to prevent "backlog" being treated as an id
router.get('/backlog', requireAuth, async (req, res) => {
  const { projectId } = req.query

  if (!projectId) {
    return res.status(400).json({ error: 'projectId query param is required.' })
  }

  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      status: 'backlog',
    },
    orderBy: [{ storyPoints: 'desc' }, { createdAt: 'asc' }],
    include: {
      assignee: { select: { id: true, name: true } },
      goal: { select: { id: true, title: true } },
    },
  })

  return res.json({ tasks })
})

// ─── GET /api/tasks ───────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const { projectId, sprintId, assignedTo, status } = req.query

  const where = {}
  if (projectId) where.projectId = projectId
  if (sprintId) where.sprintId = sprintId
  if (assignedTo) where.assignedTo = assignedTo
  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.` })
    }
    where.status = status
  }

  // Developers and designers only see tasks in their projects
  if (['developer', 'designer'].includes(req.user.role)) {
    where.project = {
      teams: {
        some: { teamMembers: { some: { userId: req.user.id } } },
      },
    }
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      assignee: { select: { id: true, name: true, role: true } },
      reviewer: { select: { id: true, name: true } },
      goal: { select: { id: true, title: true } },
      sprint: { select: { id: true, name: true, status: true } },
      project: { select: { id: true, name: true } },
    },
  })

  return res.json({ tasks })
})

// ─── POST /api/tasks ──────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const {
    projectId,
    sprintId,
    goalId,
    assignedTo,
    title,
    description,
    category,
    storyPoints,
    estimatedHrs,
  } = req.body

  if (!projectId || !title) {
    return res.status(400).json({ error: 'projectId and title are required.' })
  }

  if (category && !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({
      error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}.`,
    })
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { teams: { include: { teamMembers: { select: { userId: true } } } } },
  })
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' })
  }

  // Developers and designers can only create tickets in their own projects
  if (['developer', 'designer'].includes(req.user.role)) {
    const isMember = project.teams.some((team) =>
      team.teamMembers.some((m) => m.userId === req.user.id)
    )
    if (!isMember) {
      return res.status(403).json({ error: 'You can only create tickets in projects you belong to.' })
    }
  }

  const task = await prisma.task.create({
    data: {
      projectId,
      sprintId: sprintId || null,
      goalId: goalId || null,
      assignedTo: assignedTo || null,
      title,
      description: description || null,
      category: category || 'engineering',
      storyPoints: storyPoints ? parseInt(storyPoints) : null,
      estimatedHrs: estimatedHrs ? parseFloat(estimatedHrs) : null,
    },
    include: {
      assignee: { select: { id: true, name: true } },
      goal: { select: { id: true, title: true } },
    },
  })

  return res.status(201).json({ task })
})

// ─── PUT /api/tasks/:id ───────────────────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  const { status, assignedTo, storyPoints, estimatedHrs, title, description, sprintId, prLink } = req.body

  const existing = await prisma.task.findUnique({ where: { id: req.params.id } })
  if (!existing) {
    return res.status(404).json({ error: 'Task not found.' })
  }

  // Developers/designers can only update their own tasks, EXCEPT approving in_review tasks
  if (['developer', 'designer'].includes(req.user.role)) {
    const isApprovingOthersTask = status === 'done' && existing.assignedTo !== req.user.id
    const isOwnTask = existing.assignedTo === req.user.id
    if (!isOwnTask && !isApprovingOthersTask) {
      return res.status(403).json({ error: 'You can only update tasks assigned to you.' })
    }
  }

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.`,
    })
  }

  // When someone marks a task done and they are NOT the assignee, record them as reviewer
  const isReviewApproval = status === 'done' && existing.assignedTo !== req.user.id

  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: {
      ...(status && { status }),
      ...(assignedTo !== undefined && { assignedTo: assignedTo || null }),
      ...(storyPoints !== undefined && { storyPoints: storyPoints ? parseInt(storyPoints) : null }),
      ...(estimatedHrs !== undefined && { estimatedHrs: estimatedHrs ? parseFloat(estimatedHrs) : null }),
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(sprintId !== undefined && { sprintId: sprintId || null }),
      ...(prLink !== undefined && { prLink: prLink || null }),
      ...(isReviewApproval && { reviewedBy: req.user.id, reviewedAt: new Date() }),
    },
    include: {
      assignee: { select: { id: true, name: true } },
      reviewer: { select: { id: true, name: true } },
      goal: { select: { id: true, title: true } },
      sprint: { select: { id: true, name: true } },
    },
  })

  return res.json({ task })
})

export default router
