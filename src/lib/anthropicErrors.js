/**
 * Returns a user-friendly message for known Anthropic API error conditions.
 * Returns null for unrecognized errors (caller should fall back to generic message).
 */
export function classifyAnthropicError(err) {
  const msg = err?.error?.error?.message ?? err?.message ?? ''
  const status = err?.status

  if (status === 401 || msg.includes('invalid x-api-key')) {
    return { status: 503, message: 'AI service is not configured correctly. Contact your administrator.' }
  }

  if (msg.includes('credit balance is too low') || msg.includes('insufficient_quota')) {
    return { status: 503, message: 'AI service credits are exhausted. Contact your administrator to top up.' }
  }

  if (status === 429 || msg.includes('rate_limit')) {
    return { status: 429, message: 'AI service is temporarily rate limited. Please try again in a moment.' }
  }

  if (status === 529 || msg.includes('overloaded')) {
    return { status: 503, message: 'AI service is currently overloaded. Please try again shortly.' }
  }

  if (err?.name === 'APIConnectionError' || err?.name === 'APITimeoutError') {
    return { status: 503, message: 'Could not reach the AI service. Check your network and try again.' }
  }

  return null
}
