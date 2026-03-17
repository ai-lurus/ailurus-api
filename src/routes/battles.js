import { Router } from 'express'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const require = createRequire(import.meta.url)
const multer = require('multer')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENEMIES_DIR = path.join(__dirname, '../../public/enemies')

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ENEMIES_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `enemy_${Date.now()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) return cb(null, true)
    cb(new Error('Only image files are allowed.'))
  },
})

const router = Router()

const VALID_BODIES      = ['round', 'square', 'slim', 'wide']
const VALID_HEADS       = ['round', 'square', 'cat', 'robot']
const VALID_ACCESSORIES = ['none', 'hat', 'glasses', 'crown']

// ─── Avatar ──────────────────────────────────────────────────────────────────

// GET /api/battles/avatar
router.get('/avatar', requireAuth, async (req, res) => {
  const avatar = await prisma.avatarConfig.findUnique({ where: { userId: req.user.id } })
  return res.json({ avatar })
})

// PUT /api/battles/avatar
router.put('/avatar', requireAuth, async (req, res) => {
  const { body, head, primaryColor, secondaryColor, accentColor, accessory } = req.body

  if (body && !VALID_BODIES.includes(body)) {
    return res.status(400).json({ error: `Invalid body. Must be one of: ${VALID_BODIES.join(', ')}.` })
  }
  if (head && !VALID_HEADS.includes(head)) {
    return res.status(400).json({ error: `Invalid head. Must be one of: ${VALID_HEADS.join(', ')}.` })
  }
  if (accessory && !VALID_ACCESSORIES.includes(accessory)) {
    return res.status(400).json({ error: `Invalid accessory. Must be one of: ${VALID_ACCESSORIES.join(', ')}.` })
  }

  const avatar = await prisma.avatarConfig.upsert({
    where: { userId: req.user.id },
    create: {
      userId: req.user.id,
      ...(body      && { body }),
      ...(head      && { head }),
      ...(primaryColor   && { primaryColor }),
      ...(secondaryColor && { secondaryColor }),
      ...(accentColor    && { accentColor }),
      ...(accessory && { accessory }),
    },
    update: {
      ...(body      !== undefined && { body }),
      ...(head      !== undefined && { head }),
      ...(primaryColor   !== undefined && { primaryColor }),
      ...(secondaryColor !== undefined && { secondaryColor }),
      ...(accentColor    !== undefined && { accentColor }),
      ...(accessory !== undefined && { accessory }),
    },
  })

  return res.json({ avatar })
})

// ─── Enemies ─────────────────────────────────────────────────────────────────

// GET /api/battles/enemies
router.get('/enemies', requireAuth, async (req, res) => {
  const enemies = await prisma.enemyImage.findMany({ orderBy: { uploadedAt: 'desc' } })
  return res.json({ enemies })
})

// POST /api/battles/enemies (admin)
router.post('/enemies', requireAuth, requireRole('admin', 'ceo'), upload.single('enemy'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })

  const enemy = await prisma.enemyImage.create({ data: { filename: req.file.filename } })
  return res.status(201).json({ enemy })
})

// DELETE /api/battles/enemies/:id (admin)
router.delete('/enemies/:id', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const enemy = await prisma.enemyImage.findUnique({ where: { id: req.params.id } })
  if (!enemy) return res.status(404).json({ error: 'Enemy not found.' })

  const filePath = path.join(ENEMIES_DIR, enemy.filename)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

  await prisma.enemyImage.delete({ where: { id: req.params.id } })
  return res.json({ success: true })
})

// ─── Topics ──────────────────────────────────────────────────────────────────

const topicInclude = {
  battles: { orderBy: { order: 'asc' }, select: { id: true, title: true, order: true, questionsJson: true } },
}

// GET /api/battles/topics (all — admin can see full; users see summary)
router.get('/topics', requireAuth, async (req, res) => {
  const topics = await prisma.battleTopic.findMany({
    orderBy: { orderIndex: 'asc' },
    include: topicInclude,
  })
  return res.json({ topics })
})

// POST /api/battles/topics (admin)
router.post('/topics', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const { title, description, icon, orderIndex } = req.body

  if (!title?.trim()) return res.status(400).json({ error: 'title is required.' })

  const nextOrder = typeof orderIndex === 'number'
    ? orderIndex
    : await prisma.battleTopic.count()

  const topic = await prisma.battleTopic.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      icon: icon?.trim() || '📚',
      orderIndex: nextOrder,
    },
    include: topicInclude,
  })
  return res.status(201).json({ topic })
})

// PUT /api/battles/topics/:id (admin)
router.put('/topics/:id', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const existing = await prisma.battleTopic.findUnique({ where: { id: req.params.id } })
  if (!existing) return res.status(404).json({ error: 'Topic not found.' })

  const { title, description, icon, orderIndex } = req.body
  const topic = await prisma.battleTopic.update({
    where: { id: req.params.id },
    data: {
      ...(title       !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(icon        !== undefined && { icon: icon?.trim() || '📚' }),
      ...(orderIndex  !== undefined && { orderIndex }),
    },
    include: topicInclude,
  })
  return res.json({ topic })
})

// DELETE /api/battles/topics/:id (admin)
router.delete('/topics/:id', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const existing = await prisma.battleTopic.findUnique({ where: { id: req.params.id } })
  if (!existing) return res.status(404).json({ error: 'Topic not found.' })

  await prisma.battleTopic.delete({ where: { id: req.params.id } })
  return res.json({ success: true })
})

// POST /api/battles/topics/:id/battles — upload battles JSON (admin)
router.post('/topics/:id/battles', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const topic = await prisma.battleTopic.findUnique({ where: { id: req.params.id } })
  if (!topic) return res.status(404).json({ error: 'Topic not found.' })

  const { battles } = req.body
  if (!Array.isArray(battles) || battles.length === 0) {
    return res.status(400).json({ error: 'battles array is required.' })
  }
  if (battles.length > 5) {
    return res.status(400).json({ error: 'A topic can have at most 5 battles.' })
  }

  for (const [i, b] of battles.entries()) {
    if (!b.title?.trim()) return res.status(400).json({ error: `Battle ${i + 1}: title is required.` })
    if (!Array.isArray(b.questions) || b.questions.length !== 12) {
      return res.status(400).json({ error: `Battle ${i + 1}: must have exactly 12 questions.` })
    }
    for (const [j, q] of b.questions.entries()) {
      if (!q.text?.trim()) return res.status(400).json({ error: `Battle ${i + 1}, Q${j + 1}: text is required.` })
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        return res.status(400).json({ error: `Battle ${i + 1}, Q${j + 1}: must have exactly 4 options.` })
      }
      if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) {
        return res.status(400).json({ error: `Battle ${i + 1}, Q${j + 1}: correctIndex must be 0-3.` })
      }
    }
  }

  // Delete existing battles and recreate
  await prisma.battleFight.deleteMany({ where: { topicId: req.params.id } })
  const created = await Promise.all(
    battles.map((b, i) =>
      prisma.battleFight.create({
        data: {
          topicId: req.params.id,
          title: b.title.trim(),
          order: i + 1,
          questionsJson: b.questions,
        },
      })
    )
  )

  return res.status(201).json({ battles: created })
})

// ─── Learning Paths ──────────────────────────────────────────────────────────

const pathIncludeAdmin = {
  topics: {
    orderBy: { orderIndex: 'asc' },
    include: { topic: { select: { id: true, title: true, icon: true } } },
  },
  userPaths: {
    include: { user: { select: { id: true, name: true, email: true } } },
  },
}

// GET /api/battles/paths (admin)
router.get('/paths', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const paths = await prisma.battleLearningPath.findMany({
    orderBy: { createdAt: 'desc' },
    include: pathIncludeAdmin,
  })
  return res.json({ paths })
})

// POST /api/battles/paths (admin)
router.post('/paths', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const { title, topicIds } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'title is required.' })

  const topicIdsArr = Array.isArray(topicIds) ? topicIds : []

  const path = await prisma.battleLearningPath.create({
    data: {
      title: title.trim(),
      createdBy: req.user.id,
      topics: {
        create: topicIdsArr.map((tId, i) => ({ topicId: tId, orderIndex: i })),
      },
    },
    include: pathIncludeAdmin,
  })
  return res.status(201).json({ path })
})

// PUT /api/battles/paths/:id (admin)
router.put('/paths/:id', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const existing = await prisma.battleLearningPath.findUnique({ where: { id: req.params.id } })
  if (!existing) return res.status(404).json({ error: 'Path not found.' })

  const { title } = req.body
  const path = await prisma.battleLearningPath.update({
    where: { id: req.params.id },
    data: { ...(title !== undefined && { title: title.trim() }) },
    include: pathIncludeAdmin,
  })
  return res.json({ path })
})

// DELETE /api/battles/paths/:id (admin)
router.delete('/paths/:id', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const existing = await prisma.battleLearningPath.findUnique({ where: { id: req.params.id } })
  if (!existing) return res.status(404).json({ error: 'Path not found.' })

  await prisma.battleLearningPath.delete({ where: { id: req.params.id } })
  return res.json({ success: true })
})

// POST /api/battles/paths/:pathId/assign (admin)
router.post('/paths/:pathId/assign', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId is required.' })

  const pathExists = await prisma.battleLearningPath.findUnique({ where: { id: req.params.pathId } })
  if (!pathExists) return res.status(404).json({ error: 'Path not found.' })

  const userExists = await prisma.user.findUnique({ where: { id: userId } })
  if (!userExists) return res.status(404).json({ error: 'User not found.' })

  const assignment = await prisma.userBattlePath.upsert({
    where: { userId_pathId: { userId, pathId: req.params.pathId } },
    create: { userId, pathId: req.params.pathId },
    update: {},
  })
  return res.status(201).json({ assignment })
})

// POST /api/battles/paths/:pathId/topics (admin)
router.post('/paths/:pathId/topics', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const { topicId } = req.body
  if (!topicId) return res.status(400).json({ error: 'topicId is required.' })

  const pathExists = await prisma.battleLearningPath.findUnique({ where: { id: req.params.pathId } })
  if (!pathExists) return res.status(404).json({ error: 'Path not found.' })

  const topicExists = await prisma.battleTopic.findUnique({ where: { id: topicId } })
  if (!topicExists) return res.status(404).json({ error: 'Topic not found.' })

  const count = await prisma.battlePathTopic.count({ where: { pathId: req.params.pathId } })

  const entry = await prisma.battlePathTopic.upsert({
    where: { pathId_topicId: { pathId: req.params.pathId, topicId } },
    create: { pathId: req.params.pathId, topicId, orderIndex: count },
    update: {},
  })

  const path = await prisma.battleLearningPath.findUnique({
    where: { id: req.params.pathId },
    include: pathIncludeAdmin,
  })
  return res.json({ path })
})

// DELETE /api/battles/paths/:pathId/topics/:topicId (admin)
router.delete('/paths/:pathId/topics/:topicId', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  await prisma.battlePathTopic.deleteMany({
    where: { pathId: req.params.pathId, topicId: req.params.topicId },
  })

  const path = await prisma.battleLearningPath.findUnique({
    where: { id: req.params.pathId },
    include: pathIncludeAdmin,
  })
  return res.json({ path })
})

// DELETE /api/battles/paths/:pathId/assign/:userId (admin)
router.delete('/paths/:pathId/assign/:userId', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  await prisma.userBattlePath.deleteMany({
    where: { pathId: req.params.pathId, userId: req.params.userId },
  })
  return res.json({ success: true })
})

// ─── User: My paths & progress ───────────────────────────────────────────────

// GET /api/battles/my-paths
router.get('/my-paths', requireAuth, async (req, res) => {
  const userId = req.user.id

  const userPaths = await prisma.userBattlePath.findMany({
    where: { userId },
    include: {
      path: {
        include: {
          topics: {
            orderBy: { orderIndex: 'asc' },
            include: {
              topic: {
                include: {
                  battles: { orderBy: { order: 'asc' }, select: { id: true, title: true, order: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  // Attach user progress to each battle
  const allBattleIds = userPaths.flatMap((up) =>
    up.path.topics.flatMap((pt) => pt.topic.battles.map((b) => b.id))
  )

  const progress = await prisma.userBattleProgress.findMany({
    where: { userId, battleId: { in: allBattleIds } },
  })
  const progressByBattleId = Object.fromEntries(progress.map((p) => [p.battleId, p]))

  const paths = userPaths.map((up) => ({
    ...up.path,
    topics: up.path.topics.map((pt) => ({
      ...pt.topic,
      battles: pt.topic.battles.map((b) => ({
        ...b,
        progress: progressByBattleId[b.id] ?? null,
      })),
    })),
  }))

  return res.json({ paths })
})

// GET /api/battles/users/:userId/progress (admin) — progress for any user
router.get('/users/:userId/progress', requireAuth, requireRole('admin', 'ceo'), async (req, res) => {
  const { userId } = req.params

  const userExists = await prisma.user.findUnique({ where: { id: userId } })
  if (!userExists) return res.status(404).json({ error: 'User not found.' })

  const userPaths = await prisma.userBattlePath.findMany({
    where: { userId },
    include: {
      path: {
        include: {
          topics: {
            orderBy: { orderIndex: 'asc' },
            include: {
              topic: {
                include: {
                  battles: { orderBy: { order: 'asc' }, select: { id: true, title: true, order: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  const allBattleIds = userPaths.flatMap((up) =>
    up.path.topics.flatMap((pt) => pt.topic.battles.map((b) => b.id))
  )

  const progress = await prisma.userBattleProgress.findMany({
    where: { userId, battleId: { in: allBattleIds } },
  })
  const progressByBattleId = Object.fromEntries(progress.map((p) => [p.battleId, p]))

  const paths = userPaths.map((up) => ({
    ...up.path,
    topics: up.path.topics.map((pt) => ({
      ...pt.topic,
      battles: pt.topic.battles.map((b) => ({
        ...b,
        progress: progressByBattleId[b.id] ?? null,
      })),
    })),
  }))

  return res.json({ paths })
})

// GET /api/battles/topics/:topicId/detail — full topic with questions for user
router.get('/topics/:topicId/detail', requireAuth, async (req, res) => {
  const topic = await prisma.battleTopic.findUnique({
    where: { id: req.params.topicId },
    include: {
      battles: { orderBy: { order: 'asc' } },
    },
  })
  if (!topic) return res.status(404).json({ error: 'Topic not found.' })

  const progress = await prisma.userBattleProgress.findMany({
    where: { userId: req.user.id, topicId: req.params.topicId },
  })
  const progressByBattleId = Object.fromEntries(progress.map((p) => [p.battleId, p]))

  const battles = topic.battles.map((b) => ({
    ...b,
    progress: progressByBattleId[b.id] ?? null,
  }))

  return res.json({ topic: { ...topic, battles } })
})

// POST /api/battles/progress — save battle result
router.post('/progress', requireAuth, async (req, res) => {
  const { battleId, topicId, score, completed, enemyImageId } = req.body

  if (!battleId) return res.status(400).json({ error: 'battleId is required.' })
  if (!topicId)  return res.status(400).json({ error: 'topicId is required.' })
  if (typeof score !== 'number') return res.status(400).json({ error: 'score (number) is required.' })
  if (typeof completed !== 'boolean') return res.status(400).json({ error: 'completed (boolean) is required.' })

  const battle = await prisma.battleFight.findUnique({ where: { id: battleId } })
  if (!battle) return res.status(404).json({ error: 'Battle not found.' })

  const existing = await prisma.userBattleProgress.findUnique({
    where: { userId_battleId: { userId: req.user.id, battleId } },
  })

  const progress = await prisma.userBattleProgress.upsert({
    where: { userId_battleId: { userId: req.user.id, battleId } },
    create: {
      userId: req.user.id,
      topicId,
      battleId,
      enemyImageId: enemyImageId || null,
      completed,
      score,
      attempts: 1,
      lastAttemptAt: new Date(),
    },
    update: {
      completed: existing?.completed ? true : completed, // once completed, stays completed
      score: Math.max(existing?.score ?? 0, score),
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
      ...(enemyImageId && { enemyImageId }),
    },
  })

  return res.json({ progress })
})

export default router
