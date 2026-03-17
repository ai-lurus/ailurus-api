import './lib/env.js'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

import { classifyAnthropicError } from './lib/anthropicErrors.js'
import authRouter from './routes/auth.js'
import projectsRouter from './routes/projects.js'
import tasksRouter from './routes/tasks.js'
import sprintsRouter from './routes/sprints.js'
import roadmapRouter from './routes/roadmap.js'
import dailyStatusRouter from './routes/dailyStatus.js'
import agentsRouter from './routes/agents.js'
import usersRouter from './routes/users.js'
import teamsRouter from './routes/teams.js'
import reportsRouter from './routes/reports.js'
import goalsRouter from './routes/goals.js'
import integrationsRouter from './routes/integrations.js'
import learningRouter from './routes/learning.js'
import battlesRouter from './routes/battles.js'
import oneOnOnesRouter from './routes/oneOnOnes.js'
import performanceReviewsRouter from './routes/performanceReviews.js'

const app = express()
const PORT = process.env.PORT || 4000
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000'

app.use(cors({ origin: CLIENT_URL, credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.use('/public', express.static(path.join(__dirname, '../public')))
app.use((req, _res, next) => {
  console.log(`→ ${req.method} ${req.path}`)
  next()
})

// Routes
app.use('/api/auth', authRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/sprints', sprintsRouter)
app.use('/api/roadmap', roadmapRouter)
app.use('/api/daily-status', dailyStatusRouter)
app.use('/api/agents', agentsRouter)
app.use('/api/users', usersRouter)
app.use('/api/teams', teamsRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/goals', goalsRouter)
app.use('/api/integrations', integrationsRouter)
app.use('/api/learning', learningRouter)
app.use('/api/battles', battlesRouter)
app.use('/api/one-on-ones', oneOnOnesRouter)
app.use('/api/performance-reviews', performanceReviewsRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Global error handler — must be last
app.use((err, _req, res, _next) => {
  const isDev = process.env.NODE_ENV !== 'production'

  // Anthropic API errors (credits, auth, rate limit, etc.)
  const anthropicClassified = classifyAnthropicError(err)
  if (anthropicClassified) {
    console.error('[anthropic]', err.message)
    return res.status(anthropicClassified.status).json({ error: anthropicClassified.message })
  }

  // Prisma known errors (client validation, not found, etc.)
  if (err.code?.startsWith('P')) {
    console.error('[prisma]', err.code, err.message)
    return res.status(400).json({ error: 'Database operation failed.', ...(isDev && { detail: err.message }) })
  }

  console.error(err)
  res.status(500).json({ error: 'Internal server error.', ...(isDev && { detail: err.message }) })
})

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
}

export default app
