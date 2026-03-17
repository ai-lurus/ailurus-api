import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// ─── GET /api/teams?projectId= ────────────────────────────────────────────────
router.get('/', requireAuth, requireRole('admin', 'ceo'), async (req, res, next) => {
  try {
    const { projectId } = req.query
    if (!projectId) {
      return res.status(400).json({ error: 'projectId query param is required.' })
    }

    const teams = await prisma.team.findMany({
      where: { projectId },
      include: {
        teamMembers: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    })

    res.json({ teams })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/teams ──────────────────────────────────────────────────────────
router.post('/', requireAuth, requireRole('admin', 'ceo'), async (req, res, next) => {
  try {
    const { projectId, name } = req.body
    if (!projectId || !name) {
      return res.status(400).json({ error: 'projectId and name are required.' })
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' })
    }

    const team = await prisma.team.create({
      data: { projectId, name },
      include: { teamMembers: true },
    })

    res.status(201).json({ team })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/teams/:id/members ──────────────────────────────────────────────
router.post('/:id/members', requireAuth, requireRole('admin', 'ceo'), async (req, res, next) => {
  try {
    const { userId } = req.body
    if (!userId) {
      return res.status(400).json({ error: 'userId is required.' })
    }

    const team = await prisma.team.findUnique({ where: { id: req.params.id } })
    if (!team) {
      return res.status(404).json({ error: 'Team not found.' })
    }

    const existing = await prisma.teamMember.findFirst({
      where: { teamId: req.params.id, userId },
    })
    if (existing) {
      return res.status(409).json({ error: 'User is already a member of this team.' })
    }

    const member = await prisma.teamMember.create({
      data: { teamId: req.params.id, userId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    })

    res.status(201).json({ member })
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/teams/:id/members/:userId ────────────────────────────────────
router.delete('/:id/members/:userId', requireAuth, requireRole('admin', 'ceo'), async (req, res, next) => {
  try {
    const { id: teamId, userId } = req.params

    const member = await prisma.teamMember.findFirst({ where: { teamId, userId } })
    if (!member) {
      return res.status(404).json({ error: 'Team member not found.' })
    }

    await prisma.teamMember.delete({ where: { id: member.id } })
    res.json({ message: 'Member removed.' })
  } catch (err) {
    next(err)
  }
})

// ─── PATCH /api/teams/:id ─────────────────────────────────────────────────────
router.patch('/:id', requireAuth, requireRole('admin', 'ceo'), async (req, res, next) => {
  try {
    const { name } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required.' })
    }

    const team = await prisma.team.findUnique({ where: { id: req.params.id } })
    if (!team) return res.status(404).json({ error: 'Team not found.' })

    const updated = await prisma.team.update({
      where: { id: req.params.id },
      data: { name: name.trim() },
      include: {
        teamMembers: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
        },
      },
    })

    res.json({ team: updated })
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/teams/:id ────────────────────────────────────────────────────
router.delete('/:id', requireAuth, requireRole('admin', 'ceo'), async (req, res, next) => {
  try {
    const team = await prisma.team.findUnique({ where: { id: req.params.id } })
    if (!team) return res.status(404).json({ error: 'Team not found.' })

    await prisma.teamMember.deleteMany({ where: { teamId: req.params.id } })
    await prisma.team.delete({ where: { id: req.params.id } })

    res.json({ message: 'Team deleted.' })
  } catch (err) {
    next(err)
  }
})

export default router
