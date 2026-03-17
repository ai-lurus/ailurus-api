import { google } from 'googleapis'
import prisma from '../lib/prisma.js'

const FIVE_MINUTES_MS = 5 * 60 * 1000

/**
 * Build a base OAuth2 client using env credentials.
 */
function buildOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

/**
 * Returns a configured OAuth2Client for a user, refreshing tokens if needed.
 * @param {string} userId
 * @returns {Promise<import('googleapis').Auth.OAuth2Client>}
 */
export async function getOAuth2ClientForUser(userId) {
  const integration = await prisma.googleIntegration.findUnique({ where: { userId } })

  if (!integration) {
    throw new Error('Google Drive not connected for this user.')
  }

  const oauth2Client = buildOAuth2Client()
  oauth2Client.setCredentials({
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken,
  })

  const isExpiringSoon = integration.tokenExpiry - Date.now() < FIVE_MINUTES_MS

  if (isExpiringSoon) {
    const { credentials } = await oauth2Client.refreshAccessToken()
    const newExpiry = new Date(credentials.expiry_date)

    await prisma.googleIntegration.update({
      where: { userId },
      data: {
        accessToken: credentials.access_token,
        ...(credentials.refresh_token && { refreshToken: credentials.refresh_token }),
        tokenExpiry: newExpiry,
      },
    })

    oauth2Client.setCredentials(credentials)
  }

  return oauth2Client
}

/**
 * Creates a Google Drive folder with the given name.
 * @param {import('googleapis').drive_v3.Drive} drive
 * @param {string} name
 * @returns {Promise<string>} folderId
 */
export async function createProjectFolder(drive, name) {
  const response = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  })

  return response.data.id
}

/**
 * Creates a subfolder inside a parent Drive folder.
 * @param {import('googleapis').drive_v3.Drive} drive
 * @param {string} parentFolderId
 * @param {string} name
 * @returns {Promise<string>} folderId
 */
export async function createSubfolder(drive, parentFolderId, name) {
  const response = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id',
  })

  return response.data.id
}

/**
 * Uploads HTML content as a Google Doc inside the specified folder.
 * Drive auto-converts HTML → Google Doc.
 * @param {import('googleapis').drive_v3.Drive} drive
 * @param {string} folderId
 * @param {string} title
 * @param {string} htmlContent
 * @returns {Promise<string>} webViewLink
 */
export async function createDocument(drive, folderId, title, htmlContent) {
  const response = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: 'application/vnd.google-apps.document',
      parents: [folderId],
    },
    media: {
      mimeType: 'text/html',
      body: htmlContent,
    },
    fields: 'id,webViewLink',
    uploadType: 'multipart',
  })

  return response.data.webViewLink
}

const STATUS_COLORS = {
  on_track: '#22c55e',
  at_risk: '#f59e0b',
  delayed: '#ef4444',
}

const STATUS_LABELS = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  delayed: 'Delayed',
}

/**
 * Converts a report JSON object to styled HTML for Google Docs import.
 * @param {object} content - Report content JSON
 * @param {string} type - Report type (e.g. 'daily_project')
 * @returns {string} HTML string
 */
export function formatReportAsHtml(content, type) {
  if (type === 'daily_project') {
    return formatDailyProjectHtml(content)
  }

  // Fallback: render as preformatted JSON
  return `<!DOCTYPE html><html><body><pre>${JSON.stringify(content, null, 2)}</pre></body></html>`
}

function formatDailyProjectHtml(content) {
  const { status = 'on_track', summary = '', risks = [], recommendations = [], suggested_tickets = [] } = content

  const statusColor = STATUS_COLORS[status] ?? '#6b7280'
  const statusLabel = STATUS_LABELS[status] ?? status

  const riskItems = risks.map(r => `<li style="margin: 6px 0;">${escapeHtml(r)}</li>`).join('')
  const recommendationItems = recommendations
    .map(r => `<li style="margin: 6px 0;">${escapeHtml(r)}</li>`)
    .join('')

  const ticketRows = suggested_tickets
    .map(
      t => `
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 8px 12px;">${escapeHtml(t.title ?? '')}</td>
          <td style="border: 1px solid #e5e7eb; padding: 8px 12px;">${escapeHtml(t.description ?? '')}</td>
          <td style="border: 1px solid #e5e7eb; padding: 8px 12px; text-transform: capitalize;">${escapeHtml(t.category ?? '')}</td>
        </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #111827;">

  <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">Project Health Report</h1>

  <div style="display: inline-block; background: ${statusColor}; color: #fff; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; margin-bottom: 24px;">
    ${statusLabel}
  </div>

  <h2 style="font-size: 18px; font-weight: 600; margin-top: 24px; margin-bottom: 8px;">Summary</h2>
  <p style="line-height: 1.6; margin: 0;">${escapeHtml(summary)}</p>

  <h2 style="font-size: 18px; font-weight: 600; margin-top: 24px; margin-bottom: 8px;">Risks</h2>
  ${riskItems ? `<ol style="padding-left: 20px; margin: 0;">${riskItems}</ol>` : '<p style="color: #6b7280;">No risks identified.</p>'}

  <h2 style="font-size: 18px; font-weight: 600; margin-top: 24px; margin-bottom: 8px;">Recommendations</h2>
  ${recommendationItems ? `<ol style="padding-left: 20px; margin: 0;">${recommendationItems}</ol>` : '<p style="color: #6b7280;">No recommendations.</p>'}

  <h2 style="font-size: 18px; font-weight: 600; margin-top: 24px; margin-bottom: 8px;">Suggested Tickets</h2>
  ${
    ticketRows
      ? `<table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <thead>
      <tr style="background: #f3f4f6;">
        <th style="border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; font-weight: 600;">Title</th>
        <th style="border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; font-weight: 600;">Description</th>
        <th style="border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; font-weight: 600;">Category</th>
      </tr>
    </thead>
    <tbody>${ticketRows}</tbody>
  </table>`
      : '<p style="color: #6b7280;">No suggested tickets.</p>'
  }

</body>
</html>`
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
