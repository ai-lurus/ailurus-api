import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// ─── GET /api/notifications ───────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return res.json({ notifications })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/notifications/unread-count ─────────────────────────────────────
router.get('/unread-count', requireAuth, async (req, res, next) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user.id, read: false },
    })
    return res.json({ count })
  } catch (err) {
    next(err)
  }
})

// ─── PATCH /api/notifications/:id/read ───────────────────────────────────────
router.patch('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } })
    if (!notification) return res.status(404).json({ error: 'Notification not found.' })
    if (notification.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden.' })

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true },
    })
    return res.json({ notification: updated })
  } catch (err) {
    next(err)
  }
})

// ─── PATCH /api/notifications/read-all ───────────────────────────────────────
router.patch('/read-all', requireAuth, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, read: false },
      data: { read: true },
    })
    return res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
