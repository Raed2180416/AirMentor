const API = 'http://127.0.0.1:35027'
const ORIGIN = 'http://127.0.0.1:5173'

class Jar {
  cookies = new Map<string, string>()
  store(headers: Headers) {
    const arr = (headers as any).getSetCookie?.() ?? []
    for (const raw of arr) {
      const m = raw.split(';')[0]?.trim()
      if (!m) continue
      const i = m.indexOf('=')
      if (i > 0) this.cookies.set(m.slice(0, i).trim(), m.slice(i + 1).trim())
    }
  }
  header(): string {
    return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ')
  }
}

async function probe(identifier: string, password: string) {
  const jar = new Jar()
  const loginRes = await fetch(`${API}/api/session/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ identifier, password }),
  })
  jar.store(loginRes.headers)
  const session = await loginRes.json()

  const grant = session.availableRoleGrants?.find((g: any) => g.roleCode === 'COURSE_LEADER')
  if (!grant) {
    console.log(`${identifier}: no CL grant`)
    return
  }

  const switchRes = await fetch(`${API}/api/session/role-context`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      'X-AirMentor-CSRF': session.csrfToken,
      Cookie: jar.header(),
    },
    body: JSON.stringify({ roleGrantId: grant.grantId }),
  })
  jar.store(switchRes.headers)
  const switched = await switchRes.json()

  const bsRes = await fetch(`${API}/api/academic/bootstrap`, {
    headers: {
      Origin: ORIGIN,
      'X-AirMentor-CSRF': switched.csrfToken,
      Cookie: jar.header(),
    },
  })
  const data = await bsRes.json()
  console.log(`${identifier} bootstrap keys:`, Object.keys(data))
  if (data.code) console.log(`${identifier} error:`, data)
  else console.log(`${identifier} offerings:`, data.offerings?.length ?? 0)
}

async function main() {
  await probe('rohit.menon', 'faculty1234')
}

main().catch(console.error)

export {}
