import { Router } from 'express'
import { google } from 'googleapis'
import crypto from 'crypto'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// In-memory state store for OAuth CSRF protection
// Maps state token → { userId, expiry }
const oauthStateStore = new Map()

const STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
]

function buildOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

// ─── GET /api/integrations/google/connect ─────────────────────────────────────
router.get(
  '/google/connect',
  requireAuth,
  requireRole('admin', 'ceo'),
  (req, res) => {
    const state = crypto.randomBytes(32).toString('hex')
    oauthStateStore.set(state, { userId: req.user.id, expiry: Date.now() + STATE_TTL_MS })

    const oauth2Client = buildOAuth2Client()
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
      state,
    })

    res.redirect(authUrl)
  }
)

// ─── GET /api/integrations/google/callback ────────────────────────────────────
router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000'

  if (error) {
    console.error('Google OAuth error:', error)
    return res.redirect(`${clientUrl}/admin?google=error`)
  }

  const stateEntry = oauthStateStore.get(state)

  if (!stateEntry) {
    return res.redirect(`${clientUrl}/admin?google=error`)
  }

  oauthStateStore.delete(state)

  if (Date.now() > stateEntry.expiry) {
    return res.redirect(`${clientUrl}/admin?google=error`)
  }

  try {
    const oauth2Client = buildOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    const { userId } = stateEntry
    const tokenExpiry = new Date(tokens.expiry_date)

    await prisma.googleIntegration.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        tokenExpiry,
        scope: tokens.scope ?? SCOPES.join(' '),
      },
      update: {
        accessToken: tokens.access_token,
        ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
        tokenExpiry,
        scope: tokens.scope ?? SCOPES.join(' '),
      },
    })

    res.redirect(`${clientUrl}/admin?google=connected`)
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    res.redirect(`${clientUrl}/admin?google=error`)
  }
})

export default router
