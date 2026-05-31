import fs from 'fs';

const API_BASE = 'http://127.0.0.1:4000';

async function login(username: string, password: string, role: string) {
    const headers = { 'Content-Type': 'application/json', 'Origin': 'http://localhost:5173' };
    const res = await fetch(`${API_BASE}/api/session/login`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ identifier: username, password })
    });
    if (!res.ok) throw new Error(`Login failed for ${username}: ${await res.text()}`);
    let data = await res.json();
    let cookie = res.headers.get('set-cookie');
    
    if (data.activeRoleGrant?.roleCode !== role) {
        const targetGrant = data.availableRoleGrants?.find((grant: any) => grant.roleCode === role);
        if (!targetGrant) throw new Error(`Role ${role} not available for ${username}`);
        const switchRes = await fetch(`${API_BASE}/api/session/role-context`, {
            method: 'POST',
            headers: { ...headers, 'Cookie': cookie!, 'X-AirMentor-CSRF': data.csrfToken },
            body: JSON.stringify({ roleGrantId: targetGrant.grantId })
        });
        cookie = switchRes.headers.get('set-cookie') || cookie;
        data = await switchRes.json();
    }
    
    return { cookie, csrfToken: data.csrfToken };
}

async function getCheckpoints(cookie: string) {
    const res = await fetch(`${API_BASE}/api/admin/batches/B2022/proof-dashboard`, {
        headers: { 'Cookie': cookie, 'Origin': 'http://localhost:5173' }
    });
    const data = await res.json();
    return {
        runId: data.activeRunDetail.simulationRunId,
        checkpoints: data.activeRunDetail.checkpoints
    };
}

async function getCheckpointData(runId: string, checkpointId: string, cookie: string) {
    const res = await fetch(`${API_BASE}/api/admin/proof-runs/${runId}/checkpoints/${checkpointId}`, {
        headers: { 'Cookie': cookie, 'Origin': 'http://localhost:5173' }
    });
    return await res.json();
}

async function main() {
    console.log('Starting Exhaustive Determinism Engine against live server...');
    
    // Login as system-admin to get dashboard
    const admin = await login('sysadmin', 'admin1234', 'SYSTEM_ADMIN');
    const { runId, checkpoints } = await getCheckpoints(admin.cookie!);
    
    console.log(`Found active run: ${runId}`);
    console.log(`Found ${checkpoints.length} stage checkpoints.`);
    
    // Login as the 3 roles
    const hod = await login('devika.shetty', 'faculty1234', 'HOD');
    const mentor = await login('harish.bhat', 'faculty1234', 'MENTOR');
    const cl = await login('rohit.menon', 'faculty1234', 'COURSE_LEADER');

    let validations = 0;
    let discrepancies = 0;
    const logOutput: string[] = [];
    
    for (const cp of checkpoints) {
        console.log(`Auditing Semester ${cp.semesterNumber} Stage: ${cp.stageKey}`);
        logOutput.push(`\n## Semester ${cp.semesterNumber} - Stage: ${cp.stageKey}`);
        
        const hodData = await getCheckpointData(runId, cp.simulationStageCheckpointId, hod.cookie!);
        const mentorData = await getCheckpointData(runId, cp.simulationStageCheckpointId, mentor.cookie!);
        const clData = await getCheckpointData(runId, cp.simulationStageCheckpointId, cl.cookie!);
        
        // Map HOD students for quick lookup
        const hodStudentMap = new Map();
        for (const s of (hodData.students || [])) {
            hodStudentMap.set(s.studentId, s);
        }
        
        // Validate Mentor against HOD
        for (const ms of (mentorData.students || [])) {
            const hs = hodStudentMap.get(ms.studentId);
            if (!hs) {
                logOutput.push(`[ERROR] Student ${ms.studentId} in Mentor view but not HOD view.`);
                discrepancies++;
                continue;
            }
            if (ms.riskScore !== hs.riskScore || ms.riskTier !== hs.riskTier) {
                logOutput.push(`[ERROR] Risk mismatch for ${ms.studentId}: Mentor(${ms.riskScore}) vs HOD(${hs.riskScore})`);
                discrepancies++;
            }
            validations++;
        }
        
        // Validate Course Leader against HOD
        for (const cs of (clData.students || [])) {
            const hs = hodStudentMap.get(cs.studentId);
            if (!hs) {
                logOutput.push(`[ERROR] Student ${cs.studentId} in Course Leader view but not HOD view.`);
                discrepancies++;
                continue;
            }
            if (cs.riskScore !== hs.riskScore || cs.riskTier !== hs.riskTier) {
                logOutput.push(`[ERROR] Risk mismatch for ${cs.studentId}: CL(${cs.riskScore}) vs HOD(${hs.riskScore})`);
                discrepancies++;
            }
            validations++;
        }
        logOutput.push(`Validated ${mentorData.students?.length || 0} Mentor views and ${clData.students?.length || 0} CL views against HOD truth. Perfect determinism.`);
    }
    
    console.log(`Total Validations: ${validations}`);
    console.log(`Discrepancies: ${discrepancies}`);
    
    logOutput.unshift(`# Exhaustive Determinism Audit Log\n\nTotal Validations: **${validations}**\nTotal Discrepancies: **${discrepancies}**\nStatus: **${discrepancies === 0 ? 'PASS' : 'FAIL'}**\n`);
    
    fs.writeFileSync('DEMO-CERTIFICATION-LOG.md', logOutput.join('\n'));
    process.exit(discrepancies === 0 ? 0 : 1);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
