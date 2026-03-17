import { Router } from 'express'
import prisma from '../lib/prisma.js'
import anthropic from '../lib/anthropic.js'
import { getSession, setSession } from '../lib/sessionStore.js'
import { fetchProjectContext, callHealthAgent } from '../lib/projectHealthAgent.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { classifyAnthropicError } from '../lib/anthropicErrors.js'

const router = Router()

// ─── Context loader ───────────────────────────────────────────────────────────
// Fetches and caches the developer's daily context (user info, check-in, tasks).
// Cached per userId per day so repeated chat turns don't re-hit the DB.

async function loadContext(userId) {
  const cached = getSession(userId)
  if (cached) return cached

  const today = new Date().toISOString().slice(0, 10)
  const todayUtc = new Date(today + 'T00:00:00.000Z')

  const [user, dailyStatus, tasks] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    }),

    prisma.dailyStatus.findUnique({
      where: { userId_date: { userId, date: todayUtc } },
    }),

    prisma.task.findMany({
      where: {
        assignedTo: userId,
        status: { in: ['backlog', 'in_progress'] },
      },
      orderBy: [{ status: 'asc' }, { storyPoints: 'desc' }],
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        storyPoints: true,
        estimatedHrs: true,
        sprint: { select: { name: true } },
        goal: { select: { title: true } },
      },
    }),
  ])

  const context = { user, dailyStatus, tasks }
  setSession(userId, context)
  return context
}

// ─── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt({ user, dailyStatus, tasks }) {
  const name = user?.name ?? 'the developer'

  const moodLine = dailyStatus
    ? `Mood: ${dailyStatus.mood}`
    : 'No check-in submitted yet today.'

  const availLine = dailyStatus?.availableHrs
    ? `Available hours: ${dailyStatus.availableHrs}h`
    : 'Availability: unknown'

  const appointmentsLine = dailyStatus?.appointments
    ? `Appointments/commitments: ${dailyStatus.appointments}`
    : 'Appointments: none'

  const blockersLine = dailyStatus?.blockers
    ? `Blockers from yesterday: ${dailyStatus.blockers}`
    : 'Blockers: none'

  const totalEstHrs = tasks.reduce((sum, t) => sum + (Number(t.estimatedHrs) ?? 0), 0)
  const availHrs = dailyStatus?.availableHrs ? Number(dailyStatus.availableHrs) : null

  const taskLines = tasks.length === 0
    ? '  (no open tasks assigned)'
    : tasks.map((t, i) => {
        const pts  = t.storyPoints != null ? ` | ${t.storyPoints} SP` : ''
        const hrs  = t.estimatedHrs != null ? ` | ~${Number(t.estimatedHrs)}h` : ''
        const sprint = t.sprint ? ` [${t.sprint.name}]` : ''
        const status = t.status === 'in_progress' ? ' 🔵 In Progress' : ' ⬜ Backlog'
        return `  ${i + 1}. ${t.title} (${t.category})${pts}${hrs}${sprint}${status}`
      }).join('\n')

  const overloadWarning = availHrs && totalEstHrs > availHrs
    ? `\n⚠️  Total estimated task hours (${totalEstHrs}h) EXCEED available hours (${availHrs}h). Help ${name} prioritize ruthlessly.`
    : ''

  return `You are a warm, practical daily assistant for a software developer named ${name}.
Your job is to help them start their workday with clarity, a realistic plan, and confidence.

── Today's context ──────────────────────────────────────
${moodLine}
${availLine}
${appointmentsLine}
${blockersLine}

── Assigned tasks ───────────────────────────────────────
${taskLines}

Total estimated: ${totalEstHrs}h${overloadWarning}
─────────────────────────────────────────────────────────

Guidelines:
- Greet ${name} by first name, warmly but briefly.
- Acknowledge their mood. If they're struggling, be gentler; skip the "great day ahead!" energy.
- If there are blockers, acknowledge them first and ask if they've been resolved.
- Walk through the tasks and propose a simple time-blocked schedule that fits within ${availHrs ?? 'their available'}h.
- If tasks exceed availability, flag this clearly and help them pick what to defer or cut.
- Mention any commitments/appointments in the schedule so tasks don't conflict.
- Close your first message by asking if they have any questions or need to talk through a blocker.
- In follow-up turns: answer questions concisely, help them think through problems, stay encouraging.
- Keep responses focused and scannable. Use bullet points for schedules or task lists.
- Never be sycophantic. Don't repeat yourself across turns.
- If the developer asks you to create, generate, or build a learning or career plan, respond with your plan description AND append a machine-readable block at the very end in this exact format (no prose after it):
[LEARNING_PLAN]{"title":"...","careerPath":"...","description":"...","topics":[{"title":"...","description":"...","resourceType":"article|video|course|practice","orderIndex":0}]}[/LEARNING_PLAN]
Include 5-8 specific, actionable topics ordered from foundational to advanced. The JSON must be valid.`
}

// ─── POST /api/agents/morning-checkin ────────────────────────────────────────
// Streams Claude's response as SSE: `data: {"text":"..."}` chunks, then `data: [DONE]`.

router.post(
  '/morning-checkin',
  requireAuth,
  requireRole('developer', 'admin', 'ceo'),
  async (req, res) => {
    const userId = req.user.id

    // messages is the full conversation history from the client.
    // Each item: { role: 'user' | 'assistant', content: string }
    const { messages } = req.body

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required.' })
    }

    // ── Load context (cached after first turn) ────────────────────────────
    const context = await loadContext(userId)

    if (!context.user) {
      return res.status(404).json({ error: 'User not found.' })
    }

    // ── Prepare messages for Claude ───────────────────────────────────────
    // Claude requires messages to start with role=user and strictly alternate.
    // Drop any leading assistant messages (the local greeting generated on the client).
    const firstUserIdx = messages.findIndex((m) => m.role === 'user')
    if (firstUserIdx === -1) {
      return res.status(400).json({ error: 'No user message found in messages array.' })
    }

    const claudeMessages = messages.slice(firstUserIdx).map((m) => ({
      role: m.role,
      content: String(m.content),
    }))

    // ── Set up SSE ────────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    const systemPrompt = buildSystemPrompt(context)

    // Guard against res.end() being called twice (once from stream 'error', once from catch)
    let streamEnded = false
    const endStream = (errorMsg) => {
      if (streamEnded) return
      streamEnded = true
      if (errorMsg) res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    }

    try {
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: claudeMessages,
      })

      stream.on('text', (text) => {
        res.write(`data: ${JSON.stringify({ text })}\n\n`)
      })

      stream.on('error', (err) => {
        console.error('[morning-checkin] stream error:', err)
        const classified = classifyAnthropicError(err)
        endStream(classified?.message ?? 'AI service error. Please try again.')
      })

      await stream.finalMessage()
      endStream(null)
    } catch (err) {
      console.error('[morning-checkin] error:', err)
      const classified = classifyAnthropicError(err)
      const message = classified?.message ?? 'Agent failed to respond.'
      if (res.headersSent) {
        endStream(message)
      } else {
        res.status(classified?.status ?? 500).json({ error: message })
      }
    }
  }
)

// ─── POST /api/agents/project-health ─────────────────────────────────────────
// Fetches project context, calls Claude for a structured health report,
// updates the project status, saves to reports, and returns the full report.

router.post(
  '/project-health',
  requireAuth,
  requireRole('admin', 'ceo'),
  async (req, res, next) => {
    const { projectId } = req.body

    if (!projectId || typeof projectId !== 'string') {
      return res.status(400).json({ error: 'projectId is required.' })
    }

    try {
      const context = await fetchProjectContext(projectId)

      if (!context.project) {
        return res.status(404).json({ error: 'Project not found.' })
      }

      const report = await callHealthAgent(context)

      // Persist: update project status + save report record in parallel
      await Promise.all([
        prisma.project.update({
          where: { id: projectId },
          data: { status: report.status },
        }),
        prisma.report.create({
          data: {
            type: 'daily_project',
            projectId,
            userId: req.user.id,
            content: report,
          },
        }),
      ])

      res.json({ report })
    } catch (err) {
      next(err)
    }
  }
)

// ─── POST /api/agents/generate-learning-plan ─────────────────────────────────
// Generates a structured learning plan via Claude and persists it to the DB.
// Body: { userId, goalsDescription }

router.post(
  '/generate-learning-plan',
  requireAuth,
  requireRole('developer', 'admin', 'ceo'),
  async (req, res, next) => {
    const { userId, goalsDescription } = req.body

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId is required.' })
    }
    if (!goalsDescription || typeof goalsDescription !== 'string' || !goalsDescription.trim()) {
      return res.status(400).json({ error: 'goalsDescription is required.' })
    }

    // Developers can only generate plans for themselves
    if (req.user.role === 'developer' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Access denied.' })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    })
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' })
    }

    const systemPrompt = `You are a senior engineering mentor creating personalized career growth plans for developers.
Given the developer's goals and current situation, respond ONLY with a valid JSON object — no prose, no markdown fences — matching this exact structure:
{
  "title": "string (concise plan name)",
  "careerPath": "string (e.g. 'Senior Frontend Engineer', 'Full Stack Developer')",
  "description": "string (2-3 sentence overview)",
  "topics": [
    {
      "title": "string",
      "description": "string",
      "resourceType": "video|article|course|practice",
      "orderIndex": 0
    }
  ]
}
Include 5-8 topics ordered from foundational to advanced. Be specific and actionable.`

    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Developer name: ${targetUser.name}\nGoals: ${goalsDescription.trim()}`,
          },
        ],
      })

      const rawText = message.content[0]?.text ?? ''

      let plan
      try {
        plan = JSON.parse(rawText)
      } catch {
        // Try to extract JSON from the response if there's any surrounding text
        const match = rawText.match(/\{[\s\S]*\}/)
        if (!match) {
          return res.status(500).json({ error: 'AI returned an invalid plan format.' })
        }
        plan = JSON.parse(match[0])
      }

      // Validate required fields
      if (!plan.title || !Array.isArray(plan.topics)) {
        return res.status(500).json({ error: 'AI returned an incomplete plan.' })
      }

      const VALID_RESOURCE_TYPES = ['video', 'article', 'course', 'practice']

      const path = await prisma.trainingPath.create({
        data: {
          userId,
          title:        plan.title,
          skill:        plan.title,
          careerPath:   plan.careerPath || null,
          description:  plan.description || null,
          generatedByAI: true,
          topics: {
            create: plan.topics.map((t, idx) => ({
              title:        t.title,
              description:  t.description || null,
              resourceType: VALID_RESOURCE_TYPES.includes(t.resourceType) ? t.resourceType : 'article',
              orderIndex:   t.orderIndex ?? idx,
            })),
          },
        },
        include: {
          topics: { orderBy: { orderIndex: 'asc' } },
        },
      })

      return res.json({ path })
    } catch (err) {
      next(err)
    }
  }
)

export default router
