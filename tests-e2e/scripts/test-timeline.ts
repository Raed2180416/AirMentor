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
  let cookieHeader = '';
  const requestContext = {
    post: async (url: string, options: any) => {
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

  const dashboard = await fetchWithAuth(`${apiUrl}/api/admin/batches/${batchId}/proof-dashboard`, 'GET', csrfToken, cookieHeader);
  const runId = dashboard.activeRunDetail?.simulationRunId;
  
  const studentId = 'mnc_student_001';
  const timeline = await fetchWithAuth(`${apiUrl}/api/admin/proof-runs/${runId}/students/${studentId}/evidence-timeline`, 'GET', csrfToken, cookieHeader);
  console.log(JSON.stringify(timeline, null, 2));
}

run().catch(console.error);
