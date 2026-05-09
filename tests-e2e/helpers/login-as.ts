import { apiPath } from './api-url'

const SEEDED_ROLE_FIXTURES = {
  'system-admin': {
    identifier: 'sysadmin',
    password: 'admin1234',
    roleCode: 'SYSTEM_ADMIN',
    facultyId: 'fac_sysadmin',
  },
  // Proof-faculty identifiers align with the seeded PROOF_FACULTY cohort used by the
  // MSRUAS proof control plane (`mnc_t1`, `mnc_t2`, `mnc_t8`, ...).
  hod: {
    identifier: 'devika.shetty',
    password: 'faculty1234',
    roleCode: 'HOD',
    facultyId: 'mnc_t1',
  },
  'course-leader': {
    identifier: 'rohit.menon',
    password: 'faculty1234',
    roleCode: 'COURSE_LEADER',
    facultyId: 'mnc_t2',
  },
  mentor: {
    identifier: 'harish.bhat',
    password: 'faculty1234',
    roleCode: 'MENTOR',
    facultyId: 'mnc_t8',
  },
  student: {
    identifier: '',
    password: '',
    roleCode: 'STUDENT',
    facultyId: '',
  },
} as const

function csrfHeaders(csrfToken: string) {
  return {
    'X-AirMentor-CSRF': csrfToken,
  }
}

type AnyHttpResponse = {
  text(): Promise<string>
  ok: boolean | (() => boolean)
  status: number | (() => number)
}

async function readJson(response: AnyHttpResponse, label: string) {
  const text = await response.text()
  // Playwright APIResponse exposes ok()/status() as methods, while the
  // DOM Response exposes them as properties. Accept both shapes so the
  // helper can be reused from browser-page contexts too.
  const okValue = typeof response.ok === 'function' ? response.ok() : response.ok
  const statusValue = typeof response.status === 'function' ? response.status() : response.status
  if (!okValue) {
    throw new Error(`${label} failed with ${statusValue}: ${String(text).slice(0, 800)}`)
  }
  return text ? JSON.parse(text) : null
}

export async function loginWithApiContext(requestContext: { post(url: string, options?: Record<string, unknown>): Promise<AnyHttpResponse> }, role: keyof typeof SEEDED_ROLE_FIXTURES) {
  const actor = SEEDED_ROLE_FIXTURES[role]
  if (role === 'student') {
    throw new Error('Student login is not provisioned in the seeded backend yet.')
  }

  const loginResponse = await requestContext.post(apiPath('/api/session/login'), {
    data: {
      identifier: actor.identifier,
      password: actor.password,
    },
  })
  let session = await readJson(loginResponse, `Login as ${role}`)

  if (session.activeRoleGrant?.roleCode !== actor.roleCode) {
    const targetGrant = session.availableRoleGrants?.find((grant: { roleCode: string; facultyId: string }) =>
      grant.roleCode === actor.roleCode && grant.facultyId === actor.facultyId,
    )
    if (!targetGrant) {
      throw new Error(`Role ${actor.roleCode} is not available for seeded actor ${actor.identifier}.`)
    }
    const switchResponse = await requestContext.post(apiPath('/api/session/role-context'), {
      headers: csrfHeaders(session.csrfToken),
      data: {
        roleGrantId: targetGrant.grantId,
      },
    })
    session = await readJson(switchResponse, `Switch role to ${actor.roleCode}`)
  }

  return { actor, session }
}

export async function loginAs(
  page: {
    context: () => { request: { post(url: string, options?: Record<string, unknown>): Promise<AnyHttpResponse> } }
    reload?: (opts?: { waitUntil?: string }) => Promise<unknown>
    url?: () => string
  },
  role: keyof typeof SEEDED_ROLE_FIXTURES,
) {
  const result = await loginWithApiContext(page.context().request, role)
  // After the API-level login we have the session cookie + CSRF token sitting
  // in the browser-context cookie jar. The React app, however, only
  // re-evaluates its authentication state when it (re)mounts its root —
  // navigating to the same hash route does NOT remount. So we force a full
  // page reload here. Specs that never left the portal can skip this by
  // calling loginWithApiContext directly.
  if (typeof page.reload === 'function' && typeof page.url === 'function') {
    const currentUrl = page.url()
    if (currentUrl && !currentUrl.startsWith('about:')) {
      // waitUntil: 'domcontentloaded' — a full `networkidle` reload used to
      // time out because the UI's health-check retry loop keeps firing
      // background requests during the 'Server Not Running' banner
      // sequence, so the page never hits 500 ms of network silence.
      // domcontentloaded is sufficient to guarantee the React root
      // remounted with the new session cookie in scope; specs then wait on
      // concrete role-gated surface markers (e.g. hod-proof-analytics).
      await page.reload({ waitUntil: 'domcontentloaded' })
    }
  }
  return result
}
