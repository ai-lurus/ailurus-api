import prisma from '../lib/prisma.js'

export async function createNotification(userId, { type, title, description, link }) {
  return prisma.notification.create({
    data: { userId, type, title, description: description || null, link: link || null },
  })
}

export async function notifyTaskAssigned(task, actorName) {
  if (!task.assignedTo) return
  return createNotification(task.assignedTo, {
    type: 'tarea',
    title: 'Nueva tarea asignada',
    description: `${actorName} te asignó "${task.title}"`,
    link: '/admin/board',
  })
}

export async function notifyTaskInReview(task, actorName) {
  if (!task.assignedTo || task.assignedTo === task.reviewedBy) return
  return createNotification(task.assignedTo, {
    type: 'mencion',
    title: 'Tu tarea fue enviada a revisión',
    description: `"${task.title}" está lista para revisión`,
    link: '/admin/board',
  })
}

export async function notifyTaskDone(task, actorName) {
  if (!task.assignedTo) return
  return createNotification(task.assignedTo, {
    type: 'tarea',
    title: 'Tarea aprobada',
    description: `${actorName} aprobó "${task.title}"`,
    link: '/admin/board',
  })
}

export async function notifyCommentAdded(task, authorName) {
  if (!task.assignedTo) return
  return createNotification(task.assignedTo, {
    type: 'mencion',
    title: 'Nuevo comentario en tu tarea',
    description: `${authorName} comentó en "${task.title}"`,
    link: '/admin/board',
  })
}

export async function notifyMentioned(task, comment, authorName, mentionedUserIds) {
  if (!mentionedUserIds?.length) return
  return Promise.all(
    mentionedUserIds.map((userId) =>
      createNotification(userId, {
        type: 'mencion',
        title: `${authorName} te mencionó`,
        description: `En "${task.title}": ${comment.body.slice(0, 80)}${comment.body.length > 80 ? '…' : ''}`,
        link: '/admin/board',
      })
    )
  )
}

export async function notifySprintActivated(sprint, teamUserIds) {
  if (!teamUserIds?.length) return
  return Promise.all(
    teamUserIds.map((userId) =>
      createNotification(userId, {
        type: 'sistema',
        title: 'Sprint iniciado',
        description: `"${sprint.name}" fue marcado como activo`,
        link: '/admin/sprints',
      })
    )
  )
}
