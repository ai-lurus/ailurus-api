import { Router } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

const VALID_ROLES = ['ceo', 'admin', 'developer', 'designer', 'client']

// ─── GET /api/users/mentionable ───────────────────────────────────────────────
// Any authenticated user — minimal fields for @mention autocomplete
router.get('/mentionable', requireAuth, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, role: true },
    })
    res.json({ users })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/users ───────────────────────────────────────────────────────────
router.get('/', requireAuth, requireRole('admin', 'ceo'), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        teamMembers: {
          select: {
            team: {
              select: {
                id: true,
                name: true,
                project: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })
    res.json({ users })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/users ──────────────────────────────────────────────────────────
// Creates a user without logging them in (admin/ceo tool, not self-registration).
router.post('/', requireAuth, requireRole('admin', 'ceo'), async (req, res, next) => {
  try {
    const { name, email, role, password } = req.body

    if (!name || !email || !role || !password) {
      return res.status(400).json({ error: 'name, email, role, and password are required.' })
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}.` })
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(409).json({ error: 'An account with that email already exists.' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })

    res.status(201).json({ user })
  } catch (err) {
    next(err)
  }
})

// ─── PATCH /api/users/:id ─────────────────────────────────────────────────────
router.patch('/:id', requireAuth, requireRole('admin', 'ceo'), async (req, res, next) => {
  try {
    const { id } = req.params
    const { role, active } = req.body

    const data = {}

    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}.` })
      }
      data.role = role
    }

    if (active !== undefined) {
      data.active = Boolean(active)
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'role or active is required.' })
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    })

    res.json({ user })
  } catch (err) {
    next(err)
  }
})

export default router
