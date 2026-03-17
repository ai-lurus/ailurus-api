import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days

const VALID_ROLES = ['ceo', 'admin', 'developer', 'client']

const isProd = process.env.NODE_ENV === 'production'

function setCookieToken(res, payload) {
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: COOKIE_MAX_AGE,
  })
  return token
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, and role are required.' })
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

  setCookieToken(res, { id: user.id, email: user.email, role: user.role })

  return res.status(201).json({ user })
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' })
  }

  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password.' })
  }

  if (!user.active) {
    return res.status(403).json({ error: 'Your account has been deactivated. Contact an administrator.' })
  }

  setCookieToken(res, { id: user.id, email: user.email, role: user.role })

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
  })
})

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  })
  return res.json({ message: 'Logged out successfully.' })
})

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })

  if (!user) {
    return res.status(404).json({ error: 'User not found.' })
  }

  return res.json({ user })
})

// PATCH /api/auth/me
router.patch('/me', requireAuth, async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body

  const existing = await prisma.user.findUnique({ where: { id: req.user.id } })
  if (!existing) {
    return res.status(404).json({ error: 'User not found.' })
  }

  const data = {}

  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'Name cannot be empty.' })
    data.name = name.trim()
  }

  if (email !== undefined) {
    if (!email.trim()) return res.status(400).json({ error: 'Email cannot be empty.' })
    const taken = await prisma.user.findFirst({ where: { email: email.trim(), NOT: { id: req.user.id } } })
    if (taken) return res.status(409).json({ error: 'Email already in use.' })
    data.email = email.trim()
  }

  if (newPassword !== undefined) {
    if (!currentPassword) return res.status(400).json({ error: 'Current password is required to set a new password.' })
    const valid = await bcrypt.compare(currentPassword, existing.passwordHash)
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' })
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' })
    data.passwordHash = await bcrypt.hash(newPassword, 10)
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No changes provided.' })
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })

  return res.json({ user })
})

export default router
