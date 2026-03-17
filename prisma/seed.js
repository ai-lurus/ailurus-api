import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Users
  const sharedPassword = await bcrypt.hash('password', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@ai-lurus.com' },
    update: { passwordHash: sharedPassword },
    create: {
      name: 'Admin User',
      email: 'admin@ai-lurus.com',
      passwordHash: sharedPassword,
      role: 'admin',
    },
  })

  const developer = await prisma.user.upsert({
    where: { email: 'dev@ai-lurus.com' },
    update: { passwordHash: sharedPassword },
    create: {
      name: 'Jane Developer',
      email: 'dev@ai-lurus.com',
      passwordHash: sharedPassword,
      role: 'developer',
    },
  })

  console.log(`✅ Users created: ${admin.email}, ${developer.email}`)

  // Developer profile
  await prisma.developerProfile.upsert({
    where: { userId: developer.id },
    update: {},
    create: {
      userId: developer.id,
      skills: ['React', 'Node.js', 'PostgreSQL', 'TypeScript'],
      weeklyCapacityHrs: 40,
      bio: 'Full-stack developer with 3 years of experience.',
    },
  })

  console.log(`✅ Developer profile created`)

  // Project
  const project = await prisma.project.upsert({
    where: { id: 'seed-project-001' },
    update: {},
    create: {
      id: 'seed-project-001',
      name: 'Ailurus Platform MVP',
      description: 'AI-powered project management platform for software teams.',
      type: 'internal',
      status: 'on_track',
      budget: 50000,
      deadline: new Date('2026-06-30'),
      clientName: null,
    },
  })

  console.log(`✅ Project created: ${project.name}`)

  // Team
  const team = await prisma.team.create({
    data: {
      name: 'Core Team',
      projectId: project.id,
    },
  })

  await prisma.teamMember.createMany({
    data: [
      { teamId: team.id, userId: admin.id },
      { teamId: team.id, userId: developer.id },
    ],
    skipDuplicates: true,
  })

  console.log(`✅ Team created with 2 members`)

  // Goal
  const goal = await prisma.goal.create({
    data: {
      projectId: project.id,
      title: 'Launch MVP',
      description: 'Deliver core modules: auth, task management, and AI agents.',
      deadline: new Date('2026-06-01'),
      status: 'in_progress',
    },
  })

  // Sprint
  const sprint = await prisma.sprint.create({
    data: {
      projectId: project.id,
      name: 'Sprint 1 — Foundation',
      startDate: new Date('2026-03-03'),
      endDate: new Date('2026-03-17'),
      status: 'active',
    },
  })

  // Milestone
  await prisma.roadmapMilestone.create({
    data: {
      projectId: project.id,
      sprintId: sprint.id,
      title: 'Auth & DB ready',
      dueDate: new Date('2026-03-17'),
      status: 'pending',
    },
  })

  // Tasks
  await prisma.task.createMany({
    data: [
      {
        projectId: project.id,
        sprintId: sprint.id,
        goalId: goal.id,
        assignedTo: developer.id,
        title: 'Implement JWT auth endpoints',
        description: 'Register, login, and /me routes with HTTP-only cookie.',
        category: 'engineering',
        status: 'backlog',
        storyPoints: 5,
        estimatedHrs: 4,
      },
      {
        projectId: project.id,
        sprintId: sprint.id,
        goalId: goal.id,
        assignedTo: developer.id,
        title: 'Set up RBAC middleware',
        description: 'requireRole middleware for ceo, admin, developer, client.',
        category: 'engineering',
        status: 'backlog',
        storyPoints: 3,
        estimatedHrs: 2,
      },
      {
        projectId: project.id,
        sprintId: sprint.id,
        goalId: goal.id,
        assignedTo: null,
        title: 'Provision production database',
        description: 'Set up Supabase or Neon PostgreSQL instance.',
        category: 'engineering',
        status: 'backlog',
        storyPoints: 2,
        estimatedHrs: 1,
      },
    ],
  })

  console.log(`✅ Sprint, milestone, and 3 tasks created`)
  console.log('\n🎉 Seed complete!')
  console.log('\nCredentials:')
  console.log('  Admin:     admin@ai-lurus.com / password')
  console.log('  Developer: dev@ai-lurus.com   / password')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
