import { loginAsUser } from '../helpers/login-as';

const apiUrl = process.env.API_URL || 'http://127.0.0.1:4000';
const batchId = 'batch_branch_mnc_btech_2023';

async function fetchWithAuth(url: string, method: string, token: string, cookie: string, body?: any) {
  const headers: any = {
    'X-AirMentor-CSRF': token,
    'Origin': 'http://127.0.0.1:5173',
    'Cookie': cookie,
  };
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${url} failed with ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function run() {
  console.log('Logging in as system admin...');
  // We need a dummy context to pass to loginAsUser
  let cookieHeader = '';
  const requestContext = {
    post: async (url: string, options: any) => {
      // url might already be absolute if apiPath() was used
      const finalUrl = url.startsWith('http') ? url : `${apiUrl}${url}`;
      const res = await fetch(finalUrl, {
        method: 'POST',
        headers: { ...options.headers, 'Content-Type': 'application/json', 'Cookie': cookieHeader },
        body: JSON.stringify(options.data)
      });
      const setCookies = res.headers.getSetCookie();
      if (setCookies && setCookies.length > 0) {
        cookieHeader = setCookies.map(c => c.split(';')[0]).join('; ');
      }
      return {
        ok: res.ok,
        status: res.status,
        text: () => res.text()
      };
    }
  };

  const { session } = await loginAsUser(requestContext, 'sysadmin', 'admin1234', 'SYSTEM_ADMIN');
  const csrfToken = session.csrfToken;
  console.log('Logged in successfully.');

  // Find the active run
  const dashboard = await fetchWithAuth(`${apiUrl}/api/admin/batches/${batchId}/proof-dashboard`, 'GET', csrfToken, cookieHeader);
  const runId = dashboard.activeRunDetail?.simulationRunId;
  if (!runId) {
    console.error("No active run found.");
    process.exit(1);
  }
  console.log(`Found active run: ${runId}`);

  // Fetch checkpoints
  const chkRes = await fetchWithAuth(`${apiUrl}/api/admin/proof-runs/${encodeURIComponent(runId)}/checkpoints`, 'GET', csrfToken, cookieHeader);
  console.log(`Initial checkpoints: ${chkRes.items?.length}`);

  // Need a wrapper to handle requests that include the cookie
  const makeReq = async (path: string, method: string, body?: any) => {
    const res = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        'X-AirMentor-CSRF': csrfToken,
        'Origin': 'http://127.0.0.1:5173',
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status} - ${text}`);
    return text ? JSON.parse(text) : null;
  };

  for (let sem = 1; sem <= 6; sem++) {
    console.log(`\n--- Activating Semester ${sem} ---`);
    await makeReq(`/api/admin/proof-runs/${encodeURIComponent(runId)}/activate-semester`, 'POST', { semesterNumber: sem });

    for (let stage = 0; stage < 5; stage++) {
      console.log(`  Advancing stage...`);
      await makeReq(`/api/admin/proof-runs/${encodeURIComponent(runId)}/advance`, 'POST', { mode: 'stage' });
    }
  }

  console.log("6 semesters advanced successfully.");
}

run().catch(console.error);
