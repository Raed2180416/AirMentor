function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function describeFailure(error) {
  if (error instanceof Error) {
    const causeCode = typeof error.cause === 'object' && error.cause && 'code' in error.cause
      ? error.cause.code
      : null
    return causeCode ? `${error.message} (${causeCode})` : error.message
  }
  return String(error)
}

async function fetchWithTimeout(url, init, timeoutMs, fetchImpl) {
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutHandle)
  }
}

export async function resolveTeachingPasswordViaSession({
  appUrl,
  apiUrl,
  username,
  candidates,
  attempts = 3,
  requestTimeoutMs = 20_000,
  retryDelayMs = 1_500,
  fetchImpl = fetch,
  logPrefix = 'teaching-password',
}) {
  const sessionUrl = new URL('/api/session/login', apiUrl)
  const origin = new URL(appUrl).origin
  let lastRetryableFailure = null
  let sawCredentialRejection = false

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let shouldRetry = false
    for (const password of candidates) {
      let response
      try {
        response = await fetchWithTimeout(sessionUrl, {
          method: 'POST',
          headers: {
            origin,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ identifier: username, password }),
        }, requestTimeoutMs, fetchImpl)
      } catch (error) {
        lastRetryableFailure = error
        shouldRetry = true
        break
      }

      if (response.ok) return password

      if (response.status === 401 || response.status === 403) {
        sawCredentialRejection = true
        continue
      }

      const responseBody = await response.text().catch(() => '')
      lastRetryableFailure = new Error(
        `session login probe returned ${response.status}${responseBody ? `: ${responseBody.slice(0, 200)}` : ''}`,
      )
      shouldRetry = true
      break
    }

    if (!shouldRetry) break
    if (attempt >= attempts) break
    console.warn(`[${logPrefix}] retrying password probe for ${username} after attempt ${attempt}/${attempts}: ${describeFailure(lastRetryableFailure)}`)
    await delay(retryDelayMs * attempt)
  }

  if (lastRetryableFailure) {
    throw new Error(`Could not resolve a working teaching password for ${username}: ${describeFailure(lastRetryableFailure)}`)
  }
  if (sawCredentialRejection) {
    throw new Error(`Could not resolve a working teaching password for ${username}`)
  }
  throw new Error(`Could not resolve a working teaching password for ${username}: no password candidates were accepted`)
}
