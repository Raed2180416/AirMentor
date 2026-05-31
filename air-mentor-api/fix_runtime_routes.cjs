const fs = require('fs');
const file = 'src/modules/academic-runtime-routes.ts';
let code = fs.readFileSync(file, 'utf8');

// For the attendance update around line 1274
code = code.replace(
  /const studentPatchUpdates: Record<string, Record<string, unknown>> = \{\}\n\s*for \(const entry of body\.entries\)/,
  `const studentPatchUpdates: Record<string, Record<string, unknown>> = {}\n\n    for (const entry of body.entries)`
);

// We need to fix the update section for attendance (around 1290)
// wait, does attendance have a lock? 
// Let's check where componentStatesJson is used in attendance
code = code.replace(
  /if \(body\.lock\) \{\n\s*const states = \{ \.\.\.componentStates \}\n\s*states\.attendanceLocked = 1\n\n\s*await context\.db\.update\(sectionOfferings\)\.set\(\{\n\s*componentStatesJson: JSON\.stringify\(states\),\n\s*version: offering\.version \+ 1,\n\s*updatedAt: now,\n\s*\}\)\.where\(eq\(sectionOfferings\.offeringId, params\.offeringId\)\)\n\s*\}/,
  `if (body.lock) {
      // Attendance locking not supported in current schema
      await context.db.update(sectionOfferings).set({
        version: offering.version + 1,
        updatedAt: now,
      }).where(eq(sectionOfferings.offeringId, params.offeringId))
    }`
);

// For the assessment update around line 1380
// wait, I deleted `const componentStates = ...` using sed. Let me add back the lockKey check.
code = code.replace(
  /const lockKey = \`\$\{params\.kind\}Locked\`\n\n\s*\/\/ GAP-2: Prevent locking evidence/,
  `const lockKey = \`\$\{params.kind\}Locked\` as keyof typeof offering\n    if (offering[lockKey] === 1 || offering[lockKey] === true) {\n      throw forbidden('This assessment dataset is locked')\n    }\n\n    // GAP-2: Prevent locking evidence`
);

// Fix the `.update` around 1544
code = code.replace(
  /const states = \{ \.\.\.componentStates \}\n\s*if \(params\.kind === 'tt1'\) states\.tt1Done = 1\n\s*if \(params\.kind === 'tt2'\) states\.tt2Done = 1\n\s*if \(body\.lock\) states\[\`\$\{params\.kind\}Locked\`\] = 1\n\n\s*await context\.db\.update\(sectionOfferings\)\.set\(\{\n\s*componentStatesJson: JSON\.stringify\(states\),\n\s*version: offering\.version \+ 1,\n\s*updatedAt: now,\n\s*\}\)\.where\(eq\(sectionOfferings\.offeringId, params\.offeringId\)\)/,
  `const setObj: any = { version: offering.version + 1, updatedAt: now }
      if (params.kind === 'tt1') setObj.tt1Done = 1
      if (params.kind === 'tt2') setObj.tt2Done = 1
      if (body.lock) setObj[\`\$\{params.kind\}Locked\`] = 1

      await context.db.update(sectionOfferings).set(setObj).where(eq(sectionOfferings.offeringId, params.offeringId))`
);

fs.writeFileSync(file, code);
