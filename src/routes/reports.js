import { Router } from 'express'
import { google } from 'googleapis'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import {
  getOAuth2ClientForUser,
  createProjectFolder,
  createSubfolder,
  createDocument,
  formatReportAsHtml,
} from '../services/googleDrive.js'

const router = Router()

const VALID_TYPES = ['daily_dev', 'daily_project', 'sprint', 'demo']

// ─── GET /api/reports ─────────────────────────────────────────────────────────
router.get('/', requireAuth, requireRole('admin', 'ceo'), async (req, res, next) => {
  try {
    const { type, projectId } = req.query

    if (type && !VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}.` })
    }

    const where = {}
    if (type) where.type = type
    if (projectId) where.projectId = projectId

    const reports = await prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        project: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    })

    res.json({ reports })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/reports/export-to-drive ────────────────────────────────────────
router.post(
  '/export-to-drive',
  requireAuth,
  requireRole('admin', 'ceo'),
  async (req, res, next) => {
    try {
      const { reportId } = req.body

      if (!reportId || typeof reportId !== 'string') {
        return res.status(400).json({ error: 'reportId is required.' })
      }

      // Fetch the report with its project
      const report = await prisma.report.findUnique({
        where: { id: reportId },
        include: { project: true },
      })

      if (!report) {
        return res.status(404).json({ error: 'Report not found.' })
      }

      // Verify user has Google Drive connected
      const integration = await prisma.googleIntegration.findUnique({
        where: { userId: req.user.id },
      })

      if (!integration) {
        return res.status(400).json({
          error: 'Google Drive not connected. Visit /admin?tab=connect to connect.',
        })
      }

      // Build authenticated Drive client
      const auth = await getOAuth2ClientForUser(req.user.id)
      const drive = google.drive({ version: 'v3', auth })

      // Get or create the project-level Drive folder
      let projectFolderId
      if (report.projectId) {
        const existing = await prisma.projectDriveFolder.findUnique({
          where: { projectId: report.projectId },
        })

        if (existing) {
          projectFolderId = existing.folderId
        } else {
          const projectName = report.project?.name ?? 'Unknown Project'
          projectFolderId = await createProjectFolder(drive, projectName)

          await prisma.projectDriveFolder.create({
            data: { projectId: report.projectId, folderId: projectFolderId },
          })
        }
      } else {
        // No project — use a generic folder
        projectFolderId = await createProjectFolder(drive, 'Ailurus Reports')
      }

      // Always create a fresh "Reports" subfolder per export (no caching)
      const reportsFolderId = await createSubfolder(drive, projectFolderId, 'Reports')

      // Format HTML content
      const htmlContent = formatReportAsHtml(report.content, report.type)

      // Build document title
      const dateStr = report.createdAt.toISOString().slice(0, 10)
      const projectName = report.project?.name ?? 'Project'
      const title = `Project Health — ${projectName} — ${dateStr}`

      // Create Google Doc
      const webViewLink = await createDocument(drive, reportsFolderId, title, htmlContent)

      // Persist driveUrl on the report
      const updated = await prisma.report.update({
        where: { id: reportId },
        data: { driveUrl: webViewLink },
      })

      res.json({ driveUrl: webViewLink, report: updated })
    } catch (err) {
      if (err.message === 'Google Drive not connected for this user.') {
        return res.status(400).json({ error: err.message })
      }
      next(err)
    }
  }
)

export default router
