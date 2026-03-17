import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

const VALID_STATUSES    = ['active', 'completed', 'paused']
const VALID_TOPIC_STATUS = ['pending', 'in_progress', 'completed']
const VALID_RESOURCE_TYPES = ['video', 'article', 'course', 'practice']

// Helper: recalculate progressPct for a path and persist it.
async function recalculateProgress(trainingPathId) {
  const topics = await prisma.learningTopic.findMany({
    where: { trainingPathId },
    select: { status: true },
  })

  const total     = topics.length
  const completed = topics.filter((t) => t.status === 'completed').length
  const pct       = total === 0 ? 0 : Math.round((completed / total) * 100)

  return prisma.trainingPath.update({
    where: { id: trainingPathId },
    data:  { progressPct: pct },
  })
}

// Include clause shared by list queries
const pathInclude = {
  topics: { orderBy: { orderIndex: 'asc' } },
  assignedByUser: { select: { id: true, name: true } },
}

const VALID_RESOURCE_TYPES_ARR = ['video', 'article', 'course', 'practice']

// ─── POST /api/learning/persist-ai-plan ──────────────────────────────────────
// Persists a pre-structured AI plan for the authenticated developer.
// Body: { title, careerPath, description, topics[] }
router.post('/persist-ai-plan', requireAuth, requireRole('developer', 'admin', 'ceo'), async (req, res) => {
  const { title, careerPath, description, topics } = req.body
  const userId = req.user.id

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required.' })
  }
  if (!Array.isArray(topics)) {
    return res.status(400).json({ error: 'topics must be an array.' })
  }

  const path = await prisma.trainingPath.create({
    data: {
      userId,
      title:        title.trim(),
      skill:        title.trim(),
      careerPath:   careerPath?.trim() || null,
      description:  description?.trim() || null,
      generatedByAI: true,
      topics: {
        create: topics.map((t, idx) => ({
          title:        t.title?.trim() ?? `Topic ${idx + 1}`,
          description:  t.description?.trim() || null,
          resourceType: VALID_RESOURCE_TYPES_ARR.includes(t.resourceType) ? t.resourceType : 'article',
          orderIndex:   t.orderIndex ?? idx,
        })),
      },
    },
    include: { topics: { orderBy: { orderIndex: 'asc' } } },
  })

  return res.status(201).json({ path })
})

// ─── GET /api/learning ────────────────────────────────────────────────────────
// Developer: own paths only. Admin/CEO: filter by ?userId= or list all.
router.get('/', requireAuth, async (req, res) => {
  const { userId } = req.query
  const isDeveloper = req.user.role === 'developer'

  const targetUserId = isDeveloper ? req.user.id : (userId || undefined)

  const paths = await prisma.trainingPath.findMany({
    where: targetUserId ? { userId: targetUserId } : {},
    include: pathInclude,
    orderBy: { createdAt: 'desc' },
  })

  return res.json({ paths })
})

// ─── POST /api/learning ───────────────────────────────────────────────────────
// Admin/CEO: create a path (with optional initial topics).
router.post('/', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const { userId, title, careerPath, description, dueDate, topics } = req.body

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required.' })
  }
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required.' })
  }

  const targetUser = await prisma.user.findUnique({ where: { id: userId } })
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found.' })
  }

  const parsedTopics = Array.isArray(topics) ? topics : []
  for (const [i, topic] of parsedTopics.entries()) {
    if (!topic.title || typeof topic.title !== 'string') {
      return res.status(400).json({ error: `Topic at index ${i} is missing a title.` })
    }
    if (topic.resourceType && !VALID_RESOURCE_TYPES.includes(topic.resourceType)) {
      return res.status(400).json({ error: `Topic at index ${i} has invalid resourceType.` })
    }
  }

  const path = await prisma.trainingPath.create({
    data: {
      userId,
      title:      title.trim(),
      skill:      title.trim(), // keep legacy field in sync
      careerPath: careerPath?.trim() || null,
      description: description?.trim() || null,
      assignedBy: req.user.id,
      dueDate:    dueDate ? new Date(dueDate) : null,
      generatedByAI: false,
      topics: {
        create: parsedTopics.map((t, idx) => ({
          title:        t.title.trim(),
          description:  t.description?.trim() || null,
          resourceUrl:  t.resourceUrl?.trim() || null,
          resourceType: t.resourceType || 'article',
          orderIndex:   t.orderIndex ?? idx,
          dueDate:      t.dueDate ? new Date(t.dueDate) : null,
        })),
      },
    },
    include: pathInclude,
  })

  return res.status(201).json({ path })
})

// ─── PUT /api/learning/:id ────────────────────────────────────────────────────
// Admin/CEO: update path metadata.
router.put('/:id', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const { id } = req.params
  const { title, careerPath, description, dueDate, status } = req.body

  const existing = await prisma.trainingPath.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Learning path not found.' })

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.` })
  }

  const path = await prisma.trainingPath.update({
    where: { id },
    data: {
      ...(title       !== undefined && { title: title.trim(), skill: title.trim() }),
      ...(careerPath  !== undefined && { careerPath: careerPath?.trim() || null }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(dueDate     !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(status      !== undefined && { status }),
    },
    include: pathInclude,
  })

  return res.json({ path })
})

// ─── DELETE /api/learning/:id ─────────────────────────────────────────────────
// Admin/CEO: delete path (topics cascade).
router.delete('/:id', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const { id } = req.params

  const existing = await prisma.trainingPath.findUnique({ where: { id } })
  if (!existing) return res.status(404).json({ error: 'Learning path not found.' })

  await prisma.trainingPath.delete({ where: { id } })
  return res.json({ success: true })
})

// ─── POST /api/learning/:pathId/topics ────────────────────────────────────────
// Admin/CEO: add a topic to an existing path.
router.post('/:pathId/topics', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const { pathId } = req.params
  const { title, description, resourceUrl, resourceType, orderIndex, dueDate } = req.body

  const path = await prisma.trainingPath.findUnique({ where: { id: pathId } })
  if (!path) return res.status(404).json({ error: 'Learning path not found.' })

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required.' })
  }
  if (resourceType && !VALID_RESOURCE_TYPES.includes(resourceType)) {
    return res.status(400).json({ error: `Invalid resourceType. Must be one of: ${VALID_RESOURCE_TYPES.join(', ')}.` })
  }

  // Default orderIndex to max + 1
  let nextIndex = orderIndex
  if (nextIndex === undefined) {
    const last = await prisma.learningTopic.findFirst({
      where: { trainingPathId: pathId },
      orderBy: { orderIndex: 'desc' },
    })
    nextIndex = (last?.orderIndex ?? -1) + 1
  }

  const topic = await prisma.learningTopic.create({
    data: {
      trainingPathId: pathId,
      title:        title.trim(),
      description:  description?.trim() || null,
      resourceUrl:  resourceUrl?.trim() || null,
      resourceType: resourceType || 'article',
      orderIndex:   nextIndex,
      dueDate:      dueDate ? new Date(dueDate) : null,
    },
  })

  return res.status(201).json({ topic })
})

// ─── PUT /api/learning/topics/:id ─────────────────────────────────────────────
// Developer (own path) or Admin/CEO: update topic status; recalculates progressPct.
router.put('/topics/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const { status, title, description, resourceUrl, resourceType, dueDate } = req.body

  const topic = await prisma.learningTopic.findUnique({
    where: { id },
    include: { trainingPath: { select: { userId: true } } },
  })
  if (!topic) return res.status(404).json({ error: 'Topic not found.' })

  // Developers can only update topics on their own paths
  if (req.user.role === 'developer' && topic.trainingPath.userId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied.' })
  }

  if (status && !VALID_TOPIC_STATUS.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_TOPIC_STATUS.join(', ')}.` })
  }
  if (resourceType && !VALID_RESOURCE_TYPES.includes(resourceType)) {
    return res.status(400).json({ error: `Invalid resourceType. Must be one of: ${VALID_RESOURCE_TYPES.join(', ')}.` })
  }

  const isAdminOrCeo = ['admin', 'ceo'].includes(req.user.role)

  const updatedTopic = await prisma.learningTopic.update({
    where: { id },
    data: {
      ...(status !== undefined && {
        status,
        completedAt: status === 'completed' ? new Date() : null,
      }),
      // Admins can also edit metadata
      ...(isAdminOrCeo && title       !== undefined && { title: title.trim() }),
      ...(isAdminOrCeo && description !== undefined && { description: description?.trim() || null }),
      ...(isAdminOrCeo && resourceUrl !== undefined && { resourceUrl: resourceUrl?.trim() || null }),
      ...(isAdminOrCeo && resourceType !== undefined && { resourceType }),
      ...(isAdminOrCeo && dueDate     !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
    },
  })

  // Recalculate progress whenever status changes
  if (status !== undefined) {
    await recalculateProgress(topic.trainingPathId)
  }

  return res.json({ topic: updatedTopic })
})

// ─── DELETE /api/learning/topics/:id ──────────────────────────────────────────
// Admin/CEO: remove a topic and recalculate path progress.
router.delete('/topics/:id', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const { id } = req.params

  const topic = await prisma.learningTopic.findUnique({ where: { id } })
  if (!topic) return res.status(404).json({ error: 'Topic not found.' })

  await prisma.learningTopic.delete({ where: { id } })
  await recalculateProgress(topic.trainingPathId)

  return res.json({ success: true })
})

export default router
