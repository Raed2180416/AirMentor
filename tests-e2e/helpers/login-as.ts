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

async function readJson(response: Response, label: string) {
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}: ${text.slice(0, 800)}`)
  }
  return text ? JSON.parse(text) : null
}

export async function loginWithApiContext(requestContext: { post: Function }, role: keyof typeof SEEDED_ROLE_FIXTURES) {
  const actor = SEEDED_ROLE_FIXTURES[role]
  if (role === 'student') {
    throw new Error('Student login is not provisioned in the seeded backend yet.')
  }

  const loginResponse = await requestContext.post('/api/session/login', {
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
    const switchResponse = await requestContext.post('/api/session/role-context', {
      headers: csrfHeaders(session.csrfToken),
      data: {
        roleGrantId: targetGrant.grantId,
      },
    })
    session = await readJson(switchResponse, `Switch role to ${actor.roleCode}`)
  }

  return { actor, session }
}

export async function loginAs(page: { context: () => { request: { post: Function } } }, role: keyof typeof SEEDED_ROLE_FIXTURES) {
  return loginWithApiContext(page.context().request, role)
}
