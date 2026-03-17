import jwt from 'jsonwebtoken'

/**
 * Verifies the JWT from the HTTP-only cookie.
 * Attaches the decoded payload to req.user.
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.token

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' })
  }
}

/**
 * Restricts access to users with a specific role.
 * Must be used after requireAuth.
 * @param {...string} roles - One or more allowed roles.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}.`,
      })
    }

    next()
  }
}
