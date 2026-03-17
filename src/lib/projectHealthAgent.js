import prisma from './prisma.js'
import anthropic from './anthropic.js'

// ── Context fetcher ────────────────────────────────────────────────────────────
// Fetches project details, active sprint tasks, last 3 sprint velocities,
// and team member blockers from the last 7 days.

export async function fetchProjectContext(projectId) {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoUtc = new Date(sevenDaysAgo.toISOString().slice(0, 10) + 'T00:00:00.000Z')

  const [project, completedSprints, recentBlockers] = await Promise.all([
    // Project + teams + active sprint tasks
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        sprints: {
          where: { status: 'active' },
          take: 1,
          include: {
            tasks: {
              select: {
                id: true,
                title: true,
                category: true,
                status: true,
                storyPoints: true,
                estimatedHrs: true,
              },
            },
          },
        },
        teams: {
          include: {
            teamMembers: {
              select: { userId: true },
            },
          },
        },
      },
    }),

    // Last 3 completed sprints for velocity calculation
    prisma.sprint.findMany({
      where: { projectId, status: 'completed' },
      orderBy: { endDate: 'desc' },
      take: 3,
      select: {
        name: true,
        startDate: true,
        endDate: true,
        tasks: {
          where: { status: 'done' },
          select: { storyPoints: true },
        },
      },
    }),

    // Blockers reported by team members in the last 7 days
    prisma.dailyStatus.findMany({
      where: {
        date: { gte: sevenDaysAgoUtc },
        blockers: { not: null },
        user: {
          teamMembers: {
            some: {
              team: { projectId },
            },
          },
        },
      },
      select: {
        date: true,
        blockers: true,
        mood: true,
        user: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    }),
  ])

  return { project, completedSprints, recentBlockers }
}

// ── System prompt builder ──────────────────────────────────────────────────────

function buildHealthPrompt({ project, completedSprints, recentBlockers }) {
  const today = new Date()

  // Project metadata
  const deadlineStr = project.deadline
    ? project.deadline.toISOString().slice(0, 10)
    : 'No deadline set'

  const budgetStr = project.budget
    ? `$${Number(project.budget).toLocaleString()}`
    : 'No budget set'

  // Timeline burn rate
  let timelineBurnStr = 'N/A (no deadline)'
  if (project.deadline && project.createdAt) {
    const totalMs = project.deadline.getTime() - project.createdAt.getTime()
    const elapsedMs = today.getTime() - project.createdAt.getTime()
    const burnPct = Math.min(100, Math.round((elapsedMs / totalMs) * 100))
    const daysLeft = Math.round((project.deadline.getTime() - today.getTime()) / 86400000)
    if (daysLeft < 0) {
      timelineBurnStr = `⚠️ Deadline passed ${Math.abs(daysLeft)} days ago`
    } else {
      timelineBurnStr = `${burnPct}% of timeline elapsed — ${daysLeft} days remaining`
    }
  }

  // Active sprint summary
  const activeSprint = project.sprints[0] ?? null
  let sprintSection = 'No active sprint.'

  if (activeSprint) {
    const tasks = activeSprint.tasks
    const counts = { done: 0, in_progress: 0, backlog: 0, blocked: 0 }
    let totalSP = 0
    let doneSP = 0

    for (const t of tasks) {
      counts[t.status] = (counts[t.status] ?? 0) + 1
      const sp = t.storyPoints ?? 0
      totalSP += sp
      if (t.status === 'done') doneSP += sp
    }

    const progressPct = totalSP > 0 ? Math.round((doneSP / totalSP) * 100) : 0
    const sprintEndStr = activeSprint.endDate.toISOString().slice(0, 10)
    const daysLeft = Math.round((activeSprint.endDate.getTime() - today.getTime()) / 86400000)
    const daysLeftLabel = daysLeft < 0
      ? `${Math.abs(daysLeft)} days overrun`
      : `${daysLeft} days remaining`

    sprintSection = `Sprint: ${activeSprint.name} (ends ${sprintEndStr}, ${daysLeftLabel})
Tasks: ${tasks.length} total — ${counts.done} done, ${counts.in_progress} in progress, ${counts.backlog} backlog, ${counts.blocked} blocked
Story points: ${doneSP}/${totalSP} completed (${progressPct}%)`
  }

  // Velocity from completed sprints
  const velocitySection = completedSprints.length === 0
    ? 'No completed sprints — velocity data unavailable.'
    : completedSprints.map((s) => {
        const sp = s.tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
        return `  ${s.name}: ${sp} SP completed`
      }).join('\n')

  // Recent team blockers
  const blockerSection = recentBlockers.length === 0
    ? 'No blockers reported in the last 7 days.'
    : recentBlockers.map((s) => {
        const dateStr = s.date.toISOString().slice(0, 10)
        return `  ${s.user.name} (${dateStr}): ${s.blockers}`
      }).join('\n')

  return `You are a senior project analyst assessing the health of a software development project.

── Project Overview ──────────────────────────────────────
Name: ${project.name}
Type: ${project.type}
Current status in system: ${project.status}
Client: ${project.clientName ?? 'Internal'}
Budget: ${budgetStr}
Deadline: ${deadlineStr}
Timeline burn: ${timelineBurnStr}${project.description ? `\nDescription: ${project.description}` : ''}

── Active Sprint ──────────────────────────────────────────
${sprintSection}

── Team Velocity (last ${completedSprints.length} completed sprint${completedSprints.length !== 1 ? 's' : ''}) ──────────────
${velocitySection}

── Recent Blockers (last 7 days) ─────────────────────────
${blockerSection}
──────────────────────────────────────────────────────────

Analyze the data above and call generate_health_report to produce a structured health assessment.

Consider:
- Sprint progress relative to how much time is left in the sprint
- Timeline burn rate vs overall task completion
- Whether velocity is consistent, improving, or declining across sprints
- Frequency and severity of blockers and whether they are recurring
- Whether the project is at risk of missing its deadline given current pace

Be concise, direct, and data-driven. Only suggest new tickets if they address a genuine gap.`
}

// ── Claude tool call ───────────────────────────────────────────────────────────

const HEALTH_REPORT_TOOL = {
  name: 'generate_health_report',
  description: 'Generate a structured project health report based on the provided sprint and team data.',
  input_schema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['on_track', 'at_risk', 'delayed'],
        description: 'Overall project health assessment.',
      },
      summary: {
        type: 'string',
        description: 'A 2-3 sentence executive summary of current project health.',
      },
      risks: {
        type: 'array',
        items: { type: 'string' },
        description: 'Identified risks and concerns (max 5 items).',
      },
      recommendations: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific, actionable recommendations for the team (max 4 items).',
      },
      suggested_tickets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            category: {
              type: 'string',
              enum: ['engineering', 'design', 'marketing', 'other'],
            },
          },
          required: ['title', 'description', 'category'],
        },
        description: 'New tasks to address identified risks or gaps (0-3 items).',
      },
    },
    required: ['status', 'summary', 'risks', 'recommendations', 'suggested_tickets'],
  },
}

export async function callHealthAgent(context) {
  const systemPrompt = buildHealthPrompt(context)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      { role: 'user', content: 'Please analyze the project data and generate the health report.' },
    ],
    tools: [HEALTH_REPORT_TOOL],
    tool_choice: { type: 'tool', name: 'generate_health_report' },
  })

  const toolUse = response.content.find((c) => c.type === 'tool_use')
  if (!toolUse) {
    throw new Error('Agent did not return a structured health report.')
  }

  return toolUse.input
}
