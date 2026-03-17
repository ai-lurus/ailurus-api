import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// ─── GET /api/roadmap/:projectId ──────────────────────────────────────────────
// Returns all sprints (with milestones and task counts) for a project,
// plus standalone milestones not tied to a sprint.
router.get('/:projectId', requireAuth, async (req, res) => {
  const { projectId } = req.params

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, status: true, deadline: true },
  })

  if (!project) {
    return res.status(404).json({ error: 'Project not found.' })
  }

  const sprints = await prisma.sprint.findMany({
    where: { projectId },
    orderBy: { startDate: 'asc' },
    include: {
      milestones: { orderBy: { dueDate: 'asc' } },
      tasks: {
        select: {
          id: true,
          title: true,
          status: true,
          storyPoints: true,
          assignee: { select: { id: true, name: true } },
        },
      },
    },
  })

  // Milestones not linked to any sprint
  const standaloneMilestones = await prisma.roadmapMilestone.findMany({
    where: { projectId, sprintId: null },
    orderBy: { dueDate: 'asc' },
  })

  const goals = await prisma.goal.findMany({
    where: { projectId },
    orderBy: { deadline: 'asc' },
    select: {
      id: true,
      title: true,
      status: true,
      deadline: true,
      _count: { select: { tasks: true } },
    },
  })

  return res.json({
    roadmap: {
      project,
      goals,
      sprints: sprints.map((sprint) => ({
        ...sprint,
        taskCount: sprint.tasks.length,
        completedTaskCount: sprint.tasks.filter((t) => t.status === 'done').length,
        totalStoryPoints: sprint.tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0),
        doneStoryPoints: sprint.tasks
          .filter((t) => t.status === 'done')
          .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0),
      })),
      standaloneMilestones,
    },
  })
})

export default router
